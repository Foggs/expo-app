import express from "express";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { registerRoutes, resumePendingModerationReportAlerts } from "../routes";

const mocks = vi.hoisted(() => {
  let alertStatus = "failed";
  let alertAttempts = 0;
  let attemptClaimed = false;
  let nextAttemptAt: Date | null = null;

  return {
    reset(status = "failed", attempts = 0) {
      alertStatus = status;
      alertAttempts = attempts;
      attemptClaimed = false;
      nextAttemptAt = status === "pending" ? new Date(Date.now()) : null;
    },
    state() {
      return { status: alertStatus, attempts: alertAttempts, nextAttemptAt };
    },
    storage: {
      claimFailedModerationReportAlertRetry: vi.fn(async () => {
        if (alertStatus !== "failed") return false;
        alertStatus = "pending";
        alertAttempts = 0;
        attemptClaimed = false;
        nextAttemptAt = new Date(Date.now());
        return true;
      }),
      claimPendingModerationReportAlertAttempt: vi.fn(async () => {
        if (
          alertStatus !== "pending" ||
          attemptClaimed ||
          alertAttempts >= 3 ||
          !nextAttemptAt ||
          nextAttemptAt.getTime() > Date.now()
        ) return undefined;
        attemptClaimed = true;
        alertAttempts += 1;
        nextAttemptAt = new Date(Date.now() + 7_000);
        return alertAttempts;
      }),
      getDueModerationReportAlertDeliveries: vi.fn(async () => (
        alertStatus === "pending" && nextAttemptAt && nextAttemptAt.getTime() <= Date.now()
          ? [{ id: REPORT_ID, alertDeliveryAttempts: alertAttempts }]
          : []
      )),
      getModerationReportAlertDeliveryStatus: vi.fn(async () => alertStatus),
      updateModerationReportAlertDeliveryStatus: vi.fn(async (_id: string, status: string, nextAttempt?: Date | null) => {
        alertStatus = status;
        nextAttemptAt = nextAttempt ?? null;
        if (status === "pending") attemptClaimed = false;
        return true;
      }),
      createModerationReport: vi.fn(),
    },
    sendModerationNotification: vi.fn(async () => undefined),
    getModerationNotificationStatus: vi.fn(() => "configured"),
  };
});

vi.mock("../storage", () => ({ storage: mocks.storage }));
vi.mock("../moderation-notifications", () => ({
  ModerationNotificationError: class ModerationNotificationError extends Error {
    kind: string;

    constructor(message: string, kind = "permanent") {
      super(message);
      this.kind = kind;
    }
  },
  getModerationNotificationStatus: mocks.getModerationNotificationStatus,
  sendModerationNotification: mocks.sendModerationNotification,
}));

const ADMIN_TOKEN = "test-moderator-token";
const REPORT_ID = "report-123";

