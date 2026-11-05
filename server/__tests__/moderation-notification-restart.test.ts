import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer as createHttpsServer } from "node:https";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { spawn, type ChildProcess } from "node:child_process";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const MODERATOR_TOKEN = "restart-test-moderator-token";
const REPORTER_TOKEN = "a".repeat(64);
const GALLERY_DRAWING_ID = "restart-test-drawing";
const TEST_TIMEOUT_MS = 60_000;

type PersistedReport = {
  id: string;
  alert_delivery_status: string;
  alert_delivery_attempts: number;
  alert_delivery_next_attempt_at: Date | null;
};

describe("moderation alert recovery after a real server restart", () => {
  let tempDir: string;
  let databaseUrl: string;
  let db: Pool;
  let webhook: ReturnType<typeof createHttpsServer>;
  let webhookUrl: string;
  let webhookRequests: Array<{ event?: string }>;
  let childProcesses: Set<ChildProcess>;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "moderation-alert-restart-"));
    childProcesses = new Set();
    webhookRequests = [];

    const databaseDir = join(tempDir, "postgres");
    const socketDir = join(tempDir, "socket");
    const certificatePath = join(tempDir, "webhook.crt");
    const privateKeyPath = join(tempDir, "webhook.key");
    await Promise.all([
      mkdir(databaseDir),
      mkdir(socketDir),
    ]);

    execFileSync("initdb", [
      "-D", databaseDir,
      "--auth-local=trust",
      "--auth-host=trust",
      "--username=postgres",
      "--no-locale",
      "--encoding=UTF8",
    ], { stdio: "ignore" });

    const databasePort = await findFreePort();
    execFileSync("pg_ctl", [
      "-D", databaseDir,
      "-o", `-h 127.0.0.1 -p ${databasePort} -k ${socketDir} -F`,
      "-l", join(tempDir, "postgres.log"),
      "-w", "start",
    ], { stdio: "ignore" });
    databaseUrl = `postgres://postgres@127.0.0.1:${databasePort}/postgres`;
    db = new Pool({ connectionString: databaseUrl });
    await db.query(`
      CREATE TABLE gallery_drawings (
        id varchar PRIMARY KEY,
        player_name text NOT NULL DEFAULT 'Anonymous',
        opponent_name text NOT NULL DEFAULT 'Unknown',
        strokes jsonb NOT NULL DEFAULT '[]'::jsonb,
        round_count integer NOT NULL DEFAULT 3,
        session_token text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE moderation_reports (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        report_type text NOT NULL,
        reason text NOT NULL,
        reporter_session_key text NOT NULL,
        target_player_key text,
        target_name text NOT NULL DEFAULT 'Unknown',
        gallery_drawing_id varchar REFERENCES gallery_drawings(id) ON DELETE SET NULL,
        game_id varchar,
        evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
        status text NOT NULL DEFAULT 'pending',
        alert_delivery_status text NOT NULL DEFAULT 'pending',
        alert_delivery_attempts integer NOT NULL DEFAULT 0,
        alert_delivery_next_attempt_at timestamptz DEFAULT now(),
        review_note text,
        created_at timestamptz NOT NULL DEFAULT now(),
        reviewed_at timestamptz
      )
    `);
    await db.query(
      "INSERT INTO gallery_drawings (id, player_name, opponent_name, strokes, session_token) VALUES ($1, $2, $3, $4, $5)",
      [GALLERY_DRAWING_ID, "Restart reporter target", "Opponent", JSON.stringify([]), REPORTER_TOKEN],
    );

    execFileSync("openssl", [
      "req", "-x509", "-newkey", "rsa:2048", "-nodes",
      "-keyout", privateKeyPath,
      "-out", certificatePath,
      "-subj", "/CN=127.0.0.1",
      "-days", "1",
    ], { stdio: "ignore" });
    const [cert, key] = await Promise.all([
      readFile(certificatePath),
      readFile(privateKeyPath),
    ]);
    webhook = createHttpsServer({ cert, key }, (request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        try {
          webhookRequests.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch {
          webhookRequests.push({});
        }
        response.writeHead(503);
        response.end("temporary test failure");
      });
    });
    await listen(webhook);
    const webhookAddress = webhook.address();
    if (!webhookAddress || typeof webhookAddress === "string") {
      throw new Error("Test webhook did not bind to a TCP port");
    }
    webhookUrl = `https://127.0.0.1:${webhookAddress.port}/notify`;
  }, TEST_TIMEOUT_MS);

  afterAll(async () => {
    for (const child of childProcesses) {
      await stopServer(child);
    }
    if (webhook) {
      await new Promise<void>((resolveClose, reject) => {
        webhook.close((error) => error ? reject(error) : resolveClose());
      });
    }
    if (db) await db.end();
    if (tempDir) {
      try {
        execFileSync("pg_ctl", ["-D", join(tempDir, "postgres"), "-m", "immediate", "-w", "stop"], {
          stdio: "ignore",
        });
      } catch {
        // The cluster may not have started if setup failed.
      }
      await rm(tempDir, { recursive: true, force: true });
    }
  }, TEST_TIMEOUT_MS);

  it("resumes a stored report across restarts and exhausts its persisted attempt limit", async () => {
    const firstServer = await startServer();
    const reportResponse = await fetch(`${firstServer.baseUrl}/api/reports`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": REPORTER_TOKEN,
      },
      body: JSON.stringify({
        reportType: "gallery",
        galleryDrawingId: GALLERY_DRAWING_ID,
        reason: "spam",
      }),
    });
    expect(reportResponse.status).toBe(201);

    await poll(() => Promise.resolve(webhookRequests.length === 1), "first webhook attempt");
    const created = await waitForReport((report) => (
      report.alert_delivery_status === "pending" && report.alert_delivery_attempts === 1
    ));
    const reportId = created.id;
    expect(created.alert_delivery_next_attempt_at).toBeInstanceOf(Date);
    expect(webhookRequests).toHaveLength(1);

    await stopServer(firstServer.process);
    await waitUntilDue(created.alert_delivery_next_attempt_at);

    const secondServer = await startServer();
    await poll(() => Promise.resolve(webhookRequests.length === 2), "second webhook attempt after restart");
    const secondAttempt = await waitForReport((report) => (
      report.id === reportId &&
      report.alert_delivery_status === "pending" &&
      report.alert_delivery_attempts === 2
    ));
    expect(webhookRequests).toHaveLength(2);
    expect(webhookRequests.every((request) => request.event === "moderation.report.created")).toBe(true);

    await stopServer(secondServer.process);
    await waitUntilDue(secondAttempt.alert_delivery_next_attempt_at);

    const thirdServer = await startServer();
    await poll(() => Promise.resolve(webhookRequests.length === 3), "third webhook attempt after restart");
    const failedReport = await waitForReport((report) => (
      report.id === reportId &&
      report.alert_delivery_status === "failed" &&
      report.alert_delivery_attempts === 3
    ));
    expect(failedReport.alert_delivery_next_attempt_at).toBeNull();
    expect(webhookRequests).toHaveLength(3);

    const visibleReportsResponse = await fetch(`${thirdServer.baseUrl}/api/moderation/reports`, {
      headers: { "x-moderation-admin-token": MODERATOR_TOKEN },
    });
    expect(visibleReportsResponse.status).toBe(200);
    const visibleReports = await visibleReportsResponse.json() as Array<{
      id: string;
      alertDeliveryStatus: string;
      alertDeliveryAttempts: number;
    }>;
    expect(visibleReports).toHaveLength(1);
    expect(visibleReports[0]).toMatchObject({
      id: reportId,
      alertDeliveryStatus: "failed",
      alertDeliveryAttempts: 3,
    });

    const [{ count }] = (await db.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM moderation_reports",
    )).rows;
    expect(count).toBe("1");
    await stopServer(thirdServer.process);
  }, TEST_TIMEOUT_MS);

  async function startServer(): Promise<{ process: ChildProcess; baseUrl: string; logs: () => string }> {
    const port = await findFreePort();
    const serverProcess = spawn(process.execPath, [
      resolve("node_modules/tsx/dist/cli.mjs"),
      "server/index.ts",
    ], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        MODERATION_NOTIFICATION_WEBHOOK_URL: webhookUrl,
        NODE_TLS_REJECT_UNAUTHORIZED: "0",
        NODE_ENV: "test",
        PORT: String(port),
        SESSION_SECRET: MODERATOR_TOKEN,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    childProcesses.add(serverProcess);
    let logs = "";
    serverProcess.stdout?.on("data", (chunk: Buffer) => {
      logs = `${logs}${chunk.toString()}`.slice(-8_000);
    });
    serverProcess.stderr?.on("data", (chunk: Buffer) => {
      logs = `${logs}${chunk.toString()}`.slice(-8_000);
    });

    const baseUrl = `http://127.0.0.1:${port}`;
    await poll(async () => {
      if (serverProcess.exitCode !== null) {
        throw new Error(`Test server exited before becoming ready:\n${logs}`);
      }
      try {
        const response = await fetch(`${baseUrl}/api/health`);
        return response.ok;
      } catch {
        return false;
      }
    }, "server to become ready");
    return { process: serverProcess, baseUrl, logs: () => logs };
  }

  async function waitForReport(predicate: (report: PersistedReport) => boolean): Promise<PersistedReport> {
    let latest: PersistedReport | undefined;
    await poll(async () => {
      const result = await db.query<PersistedReport>(
        `SELECT id, alert_delivery_status, alert_delivery_attempts, alert_delivery_next_attempt_at
         FROM moderation_reports`,
      );
      latest = result.rows[0];
      return Boolean(latest && predicate(latest));
    }, "expected persisted report delivery state");
    if (!latest) throw new Error("Report row was not found");
    return latest;
  }

  async function waitUntilDue(nextAttemptAt: Date | null): Promise<void> {
    if (!nextAttemptAt) throw new Error("Pending retry has no persisted next-attempt time");
    const waitMs = nextAttemptAt.getTime() - Date.now();
    if (waitMs > 0) await delay(waitMs + 25);
  }

  async function poll(condition: () => Promise<boolean>, description: string): Promise<void> {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      if (await condition()) return;
      await delay(50);
    }
    throw new Error(`Timed out waiting for ${description}`);
  }
});

async function findFreePort(): Promise<number> {
  const net = await import("node:net");
  const server = net.createServer();
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not allocate a test port");
  const port = address.port;
  await new Promise<void>((resolveClose, reject) => {
    server.close((error) => error ? reject(error) : resolveClose());
  });
  return port;
}

async function listen(server: ReturnType<typeof createHttpsServer>): Promise<void> {
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
}

async function stopServer(serverProcess: ChildProcess): Promise<void> {
  if (serverProcess.exitCode !== null || serverProcess.signalCode !== null) return;
  await new Promise<void>((resolveExit) => {
    const timeout = setTimeout(() => {
      serverProcess.kill("SIGKILL");
      resolveExit();
    }, 5_000);
    serverProcess.once("exit", () => {
      clearTimeout(timeout);
      resolveExit();
    });
    serverProcess.kill("SIGTERM");
  });
}
