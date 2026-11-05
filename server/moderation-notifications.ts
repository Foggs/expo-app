const WEBHOOK_ENV_KEY = "MODERATION_NOTIFICATION_WEBHOOK_URL";
const DELIVERY_TIMEOUT_MS = 5_000;

type NotificationKind = "report_created" | "test";

export type ModerationNotificationStatus = "configured" | "not_configured" | "invalid";

function getWebhookUrl(): { status: ModerationNotificationStatus; url?: URL } {
  const configuredUrl = process.env[WEBHOOK_ENV_KEY]?.trim();
  if (!configuredUrl) return { status: "not_configured" };

  try {
    const url = new URL(configuredUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) {
      return { status: "invalid" };
    }
    return { status: "configured", url };
  } catch {
    return { status: "invalid" };
  }
}

export function getModerationNotificationStatus(): ModerationNotificationStatus {
  return getWebhookUrl().status;
}

export async function sendModerationNotification(kind: NotificationKind): Promise<void> {
  const config = getWebhookUrl();
  if (!config.url) {
    throw new Error(config.status === "invalid" ? "Notification webhook URL is invalid" : "Notification webhook is not configured");
  }

  const isTest = kind === "test";
  const response = await fetch(config.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: isTest ? "moderation.notification.test" : "moderation.report.created",
      message: isTest
        ? "Test notification from SketchDuel moderation."
        : "A new SketchDuel content report needs review.",
      reviewPath: "/moderation/reports",
    }),
    redirect: "error",
    signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Notification webhook returned HTTP ${response.status}`);
  }
}
