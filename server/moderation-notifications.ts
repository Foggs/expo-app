import { createHmac } from "node:crypto";

const WEBHOOK_ENV_KEY = "MODERATION_NOTIFICATION_WEBHOOK_URL";
const SIGNING_SECRET_ENV_KEY = "MODERATION_NOTIFICATION_WEBHOOK_SECRET";
const DELIVERY_TIMEOUT_MS = 5_000;

type NotificationKind = "report_created" | "test";

export type ModerationNotificationStatus = "configured" | "signing_secret_missing" | "not_configured" | "invalid";
type NotificationFailureKind = "configuration" | "transient" | "permanent";

export class ModerationNotificationError extends Error {
  constructor(
    message: string,
    readonly kind: NotificationFailureKind,
  ) {
    super(message);
    this.name = "ModerationNotificationError";
  }
}

function getWebhookUrl(): { status: ModerationNotificationStatus; url?: URL } {
  const configuredUrl = process.env[WEBHOOK_ENV_KEY]?.trim();
  if (!configuredUrl) return { status: "not_configured" };

  try {
    const url = new URL(configuredUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) {
      return { status: "invalid" };
    }
    return {
      status: process.env[SIGNING_SECRET_ENV_KEY]?.trim() ? "configured" : "signing_secret_missing",
      url,
    };
  } catch {
    return { status: "invalid" };
  }
}
export function getModerationNotificationStatus(): ModerationNotificationStatus {
  return getWebhookUrl().status;
}

export function sendModerationNotification(kind: "report_created", reportId: string): Promise<void>;
export function sendModerationNotification(kind: "test"): Promise<void>;
export async function sendModerationNotification(kind: NotificationKind, reportId?: string): Promise<void> {
  const config = getWebhookUrl();
  if (!config.url) {
    throw new ModerationNotificationError(
      config.status === "invalid" ? "Notification webhook URL is invalid" : "Notification webhook is not configured",
      "configuration",
    );
  }

  const isTest = kind === "test";
  if (!isTest && !reportId) {
    throw new TypeError("A report ID is required for report notifications");
  }
  const signingSecret = process.env[SIGNING_SECRET_ENV_KEY];
  if (!isTest && !signingSecret?.trim()) {
    throw new ModerationNotificationError("Notification webhook signing secret is not configured", "configuration");
  }
  const payload = {
    event: isTest ? "moderation.notification.test" : "moderation.report.created",
    message: isTest
      ? "Test notification from SketchDuel moderation."
      : "A new SketchDuel content report needs review.",
    reviewPath: "/moderation/reports",
    ...(isTest ? {} : { idempotencyKey: reportId }),
  };
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!isTest) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac("sha256", signingSecret!)
      .update(`${timestamp}.${body}`)
      .digest("hex");
    headers["X-SketchDuel-Timestamp"] = timestamp;
    headers["X-SketchDuel-Signature"] = `v1=${signature}`;
  }
  let response: Response;
  try {
    response = await fetch(config.url, {
      method: "POST",
      headers,
      body,
      redirect: "error",
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    });
  } catch {
    throw new ModerationNotificationError("Notification webhook request failed", "transient");
  }

  if (!response.ok) {
    const kind = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500
      ? "transient"
      : "permanent";
    throw new ModerationNotificationError(`Notification webhook returned HTTP ${response.status}`, kind);
  }
}
