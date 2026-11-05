export const moderationPage = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SketchDuel report review</title>
  <style>
    body{font:16px system-ui,sans-serif;max-width:920px;margin:32px auto;padding:0 16px;color:#202033;background:#f6f7fb}
    h1{font-size:26px}button{padding:9px 12px;border:0;border-radius:8px;background:#6757d9;color:white;cursor:pointer;margin:4px}
    button.secondary{background:#555}article{background:white;border-radius:12px;padding:18px;margin:16px 0;box-shadow:0 2px 12px #18204a12}
    pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f2f3f8;padding:12px;border-radius:8px;font-size:13px}
    .meta{color:#5d5d70;font-size:14px}.error{color:#a12135}
    .delivery{font-weight:600}
  </style>
</head>
<body>
  <h1>SketchDuel content reports</h1>
  <p>Enter the server access key to review reports. The key stays in this page's memory and is not saved.</p>
  <button id="login">Load reports</button><button id="reload" class="secondary" hidden>Reload</button>
  <section id="notifications" hidden>
    <p id="notificationStatus" role="status"></p>
    <button id="testNotification" class="secondary" type="button">Send test notification</button>
  </section>
  <p id="status" role="status"></p><main id="reports"></main>
  <script>
    let accessKey = "";
    const status = document.getElementById("status");
    const reportList = document.getElementById("reports");
    const notifications = document.getElementById("notifications");
    const notificationStatus = document.getElementById("notificationStatus");
    const testNotification = document.getElementById("testNotification");
    const authHeaders = () => ({ "X-Moderation-Admin-Token": accessKey, "Content-Type": "application/json" });
    async function loadNotificationStatus() {
      const response = await fetch("/api/moderation/notification-status", { headers: authHeaders() });
      if (!response.ok) throw new Error("Could not check owner notification settings.");
      const result = await response.json();
      notificationStatus.textContent = result.status === "configured"
        ? "Owner notifications are configured."
        : result.status === "invalid"
          ? "Owner notification destination is invalid. Set a valid HTTPS webhook URL."
          : "Owner notifications are not configured.";
      notificationStatus.className = result.status === "configured" ? "" : "error";
      testNotification.disabled = result.status !== "configured";
      notifications.hidden = false;
    }
    async function loadReports() {
      if (!accessKey) accessKey = window.prompt("Server access key") || "";
      if (!accessKey) return;
      status.textContent = "Loading reports…";
      reportList.replaceChildren();
      try {
        const response = await fetch("/api/moderation/reports", { headers: authHeaders() });
        if (!response.ok) throw new Error(response.status === 401 ? "Access key was not accepted." : "Could not load reports (" + response.status + ").");
        const reports = await response.json();
        status.textContent = reports.length ? reports.length + " report(s)" : "No reports yet.";
        document.getElementById("reload").hidden = false;
        await loadNotificationStatus();
        for (const report of reports) {
          const card = document.createElement("article");
          const heading = document.createElement("h2");
          heading.textContent = report.reason.replaceAll("_", " ") + " — " + report.status;
          const meta = document.createElement("p");
          meta.className = "meta";
          meta.textContent = "Reported " + new Date(report.createdAt).toLocaleString() + " · " + report.reportType + " · " + report.targetName;
          const delivery = document.createElement("p");
          delivery.className = "delivery";
          const deliveryState = report.alertDeliveryStatus || "pending";
          delivery.textContent = "Owner alert: " + deliveryState;
          const evidence = document.createElement("pre");
          evidence.textContent = JSON.stringify(report.evidence, null, 2);
          card.append(heading, meta, delivery, evidence);
          if (deliveryState === "failed") {
            const retry = document.createElement("button");
            retry.textContent = "Retry alert";
            retry.addEventListener("click", async () => {
              retry.disabled = true;
              retry.textContent = "Retrying…";
              try {
                const response = await fetch("/api/moderation/reports/" + encodeURIComponent(report.id) + "/notification-retry", {
                  method: "POST", headers: authHeaders(),
                });
                const result = await response.json();
                status.textContent = response.ok ? result.message : result.message || "Could not retry alert.";
                status.className = response.ok ? "" : "error";
              } catch {
                status.textContent = "Could not retry alert.";
                status.className = "error";
              }
              await loadReports();
            });
            card.append(retry);
          }
          for (const [state, label] of [["reviewed", "Mark reviewed"], ["actioned", "Take action"], ["dismissed", "Dismiss"]]) {
            const button = document.createElement("button");
            button.textContent = label;
            button.addEventListener("click", async () => {
              const response = await fetch("/api/moderation/reports/" + encodeURIComponent(report.id), {
                method: "PATCH", headers: authHeaders(), body: JSON.stringify({ status: state }),
              });
              if (!response.ok) {
                status.textContent = "Could not update report.";
                status.className = "error";
                return;
              }
              await loadReports();
            });
            card.append(button);
          }
          reportList.append(card);
        }
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : "Could not load reports.";
        status.className = "error";
        accessKey = "";
      }
    }
    testNotification.addEventListener("click", async () => {
      testNotification.disabled = true;
      notificationStatus.textContent = "Sending test notification…";
      try {
        const response = await fetch("/api/moderation/notification-test", {
          method: "POST", headers: authHeaders(),
        });
        const result = await response.json();
        notificationStatus.textContent = response.ok ? result.message : result.message || "Test notification failed.";
        notificationStatus.className = response.ok ? "" : "error";
      } catch {
        notificationStatus.textContent = "Could not send the test notification.";
        notificationStatus.className = "error";
      } finally {
        testNotification.disabled = false;
      }
    });
    document.getElementById("login").addEventListener("click", loadReports);
    document.getElementById("reload").addEventListener("click", loadReports);
  </script>
</body>
</html>`;
