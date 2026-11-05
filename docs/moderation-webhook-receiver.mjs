import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

const MAX_BODY_BYTES = 64 * 1024;
const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

/**
 * Verify the exact request bytes before decoding or parsing the JSON body.
 * Pass all active secrets here while rotating signing secrets.
 */
export function verifySketchDuelSignature({
  rawBody,
  timestamp,
  signature,
  secrets,
  nowSeconds = Math.floor(Date.now() / 1000),
}) {
  if (typeof timestamp !== "string" || !/^\d+$/.test(timestamp)) return false;
  if (typeof signature !== "string" || !/^v1=[a-f0-9]{64}$/.test(signature)) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isSafeInteger(timestampSeconds)
    || Math.abs(nowSeconds - timestampSeconds) > TIMESTAMP_TOLERANCE_SECONDS) {
    return false;
  }

  const receivedDigest = Buffer.from(signature.slice(3), "hex");
  let verified = false;
  for (const secret of secrets) {
    if (typeof secret !== "string" || secret.length === 0) continue;
    const expectedDigest = createHmac("sha256", secret)
      .update(timestamp)
      .update(".")
      .update(rawBody)
      .digest();
    const matches = receivedDigest.length === expectedDigest.length
      && timingSafeEqual(receivedDigest, expectedDigest);
    verified = matches || verified;
  }
  return verified;
}

/**
 * Build a processor around the receiver owner's durable storage adapter.
 *
 * runTransaction(callback) must run callback in a durable transaction.
 * tx.recordIdempotencyKeyIfAbsent(key) must atomically insert a
 * unique key and return true only when this transaction inserted it.
 * performBusinessAction must use the same transaction for database changes.
 *
 * If the key already exists, skip the action and return normally: the webhook
 * will be acknowledged as a successful duplicate.
 */
export function createIdempotentAlertProcessor({ runTransaction, performBusinessAction }) {
  if (typeof runTransaction !== "function" || typeof performBusinessAction !== "function") {
    throw new TypeError("Provide a transaction adapter and business action");
  }

  return async (payload) => {
    await runTransaction(async (tx) => {
      const isFirstDelivery = await tx.recordIdempotencyKeyIfAbsent(payload.idempotencyKey);
      if (!isFirstDelivery) return;
      await performBusinessAction(payload, tx);
    });
  };
}

async function readRawBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("request body too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function createWebhookServer(secrets, processAlert = async () => {
  throw new Error("Configure a durable report-alert processor before accepting alerts");
}) {
  if (typeof processAlert !== "function") {
    throw new TypeError("processAlert must be a function");
  }
  return createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/webhook") {
      response.writeHead(404).end("Not found");
      return;
    }

    let rawBody;
    try {
      rawBody = await readRawBody(request);
    } catch {
      response.writeHead(413).end("Request body too large");
      return;
    }

    const timestamp = request.headers["x-sketchduel-timestamp"];
    const signature = request.headers["x-sketchduel-signature"];
    if (!verifySketchDuelSignature({ rawBody, timestamp, signature, secrets })) {
      response.writeHead(401).end("Invalid webhook signature");
      return;
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      response.writeHead(400).end("Invalid JSON");
      return;
    }
    if (payload.event !== "moderation.report.created"
      || typeof payload.idempotencyKey !== "string") {
      response.writeHead(400).end("Unexpected webhook event");
      return;
    }

    try {
      await processAlert(payload);
    } catch (error) {
      console.error("Could not durably process SketchDuel report alert:", error);
      response.writeHead(500).end("Alert processing failed");
      return;
    }
    response.writeHead(204).end();
  });
}

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMainModule) {
  const secrets = [
    process.env.SKETCHDUEL_WEBHOOK_SECRET_CURRENT,
    process.env.SKETCHDUEL_WEBHOOK_SECRET_NEXT,
  ].filter((secret) => typeof secret === "string" && secret.length > 0);
  if (secrets.length === 0) {
    throw new Error("Set SKETCHDUEL_WEBHOOK_SECRET_CURRENT before starting the receiver");
  }
  const port = Number(process.env.PORT || 8080);
  createWebhookServer(secrets).listen(port, () => {
    console.log(`SketchDuel webhook receiver listening on port ${port}`);
  });
}
