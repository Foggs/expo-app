import express from "express";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { registerRoutes } from "../routes";

const mocks = vi.hoisted(() => {
  let alertStatus = "failed";

  return {
    reset(status = "failed") {
      alertStatus = status;
    },
    storage: {
      claimFailedModerationReportAlertRetry: vi.fn(async () => {
        if (alertStatus !== "failed") return false;
        alertStatus = "pending";
        return true;
      }),
      getModerationReportAlertDeliveryStatus: vi.fn(async () => alertStatus),
      updateModerationReportAlertDeliveryStatus: vi.fn(async (_id: string, status: string) => {
        alertStatus = status;
        return true;
      }),
      createModerationReport: vi.fn(),
    },
    sendReportCreatedNotificationWithRetry: vi.fn(async () => undefined),
    sendModerationNotification: vi.fn(async () => undefined),
    getModerationNotificationStatus: vi.fn(() => "configured"),
  };
});

vi.mock("../storage", () => ({ storage: mocks.storage }));
vi.mock("../moderation-notifications", () => ({
  ModerationNotificationError: class ModerationNotificationError extends Error {
    kind = "permanent";
  },
  getModerationNotificationStatus: mocks.getModerationNotificationStatus,
  sendModerationNotification: mocks.sendModerationNotification,
  sendReportCreatedNotificationWithRetry: mocks.sendReportCreatedNotificationWithRetry,
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
    mocks.sendReportCreatedNotificationWithRetry.mockReset().mockResolvedValue(undefined);
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
    expect(mocks.sendReportCreatedNotificationWithRetry).not.toHaveBeenCalled();
  });

  it("does not allow retries when moderator authentication is not configured", async () => {
    vi.stubEnv("SESSION_SECRET", "");

    const response = await retryAlert(ADMIN_TOKEN);

    expect(response.status).toBe(503);
    expect(mocks.storage.claimFailedModerationReportAlertRetry).not.toHaveBeenCalled();
    expect(mocks.sendReportCreatedNotificationWithRetry).not.toHaveBeenCalled();
  });

  it.each(["pending", "delivered"])("does not retry an alert already marked %s", async (status) => {
    mocks.reset(status);

    const response = await retryAlert(ADMIN_TOKEN);

    expect(response.status).toBe(409);
    expect(mocks.sendReportCreatedNotificationWithRetry).not.toHaveBeenCalled();
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
    mocks.sendReportCreatedNotificationWithRetry.mockImplementation(async () => {
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
    expect(mocks.sendReportCreatedNotificationWithRetry).toHaveBeenCalledOnce();
    expect(mocks.storage.updateModerationReportAlertDeliveryStatus).toHaveBeenCalledWith(REPORT_ID, "delivered");
    expect(mocks.storage.createModerationReport).not.toHaveBeenCalled();
  });
});
