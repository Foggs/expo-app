# SketchDuel content moderation

## Review reports

Open `/moderation/reports` on the running SketchDuel server. Select **Load reports** and enter the server's `SESSION_SECRET` as the access key. The key is held only in the page's memory and is not saved by the browser.

The review page shows the report reason and the preserved drawing evidence. Choose **Mark reviewed**, **Take action**, or **Dismiss** after review. A gallery drawing is hidden while it has a pending report or an actioned report; it becomes visible again after all reports for it are reviewed or dismissed.

Reports are rate-limited and stored in the database. Review them promptly and use **Take action** when content or a player requires action outside the app.

## Contact address

The app's home screen includes **Contact Support**, configured to email `support@sketchduel.app`. Confirm that this mailbox is active before release; change `expo.extra.supportEmail` in `app.json` if support uses another address.
