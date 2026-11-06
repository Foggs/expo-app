import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

export type IsolatedDatabase = {
  databaseUrl: string;
  stop: () => Promise<void>;
};

export type RunningServer = {
  process: ChildProcess;
  baseUrl: string;
  wsUrl: string;
  logs: () => string;
};

/**
 * Starts a throwaway Postgres cluster in a temp directory and applies the
 * app's real Drizzle schema to it. Stopping it deletes every row and file the
 * test created, so integration tests never touch the development database.
 */
export async function startIsolatedDatabase(): Promise<IsolatedDatabase> {
  const tempDir = await mkdtemp(join(tmpdir(), "sketchduel-it-"));
  const databaseDir = join(tempDir, "postgres");
  const socketDir = join(tempDir, "socket");
  await Promise.all([mkdir(databaseDir), mkdir(socketDir)]);

  const stop = async () => {
    try {
      execFileSync("pg_ctl", ["-D", databaseDir, "-m", "immediate", "-w", "stop"], { stdio: "ignore" });
    } catch {
      // The cluster may not have started if setup failed.
    }
    await rm(tempDir, { recursive: true, force: true });
  };

  try {
    execFileSync("initdb", [
      "-D", databaseDir,
      "--auth-local=trust",
      "--auth-host=trust",
      "--username=postgres",
      "--no-locale",
      "--encoding=UTF8",
    ], { stdio: "ignore" });

    const port = await findFreePort();
    execFileSync("pg_ctl", [
      "-D", databaseDir,
      "-o", `-h 127.0.0.1 -p ${port} -k ${socketDir} -F`,
      "-l", join(tempDir, "postgres.log"),
      "-w", "start",
    ], { stdio: "ignore" });
    const databaseUrl = `postgres://postgres@127.0.0.1:${port}/postgres`;

    execFileSync(process.execPath, [resolve("node_modules/drizzle-kit/bin.cjs"), "push", "--force"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "pipe",
    });

    return { databaseUrl, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}

/**
 * Runs the real Express + WebSocket server as its own process. tsx is loaded
 * in-process (not via its CLI, which forks a child) so signals reach the server.
 */
export async function startServer(env: Record<string, string>): Promise<RunningServer> {
  const port = await findFreePort();
  const serverProcess = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: "test", PORT: String(port), ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  const appendLog = (chunk: Buffer) => {
    logs = `${logs}${chunk.toString()}`.slice(-8_000);
  };
  serverProcess.stdout?.on("data", appendLog);
  serverProcess.stderr?.on("data", appendLog);

  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await poll(async () => {
      if (serverProcess.exitCode !== null) {
        throw new Error(`Test server exited before becoming ready:\n${logs}`);
      }
      try {
        return (await fetch(`${baseUrl}/api/health`)).ok;
      } catch {
        return false;
      }
    }, "server to become ready", 30_000);
  } catch (error) {
    await stopServer(serverProcess);
    throw error;
  }
  return { process: serverProcess, baseUrl, wsUrl: `ws://127.0.0.1:${port}/ws`, logs: () => logs };
}

export async function stopServer(serverProcess: ChildProcess): Promise<void> {
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

export async function poll(
  condition: () => Promise<boolean>,
  description: string,
  timeoutMs = 15_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await condition()) return;
    await delay(50);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

export async function findFreePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not allocate a test port");
  const port = address.port;
  await new Promise<void>((resolveClose, reject) => {
    server.close((error) => (error ? reject(error) : resolveClose()));
  });
  return port;
}
