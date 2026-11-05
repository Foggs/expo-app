import { createHmac } from "node:crypto";
import { type AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createIdempotentAlertProcessor,
  createWebhookServer,
  verifySketchDuelSignature,
} from "../../docs/moderation-webhook-receiver.mjs";
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

  function signReceiverRequest(body: string, timestamp: string): string {
    return `v1=${createHmac("sha256", signingSecret)
      .update(timestamp)
      .update(".")
      .update(body)
      .digest("hex")}`;
  }

  it("handles signed requests safely through the example HTTP server", async () => {
    const server = createWebhookServer([signingSecret], async (payload: { idempotencyKey: string }) => {
      console.log("Verified SketchDuel report alert:", payload.idempotencyKey);
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address() as AddressInfo;
    const endpoint = `http://127.0.0.1:${address.port}/webhook`;
    const closeServer = () => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const validBody = JSON.stringify({
      event: "moderation.report.created",
      idempotencyKey: "report-http-route-test",
    });
    const validSignature = signReceiverRequest(validBody, timestamp);
    const request = (body: string, headers: Record<string, string> = {}) => fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body,
    });

    try {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const accepted = await request(validBody, {
        "X-SketchDuel-Timestamp": timestamp,
        "X-SketchDuel-Signature": validSignature,
      });
      expect(accepted.status).toBe(204);
      expect(logSpy).toHaveBeenCalledWith(
        "Verified SketchDuel report alert:",
        "report-http-route-test",
      );

      const alteredBody = validBody.replace("report-http-route-test", "altered-report-id");
      const altered = await request(alteredBody, {
        "X-SketchDuel-Timestamp": timestamp,
        "X-SketchDuel-Signature": validSignature,
      });
      expect(altered.status).toBe(401);

      const missingSignature = await request(validBody, {
        "X-SketchDuel-Timestamp": timestamp,
      });
      expect(missingSignature.status).toBe(401);

      const missingTimestamp = await request(validBody, {
        "X-SketchDuel-Signature": validSignature,
      });
      expect(missingTimestamp.status).toBe(401);

      const staleTimestamp = (Number(timestamp) - 301).toString();
      const stale = await request(validBody, {
        "X-SketchDuel-Timestamp": staleTimestamp,
        "X-SketchDuel-Signature": signReceiverRequest(validBody, staleTimestamp),
      });
      expect(stale.status).toBe(401);

      const malformedBody = "{";
      const invalidSignatureBeforeJsonParsing = await request(malformedBody, {
        "X-SketchDuel-Timestamp": timestamp,
        // This is well-formed but signs different bytes. A 401 proves auth runs first.
        "X-SketchDuel-Signature": signReceiverRequest("{}", timestamp),
      });
      expect(invalidSignatureBeforeJsonParsing.status).toBe(401);

      const signedMalformedJson = await request(malformedBody, {
        "X-SketchDuel-Timestamp": timestamp,
        "X-SketchDuel-Signature": signReceiverRequest(malformedBody, timestamp),
      });
      expect(signedMalformedJson.status).toBe(400);
      expect(logSpy).toHaveBeenCalledTimes(1);
    } finally {
      await closeServer();
    }
  });

  it("returns HTTP 413 for oversized requests without processing the alert", async () => {
    const processAlert = vi.fn();
    const server = createWebhookServer([signingSecret], processAlert);
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address() as AddressInfo;
    const endpoint = `http://127.0.0.1:${address.port}/webhook`;
    const closeServer = () => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });

    try {
      const oversizedBody = "x".repeat(64 * 1024 + 1);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: oversizedBody,
      });

      expect(response.status).toBe(413);
      expect(await response.text()).toBe("Request body too large");
      expect(processAlert).not.toHaveBeenCalled();
    } finally {
      await closeServer();
    }
  });

  it("rolls back a failed action and accepts its later retry exactly once", async () => {
    const idempotencyKeys = new Set<string>();
    const committedActions: string[] = [];
    let shouldFail = true;
    let releaseSuccessfulAction: (() => void) | undefined;
    let markSuccessfulActionStarted: (() => void) | undefined;
    const successfulActionStarted = new Promise<void>((resolve) => {
      markSuccessfulActionStarted = resolve;
    });
    const runTransaction = async (
      callback: (tx: {
        stagedKeys: Set<string>;
        stagedActions: string[];
        recordIdempotencyKeyIfAbsent: (key: string) => Promise<boolean>;
      }) => Promise<void>,
    ) => {
      const stagedKeys = new Set(idempotencyKeys);
      const stagedActions: string[] = [];
      await callback({
        stagedKeys,
        stagedActions,
        recordIdempotencyKeyIfAbsent: async (key) => {
          if (stagedKeys.has(key)) return false;
          stagedKeys.add(key);
          return true;
        },
      });
      idempotencyKeys.clear();
      for (const key of stagedKeys) idempotencyKeys.add(key);
      committedActions.push(...stagedActions);
    };
    const processAlert = createIdempotentAlertProcessor({
      runTransaction,
      performBusinessAction: async (
        payload: { idempotencyKey: string },
        tx: { stagedActions: string[] },
      ) => {
        tx.stagedActions.push(payload.idempotencyKey);
        if (shouldFail) throw new Error("Simulated durable action failure");
        markSuccessfulActionStarted?.();
        await new Promise<void>((resolve) => {
          releaseSuccessfulAction = resolve;
        });
      },
    });
    const server = createWebhookServer([signingSecret], processAlert);
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address() as AddressInfo;
    const endpoint = `http://127.0.0.1:${address.port}/webhook`;
    const closeServer = () => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({
      event: "moderation.report.created",
      idempotencyKey: "report-transaction-retry-test",
    });
    const headers = {
      "Content-Type": "application/json",
      "X-SketchDuel-Timestamp": timestamp,
      "X-SketchDuel-Signature": signReceiverRequest(body, timestamp),
    };
    const request = () => fetch(endpoint, { method: "POST", headers, body });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const failedAttempt = await request();
      expect(failedAttempt.status).toBe(500);
      expect(idempotencyKeys.size).toBe(0);
      expect(committedActions).toEqual([]);

      shouldFail = false;
      let retryResponseReceived = false;
      const successfulRetry = request().then((response) => {
        retryResponseReceived = true;
        return response;
      });
      await successfulActionStarted;
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(retryResponseReceived).toBe(false);

      releaseSuccessfulAction?.();
      const acceptedRetry = await successfulRetry;
      expect(acceptedRetry.status).toBe(204);
      expect(idempotencyKeys).toEqual(new Set(["report-transaction-retry-test"]));
      expect(committedActions).toEqual(["report-transaction-retry-test"]);

      const duplicate = await request();
      expect(duplicate.status).toBe(204);
      expect(committedActions).toEqual(["report-transaction-retry-test"]);
    } finally {
      releaseSuccessfulAction?.();
      await closeServer();
      errorSpy.mockRestore();
    }
  });

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
