# SketchDuel content moderation

## Review reports

Open `/moderation/reports` on the running SketchDuel server. Select **Load reports** and enter the server's `SESSION_SECRET` as the access key. The key is held only in the page's memory and is not saved by the browser.

The review page shows the report reason and the preserved drawing evidence. Choose **Mark reviewed**, **Take action**, or **Dismiss** after review. A gallery drawing is hidden while it has a pending report or an actioned report; it becomes visible again after all reports for it are reviewed or dismissed.

Reports are rate-limited and stored in the database. Review them promptly and use **Take action** when content or a player requires action outside the app.

## Owner notifications

To receive a private alert when a report is submitted, add `MODERATION_NOTIFICATION_WEBHOOK_URL` as a Replit Secret in the server's environment. It must be an HTTPS webhook that accepts a JSON `POST` and returns a successful HTTP status. Keep the URL in Secrets; do not put it in app code or share it with clients.

The notification contains only a generic alert, an event name, and the `/moderation/reports` path. It never includes report evidence, report IDs, game/session identifiers, or player identifiers. Delivery is best-effort: reports are still accepted and saved if the webhook is unavailable.

After setting the secret, open the moderation page and load reports. The page reports whether a valid destination is configured; select **Send test notification** to confirm the endpoint accepts messages. The test sends no report information. If no webhook is configured, notifications are disabled and the reporting flow continues to work.

## Contact address

The app's home screen includes **Contact Support**, configured to email `support@sketchduel.app`. Confirm that this mailbox is active before release; change `expo.extra.supportEmail` in `app.json` if support uses another address.
