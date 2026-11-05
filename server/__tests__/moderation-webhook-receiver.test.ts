import { createHmac } from "node:crypto";
import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, describe, expect, it } from "vitest";
import {
  createIdempotentAlertProcessor,
  createWebhookServer,
} from "../../docs/moderation-webhook-receiver.mjs";

const webhookSecret = "receiver-test-secret";
const testDirectories: string[] = [];

type DurableState = {
  idempotencyKeys: string[];
  businessActions: Array<{ idempotencyKey: string; event: string }>;
};

type AlertPayload = { idempotencyKey: string; event: string };
type AlertTransaction = {
  recordIdempotencyKeyIfAbsent: (key: string) => boolean;
  recordBusinessAction: (payload: AlertPayload) => void;
};

function createDurableTestAdapter(directory: string) {
  const statePath = path.join(directory, "state.json");
  const lockPath = path.join(directory, "transaction.lock");

  return {
    async runTransaction<T>(callback: (tx: AlertTransaction) => Promise<T>) {
      let lockAcquired = false;
      const deadline = Date.now() + 5_000;
      while (!lockAcquired) {
        try {
          await mkdir(lockPath);
          lockAcquired = true;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
          if (Date.now() >= deadline) throw new Error("Timed out waiting for test transaction lock");
          await delay(5);
        }
      }

      try {
        let state: DurableState;
        try {
          state = JSON.parse(await readFile(statePath, "utf8")) as DurableState;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          state = { idempotencyKeys: [], businessActions: [] };
        }

        const tx = {
          recordIdempotencyKeyIfAbsent(key: string) {
            if (state.idempotencyKeys.includes(key)) return false;
            state.idempotencyKeys.push(key);
            return true;
          },
          recordBusinessAction(payload: { idempotencyKey: string; event: string }) {
            state.businessActions.push({
              idempotencyKey: payload.idempotencyKey,
              event: payload.event,
            });
          },
        };

        const result = await callback(tx);
        const temporaryPath = `${statePath}.${process.pid}.${Date.now()}.tmp`;
        await writeFile(temporaryPath, JSON.stringify(state));
        await rename(temporaryPath, statePath);
        return result;
      } finally {
        await rm(lockPath, { recursive: true, force: true });
      }
    },
    async readState(): Promise<DurableState> {
      try {
        return JSON.parse(await readFile(statePath, "utf8")) as DurableState;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return { idempotencyKeys: [], businessActions: [] };
        }
        throw error;
      }
    },
  };
}

function createProcessor(directory: string) {
  const adapter = createDurableTestAdapter(directory);
  const processor = createIdempotentAlertProcessor({
    runTransaction: adapter.runTransaction,
    performBusinessAction: async (payload: AlertPayload, tx: AlertTransaction) => {
      tx.recordBusinessAction(payload);
    },
  });
  return { adapter, processor };
}

async function startReceiver(processAlert: (payload: unknown) => Promise<void>) {
  const server = createWebhookServer([webhookSecret], processAlert);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Receiver did not bind a TCP port");

  return {
    async deliver(idempotencyKey: string) {
      const payload = {
        event: "moderation.report.created",
        idempotencyKey,
      };
      const body = JSON.stringify(payload);
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = createHmac("sha256", webhookSecret)
        .update(timestamp)
        .update(".")
        .update(body)
        .digest("hex");

      return fetch(`http://127.0.0.1:${address.port}/webhook`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-sketchduel-timestamp": timestamp,
          "x-sketchduel-signature": `v1=${signature}`,
        },
        body,
      });
    },
    close() {
      return new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    },
  };
}

afterEach(async () => {
  await Promise.all(testDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true }),
  ));
});

async function createTestDirectory() {
  const directory = await mkdtemp(path.join(tmpdir(), "moderation-receiver-"));
  testDirectories.push(directory);
  return directory;
}

describe("moderation webhook receiver idempotency", () => {
  it("acknowledges a repeated key after receiver restart without repeating the action", async () => {
    const directory = await createTestDirectory();
    const first = createProcessor(directory);
    const firstReceiver = await startReceiver(first.processor);

    const initialResponse = await firstReceiver.deliver("report-stable-key");
    expect(initialResponse.status).toBe(204);
    await firstReceiver.close();

    // Recreate both the storage adapter and receiver, preserving only durable files.
    const restarted = createProcessor(directory);
    const restartedReceiver = await startReceiver(restarted.processor);
    const duplicateResponse = await restartedReceiver.deliver("report-stable-key");
    expect(duplicateResponse.status).toBe(204);
    await restartedReceiver.close();

    const state = await restarted.adapter.readState();
    expect(state.idempotencyKeys).toEqual(["report-stable-key"]);
    expect(state.businessActions).toEqual([{
      idempotencyKey: "report-stable-key",
      event: "moderation.report.created",
    }]);
  });

  it("allows only one business action when independent processors claim concurrently", async () => {
    const directory = await createTestDirectory();
    const processors = Array.from({ length: 12 }, () => createProcessor(directory));

    await Promise.all(processors.map(({ processor }) => processor({
      event: "moderation.report.created",
      idempotencyKey: "concurrent-report-key",
    })));

    const state = await processors[0].adapter.readState();
    expect(state.idempotencyKeys).toEqual(["concurrent-report-key"]);
    expect(state.businessActions).toEqual([{
      idempotencyKey: "concurrent-report-key",
      event: "moderation.report.created",
    }]);
  });
});
