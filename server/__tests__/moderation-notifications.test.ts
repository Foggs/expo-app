import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getModerationNotificationStatus,
  ModerationNotificationError,
  sendModerationNotification,
  sendReportCreatedNotificationWithRetry,
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

  it("sends a minimal report alert without report or session details", async () => {
    vi.stubEnv("MODERATION_NOTIFICATION_WEBHOOK_URL", "https://hooks.example.test/notify");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendModerationNotification("report_created");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe("https://hooks.example.test/notify");
    expect(options.method).toBe("POST");
    expect(options.redirect).toBe("error");
    expect(JSON.parse(options.body)).toEqual({
      event: "moderation.report.created",
      message: "A new SketchDuel content report needs review.",
      reviewPath: "/moderation/reports",
    });
  });

  it("rejects unsuccessful webhook responses", async () => {
    vi.stubEnv("MODERATION_NOTIFICATION_WEBHOOK_URL", "https://hooks.example.test/notify");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    await expect(sendModerationNotification("test")).rejects.toMatchObject({
      message: "Notification webhook returned HTTP 503",
      kind: "transient",
    });
  });

  it("retries temporary failures, then succeeds without resubmitting a report", async () => {
    vi.useFakeTimers();
    vi.stubEnv("MODERATION_NOTIFICATION_WEBHOOK_URL", "https://hooks.example.test/notify");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockRejectedValueOnce(new TypeError("network unavailable"))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const delivery = sendReportCreatedNotificationWithRetry();
    await vi.advanceTimersByTimeAsync(2_000);
    await delivery;

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map(([, options]) => JSON.parse(options.body))).toEqual(
      Array(3).fill({
        event: "moderation.report.created",
        message: "A new SketchDuel content report needs review.",
        reviewPath: "/moderation/reports",
      }),
    );
  });

  it("does not retry permanent webhook responses or configuration errors", async () => {
    vi.useFakeTimers();
    vi.stubEnv("MODERATION_NOTIFICATION_WEBHOOK_URL", "https://hooks.example.test/notify");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendReportCreatedNotificationWithRetry()).rejects.toMatchObject({ kind: "permanent" });
    expect(fetchMock).toHaveBeenCalledOnce();

    vi.stubEnv("MODERATION_NOTIFICATION_WEBHOOK_URL", "http://hooks.example.test/notify");
    await expect(sendReportCreatedNotificationWithRetry()).rejects.toBeInstanceOf(ModerationNotificationError);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("stops after the bounded number of temporary attempts", async () => {
    vi.useFakeTimers();
    vi.stubEnv("MODERATION_NOTIFICATION_WEBHOOK_URL", "https://hooks.example.test/notify");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const delivery = sendReportCreatedNotificationWithRetry();
    const assertion = expect(delivery).rejects.toMatchObject({ kind: "transient" });
    await vi.advanceTimersByTimeAsync(2_000);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
