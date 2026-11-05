import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { verifySketchDuelSignature } from "../../docs/moderation-webhook-receiver.mjs";
import {
  getModerationNotificationStatus,
  ModerationNotificationError,
  sendModerationNotification,
} from "../moderation-notifications";

describe("moderation notifications", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const signingSecret = "test-only-moderation-secret";

  function verifyReceiverContract(body: string, timestamp: string, signature: string, nowSeconds: number): boolean {
    return verifySketchDuelSignature({
      rawBody: Buffer.from(body, "utf8"),
      timestamp,
      signature,
      secrets: [signingSecret],
      nowSeconds,
    });
  }

  it("reports when no webhook is configured", () => {
    vi.stubEnv("MODERATION_NOTIFICATION_WEBHOOK_URL", "");
    vi.stubEnv("MODERATION_NOTIFICATION_WEBHOOK_SECRET", "");
    expect(getModerationNotificationStatus()).toBe("not_configured");
  });

  it("only accepts HTTPS webhook URLs", () => {
    vi.stubEnv("MODERATION_NOTIFICATION_WEBHOOK_URL", "http://hooks.example.test/notify");
    expect(getModerationNotificationStatus()).toBe("invalid");
  });

  it("shows when report signing is missing without disabling unsigned test notifications", async () => {
    vi.stubEnv("MODERATION_NOTIFICATION_WEBHOOK_URL", "https://hooks.example.test/notify");
    vi.stubEnv("MODERATION_NOTIFICATION_WEBHOOK_SECRET", "");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(getModerationNotificationStatus()).toBe("signing_secret_missing");
    await expect(sendModerationNotification("report_created", "report-123")).rejects.toMatchObject({
      kind: "configuration",
      message: "Notification webhook signing secret is not configured",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    await sendModerationNotification("test");
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers).toEqual({ "Content-Type": "application/json" });
  });

  it("sends signed report alerts with a stable idempotency key and existing event fields", async () => {
    vi.stubEnv("MODERATION_NOTIFICATION_WEBHOOK_URL", "https://hooks.example.test/notify");
    vi.stubEnv("MODERATION_NOTIFICATION_WEBHOOK_SECRET", signingSecret);
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const reportId = "c86eea60-4124-47ce-99ae-03583855ee16";
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(1_700_000_000_000)
      .mockReturnValueOnce(1_700_000_001_000);
    await sendModerationNotification("report_created", reportId);
    await sendModerationNotification("report_created", reportId);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe("https://hooks.example.test/notify");
    expect(options.method).toBe("POST");
    expect(options.redirect).toBe("error");
    const expectedPayload = {
      event: "moderation.report.created",
      message: "A new SketchDuel content report needs review.",
      reviewPath: "/moderation/reports",
      idempotencyKey: reportId,
    };
    expect(JSON.parse(options.body)).toEqual(expectedPayload);
    const timestamp = options.headers["X-SketchDuel-Timestamp"];
    const signature = options.headers["X-SketchDuel-Signature"];
    expect(timestamp).toMatch(/^\d+$/);
    expect(signature).toMatch(/^v1=[a-f0-9]{64}$/);
    expect(verifyReceiverContract(options.body, timestamp, signature, Number(timestamp))).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual(expectedPayload);
    const secondHeaders = fetchMock.mock.calls[1][1].headers;
    expect(Number(secondHeaders["X-SketchDuel-Timestamp"])).toBe(Number(timestamp) + 1);
    expect(secondHeaders["X-SketchDuel-Signature"]).not.toBe(signature);
    expect(verifyReceiverContract(
      fetchMock.mock.calls[1][1].body,
      secondHeaders["X-SketchDuel-Timestamp"],
      secondHeaders["X-SketchDuel-Signature"],
      Number(secondHeaders["X-SketchDuel-Timestamp"]),
    )).toBe(true);
  });

  it("rejects a changed body or stale signed timestamp under the receiver contract", async () => {
    vi.stubEnv("MODERATION_NOTIFICATION_WEBHOOK_URL", "https://hooks.example.test/notify");
    vi.stubEnv("MODERATION_NOTIFICATION_WEBHOOK_SECRET", signingSecret);
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    await sendModerationNotification("report_created", "report-123");

    const [, options] = fetchMock.mock.calls[0];
    const timestamp = options.headers["X-SketchDuel-Timestamp"];
    const signature = options.headers["X-SketchDuel-Signature"];
    const changedBody = options.body.replace("needs review", "was changed");
    expect(verifyReceiverContract(changedBody, timestamp, signature, Number(timestamp))).toBe(false);

    const staleTimestamp = (Number(timestamp) - 301).toString();
    const staleSignature = `v1=${createHmac("sha256", signingSecret)
      .update(`${staleTimestamp}.${options.body}`)
      .digest("hex")}`;
    expect(verifyReceiverContract(options.body, staleTimestamp, staleSignature, Number(timestamp))).toBe(false);
  });

  it("accepts either active secret during rotation and enforces both signature headers", async () => {
    vi.stubEnv("MODERATION_NOTIFICATION_WEBHOOK_URL", "https://hooks.example.test/notify");
    vi.stubEnv("MODERATION_NOTIFICATION_WEBHOOK_SECRET", signingSecret);
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    await sendModerationNotification("report_created", "rotation-report");

    const [, options] = fetchMock.mock.calls[0];
    const rawBody = Buffer.from(options.body, "utf8");
    const { "X-SketchDuel-Timestamp": timestamp, "X-SketchDuel-Signature": signature } = options.headers;
    const replacementSecret = "replacement-secret-during-overlap";
    expect(verifySketchDuelSignature({
      rawBody,
      timestamp,
      signature,
      secrets: ["old-secret", signingSecret, replacementSecret],
      nowSeconds: Number(timestamp),
    })).toBe(true);
    expect(verifySketchDuelSignature({
      rawBody,
      timestamp,
      signature,
      secrets: ["old-secret", replacementSecret],
      nowSeconds: Number(timestamp),
    })).toBe(false);
    expect(verifySketchDuelSignature({
      rawBody,
      timestamp: undefined,
      signature,
      secrets: [signingSecret],
      nowSeconds: Number(timestamp),
    })).toBe(false);
    expect(verifySketchDuelSignature({
      rawBody,
      timestamp,
      signature: undefined,
      secrets: [signingSecret],
      nowSeconds: Number(timestamp),
    })).toBe(false);

    const replacementSignature = `v1=${createHmac("sha256", replacementSecret)
      .update(`${timestamp}.${options.body}`)
      .digest("hex")}`;
    expect(verifySketchDuelSignature({
      rawBody,
      timestamp,
      signature: replacementSignature,
      secrets: [signingSecret, replacementSecret],
      nowSeconds: Number(timestamp),
    })).toBe(true);
  });

  it("rejects unsuccessful webhook responses", async () => {
    vi.stubEnv("MODERATION_NOTIFICATION_WEBHOOK_URL", "https://hooks.example.test/notify");
    vi.stubEnv("MODERATION_NOTIFICATION_WEBHOOK_SECRET", "");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendModerationNotification("test")).rejects.toMatchObject({
      message: "Notification webhook returned HTTP 503",
      kind: "transient",
    });
    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({
      event: "moderation.notification.test",
      message: "Test notification from SketchDuel moderation.",
      reviewPath: "/moderation/reports",
    });
  });

  it("classifies permanent webhook responses and configuration errors", async () => {
    vi.stubEnv("MODERATION_NOTIFICATION_WEBHOOK_URL", "https://hooks.example.test/notify");
    vi.stubEnv("MODERATION_NOTIFICATION_WEBHOOK_SECRET", signingSecret);
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendModerationNotification("report_created", "report-123")).rejects.toMatchObject({ kind: "permanent" });
    expect(fetchMock).toHaveBeenCalledOnce();

    vi.stubEnv("MODERATION_NOTIFICATION_WEBHOOK_URL", "http://hooks.example.test/notify");
    await expect(sendModerationNotification("report_created", "report-123")).rejects.toBeInstanceOf(ModerationNotificationError);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
