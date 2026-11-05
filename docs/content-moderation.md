# SketchDuel content moderation

## Review reports

Open `/moderation/reports` on the running SketchDuel server. Select **Load reports** and enter the server's `SESSION_SECRET` as the access key. The key is held only in the page's memory and is not saved by the browser.

The review page shows the report reason and the preserved drawing evidence. Choose **Mark reviewed**, **Take action**, or **Dismiss** after review. A gallery drawing is hidden while it has a pending report or an actioned report; it becomes visible again after all reports for it are reviewed or dismissed.

Reports are rate-limited and stored in the database. Review them promptly and use **Take action** when content or a player requires action outside the app.

## Owner notifications

To receive a private alert when a report is submitted, add both `MODERATION_NOTIFICATION_WEBHOOK_URL` and `MODERATION_NOTIFICATION_WEBHOOK_SECRET` as Replit Secrets in the server's environment. The URL must be an HTTPS webhook that accepts a JSON `POST` and returns a successful HTTP status. Use a dedicated, unpredictable signing secret (at least 32 random bytes, encoded as hex); do not reuse `SESSION_SECRET`. Keep both values in Secrets; do not put them in app code or share them with clients.

Report alerts contain a generic message, the `moderation.report.created` event, the `/moderation/reports` path, and an `idempotencyKey` containing the report's opaque ID. The key is stable across all delivery retries for that report; webhook receivers can use it to ignore duplicate deliveries. Alerts never include report evidence, game/session identifiers, or player identifiers. Each report alert also includes `X-SketchDuel-Timestamp` (Unix seconds) and `X-SketchDuel-Signature` (`v1=` followed by a lowercase hexadecimal HMAC-SHA256). The signature is computed over the exact UTF-8 request body using the string `${timestamp}.${rawBody}` and the configured signing secret. Verify the signature against the raw body before parsing JSON, compare signatures with a constant-time comparison, and reject timestamps more than five minutes from the receiver's current time to prevent replay. A signature is freshly generated for each delivery attempt; the idempotency key remains stable.

For secret rotation, first configure the receiver to accept both the current and replacement secret, trying each active secret when verifying a signature. Then update `MODERATION_NOTIFICATION_WEBHOOK_SECRET` on the server and verify delivery. Once the server has switched, remove the old secret from the receiver. Test notifications use a separate event, remain unsigned, and do not include an idempotency key; they can still be sent when the report signing secret is missing. A report is saved once; notification delivery runs separately and does not submit the report again. Temporary network errors, timeouts, HTTP 408/425/429, and HTTP 5xx responses are retried up to two additional times, with scheduled delays of 500 ms and 1.5 seconds. Attempt counts and scheduled retries are saved with the report, so pending work resumes after a server restart. Invalid or missing webhook configuration and other HTTP 4xx responses are not retried. Once three automatic attempts fail, the alert is marked failed and the moderation page shows the attempt count; a moderator can start another bounded retry cycle from that page. The repository's merge setup applies the updated schema to the development database, and the Publish flow applies it to production.

After setting both secrets, open the moderation page and load reports. The page reports whether the webhook and report-signing secret are configured; select **Send test notification** to confirm the endpoint accepts messages. The test sends no report information. If no webhook is configured, notifications are disabled and the reporting flow continues to work.

## Contact address

The app's home screen includes **Contact Support**, configured to email `support@sketchduel.app`. Confirm that this mailbox is active before release; change `expo.extra.supportEmail` in `app.json` if support uses another address.
