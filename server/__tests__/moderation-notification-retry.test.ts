import express from "express";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { registerRoutes, resumePendingModerationReportAlerts } from "../routes";

const mocks = vi.hoisted(() => {
  let alertStatus = "failed";
  let alertAttempts = 0;
  let attemptClaimed = false;

  return {
    reset(status = "failed", attempts = 0) {
      alertStatus = status;
      alertAttempts = attempts;
      attemptClaimed = false;
    },
    storage: {
      claimFailedModerationReportAlertRetry: vi.fn(async () => {
        if (alertStatus !== "failed") return false;
        alertStatus = "pending";
        alertAttempts = 0;
        attemptClaimed = false;
        return true;
      }),
      claimPendingModerationReportAlertAttempt: vi.fn(async () => {
        if (alertStatus !== "pending" || attemptClaimed || alertAttempts >= 3) return undefined;
        attemptClaimed = true;
        alertAttempts += 1;
        return alertAttempts;
      }),
      getDueModerationReportAlertDeliveries: vi.fn(async () => (
        alertStatus === "pending" ? [{ id: REPORT_ID, alertDeliveryAttempts: alertAttempts }] : []
      )),
      getModerationReportAlertDeliveryStatus: vi.fn(async () => alertStatus),
      updateModerationReportAlertDeliveryStatus: vi.fn(async (_id: string, status: string, _nextAttemptAt?: Date | null) => {
        alertStatus = status;
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
