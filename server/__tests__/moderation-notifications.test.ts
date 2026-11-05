import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getModerationNotificationStatus,
  ModerationNotificationError,
  sendModerationNotification,
} from "../moderation-notifications";

describe("moderation notifications", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reports when no webhook is configured", () => {
    vi.stubEnv("MODERATION_NOTIFICATION_WEBHOOK_URL", "");
    expect(getModerationNotificationStatus()).toBe("not_configured");
  });

  it("only accepts HTTPS webhook URLs", () => {
    vi.stubEnv("MODERATION_NOTIFICATION_WEBHOOK_URL", "http://hooks.example.test/notify");
    expect(getModerationNotificationStatus()).toBe("invalid");
  });

  it("sends report alerts with a stable idempotency key and existing event fields", async () => {
    vi.stubEnv("MODERATION_NOTIFICATION_WEBHOOK_URL", "https://hooks.example.test/notify");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const reportId = "c86eea60-4124-47ce-99ae-03583855ee16";
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
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual(expectedPayload);
  });

  it("rejects unsuccessful webhook responses", async () => {
    vi.stubEnv("MODERATION_NOTIFICATION_WEBHOOK_URL", "https://hooks.example.test/notify");
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
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendModerationNotification("report_created", "report-123")).rejects.toMatchObject({ kind: "permanent" });
    expect(fetchMock).toHaveBeenCalledOnce();

    vi.stubEnv("MODERATION_NOTIFICATION_WEBHOOK_URL", "http://hooks.example.test/notify");
    await expect(sendModerationNotification("report_created", "report-123")).rejects.toBeInstanceOf(ModerationNotificationError);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

});