describe("moderation alert retry route", () => {
  let server: Awaited<ReturnType<typeof registerRoutes>>;
  let baseUrl: string;

  beforeAll(async () => {
    server = await registerRoutes(express());
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind to a TCP port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });

  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", ADMIN_TOKEN);
    mocks.reset();
    vi.clearAllMocks();
    mocks.sendModerationNotification.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function retryAlert(token?: string): Promise<Response> {
    const headers = token ? { "x-moderation-admin-token": token } : undefined;
    return fetch(`${baseUrl}/api/moderation/reports/${REPORT_ID}/notification-retry`, {
      method: "POST",
      headers,
    });
  }

  it("rejects requests without a valid moderator token before claiming the retry", async () => {
    for (const token of [undefined, "wrong-token"]) {
      const response = await retryAlert(token);
      expect(response.status).toBe(401);
    }

    expect(mocks.storage.claimFailedModerationReportAlertRetry).not.toHaveBeenCalled();
    expect(mocks.sendModerationNotification).not.toHaveBeenCalled();
  });

  it("does not allow retries when moderator authentication is not configured", async () => {
    vi.stubEnv("SESSION_SECRET", "");

    const response = await retryAlert(ADMIN_TOKEN);

    expect(response.status).toBe(503);
    expect(mocks.storage.claimFailedModerationReportAlertRetry).not.toHaveBeenCalled();
    expect(mocks.sendModerationNotification).not.toHaveBeenCalled();
  });

  it.each(["pending", "delivered"])("does not retry an alert already marked %s", async (status) => {
    mocks.reset(status);

    const response = await retryAlert(ADMIN_TOKEN);

    expect(response.status).toBe(409);
    expect(mocks.sendModerationNotification).not.toHaveBeenCalled();
    expect(mocks.storage.createModerationReport).not.toHaveBeenCalled();
  });

  it("allows only one delivery for concurrent requests and never creates another report", async () => {
    let beginDelivery!: () => void;
    let finishDelivery!: () => void;
    const deliveryStarted = new Promise<void>((resolve) => {
      beginDelivery = resolve;
    });
    const deliveryGate = new Promise<void>((resolve) => {
      finishDelivery = resolve;
    });
    mocks.sendModerationNotification.mockImplementation(async () => {
      beginDelivery();
      await deliveryGate;
    });

    const firstRequest = retryAlert(ADMIN_TOKEN);
    await deliveryStarted;
    const secondResponse = await retryAlert(ADMIN_TOKEN);
    finishDelivery();
    const firstResponse = await firstRequest;

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(409);
    expect(mocks.sendModerationNotification).toHaveBeenCalledOnce();
    expect(mocks.storage.updateModerationReportAlertDeliveryStatus).toHaveBeenCalledWith(REPORT_ID, "delivered", null);
    expect(mocks.storage.createModerationReport).not.toHaveBeenCalled();
  });

  it("marks permanent moderator retry failures as failed without scheduling another attempt", async () => {
    const { ModerationNotificationError } = await import("../moderation-notifications");
    mocks.sendModerationNotification.mockRejectedValueOnce(
      new ModerationNotificationError("destination rejected delivery", "permanent"),
    );

    const response = await retryAlert(ADMIN_TOKEN);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      message: "Report alert delivery failed. You can try again.",
    });
    expect(mocks.state()).toEqual({ status: "failed", attempts: 1, nextAttemptAt: null });
    expect(mocks.storage.updateModerationReportAlertDeliveryStatus).toHaveBeenCalledWith(
      REPORT_ID,
      "failed",
      null,
    );
    expect(mocks.sendModerationNotification).toHaveBeenCalledOnce();
    expect(mocks.sendModerationNotification).toHaveBeenCalledWith("report_created", REPORT_ID);
    expect(mocks.storage.createModerationReport).not.toHaveBeenCalled();
  });

  it("queues a delayed retry after moderator delivery fails transiently, then resumes the same report", async () => {
    let now = Date.now();
    const dateNowSpy = vi.spyOn(Date, "now").mockImplementation(() => now);
    try {
      const { ModerationNotificationError } = await import("../moderation-notifications");
      mocks.sendModerationNotification
        .mockRejectedValueOnce(new ModerationNotificationError("temporary failure", "transient"))
        .mockResolvedValue(undefined);

      const response = await retryAlert(ADMIN_TOKEN);
      expect(response.status).toBe(202);
      expect(await response.json()).toEqual({
        message: "Report alert is queued for another delivery attempt.",
      });

      const pendingState = mocks.state();
      expect(pendingState).toMatchObject({ status: "pending", attempts: 1 });
      expect(pendingState.nextAttemptAt).toBeInstanceOf(Date);
      expect(pendingState.nextAttemptAt!.getTime()).toBeGreaterThan(now);
      expect(mocks.storage.updateModerationReportAlertDeliveryStatus).toHaveBeenCalledWith(
        REPORT_ID,
        "pending",
        pendingState.nextAttemptAt,
      );
      expect(mocks.sendModerationNotification).toHaveBeenCalledOnce();
      expect(mocks.sendModerationNotification).toHaveBeenNthCalledWith(1, "report_created", REPORT_ID);
      expect(mocks.storage.createModerationReport).not.toHaveBeenCalled();

      await resumePendingModerationReportAlerts();
      expect(mocks.sendModerationNotification).toHaveBeenCalledOnce();
      expect(mocks.state()).toEqual(pendingState);

      now = pendingState.nextAttemptAt!.getTime();
      await resumePendingModerationReportAlerts();

      expect(mocks.sendModerationNotification).toHaveBeenCalledTimes(2);
      expect(mocks.sendModerationNotification).toHaveBeenNthCalledWith(2, "report_created", REPORT_ID);
      expect(mocks.state()).toEqual({ status: "delivered", attempts: 2, nextAttemptAt: null });
      expect(mocks.storage.updateModerationReportAlertDeliveryStatus).toHaveBeenLastCalledWith(
        REPORT_ID,
        "delivered",
        null,
      );
      expect(mocks.storage.createModerationReport).not.toHaveBeenCalled();
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it("stops scheduling moderator alerts after repeated transient failures reach the attempt limit", async () => {
    let now = Date.now();
    const dateNowSpy = vi.spyOn(Date, "now").mockImplementation(() => now);
    try {
      const { ModerationNotificationError } = await import("../moderation-notifications");
      mocks.sendModerationNotification.mockRejectedValue(
        new ModerationNotificationError("temporary failure", "transient"),
      );

      const response = await retryAlert(ADMIN_TOKEN);

      expect(response.status).toBe(202);
      expect(mocks.state()).toMatchObject({ status: "pending", attempts: 1 });
      expect(mocks.state().nextAttemptAt).toBeInstanceOf(Date);

      now = mocks.state().nextAttemptAt!.getTime();
      await resumePendingModerationReportAlerts();
      expect(mocks.state()).toMatchObject({ status: "pending", attempts: 2 });
      expect(mocks.state().nextAttemptAt).toBeInstanceOf(Date);

      now = mocks.state().nextAttemptAt!.getTime();
      await resumePendingModerationReportAlerts();

      expect(mocks.state()).toEqual({ status: "failed", attempts: 3, nextAttemptAt: null });
      expect(mocks.storage.updateModerationReportAlertDeliveryStatus).toHaveBeenLastCalledWith(
        REPORT_ID,
        "failed",
        null,
      );
      expect(mocks.sendModerationNotification).toHaveBeenCalledTimes(3);
      expect(mocks.sendModerationNotification).toHaveBeenNthCalledWith(1, "report_created", REPORT_ID);
      expect(mocks.sendModerationNotification).toHaveBeenNthCalledWith(2, "report_created", REPORT_ID);
      expect(mocks.sendModerationNotification).toHaveBeenNthCalledWith(3, "report_created", REPORT_ID);
      expect(mocks.storage.createModerationReport).not.toHaveBeenCalled();

      await resumePendingModerationReportAlerts();

      expect(mocks.sendModerationNotification).toHaveBeenCalledTimes(3);
      expect(mocks.storage.claimPendingModerationReportAlertAttempt).toHaveBeenCalledTimes(3);
      expect(mocks.state()).toEqual({ status: "failed", attempts: 3, nextAttemptAt: null });
      expect(mocks.storage.createModerationReport).not.toHaveBeenCalled();
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it("resumes due pending alerts and records a delayed retry after transient failure", async () => {
    mocks.reset("pending", 1);
    const { ModerationNotificationError } = await import("../moderation-notifications");
    mocks.sendModerationNotification.mockRejectedValueOnce(
      new ModerationNotificationError("temporary failure", "transient"),
    );

    await resumePendingModerationReportAlerts();

    expect(mocks.storage.getDueModerationReportAlertDeliveries).toHaveBeenCalledOnce();
    expect(mocks.storage.claimPendingModerationReportAlertAttempt).toHaveBeenCalledWith(REPORT_ID);
    expect(mocks.sendModerationNotification).toHaveBeenCalledOnce();
    expect(mocks.storage.updateModerationReportAlertDeliveryStatus).toHaveBeenCalledWith(
      REPORT_ID,
      "pending",
      expect.any(Date),
    );
  });

  it("marks a pending alert failed once its persisted attempt limit is exhausted", async () => {
    mocks.reset("pending", 3);

    await resumePendingModerationReportAlerts();

    expect(mocks.sendModerationNotification).not.toHaveBeenCalled();
    expect(mocks.storage.updateModerationReportAlertDeliveryStatus).toHaveBeenCalledWith(REPORT_ID, "failed", null);
  });
});
