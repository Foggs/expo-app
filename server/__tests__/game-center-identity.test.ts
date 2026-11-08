import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import express from "express";
import type { Pool } from "pg";
import WebSocket from "ws";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createGameCenterVerifier } from "../gameCenterVerifier";
import { getSessionKey } from "../sessionIdentity";
import { startIsolatedDatabase, type IsolatedDatabase } from "./support/realServer";
import {
  generateTestCertificates,
  signTestProof,
  TEST_INTERMEDIATE_URL,
  type TestCertificateSet,
} from "./support/testCertificates";

// Game Center linking against real routes, real WebSocket matchmaking and a
// throwaway Postgres database. Identity proofs are signed with locally
// generated certificates and checked by the real verifier.

const BUNDLE_ID = "com.sketchduel.app";
const TEST_TIMEOUT_MS = 60_000;
const MESSAGE_TIMEOUT_MS = 10_000;
const NO_MATCH_WAIT_MS = 1_500;

type ServerMessage = { type: string; [key: string]: unknown };
type StorageModule = typeof import("../storage");

let certs: TestCertificateSet;
let database: IsolatedDatabase;
let previousDatabaseUrl: string | undefined;
let httpServer: Server;
let wss: ReturnType<typeof import("../websocket").setupWebSocket>;
let appPool: Pool;
let storage: StorageModule["storage"];
let baseUrl: string;
let wsUrl: string;

function newDeviceToken(): string {
  return randomBytes(32).toString("hex");
}

function deviceKeyFor(token: string): string {
  const key = getSessionKey(token);
  if (!key) throw new Error("Test device token is not a valid session token");
  return key;
}

function proofFor(playerId: string, overrides: { timestamp?: number; bundleId?: string } = {}) {
  return signTestProof({
    signer: certs.appleSigner,
    playerId,
    bundleId: overrides.bundleId ?? BUNDLE_ID,
    timestamp: overrides.timestamp ?? Date.now(),
  });
}

async function api(method: string, path: string, body?: unknown, token?: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(token ? { "x-session-token": token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) as Record<string, unknown> : {} };
}

function linkGameCenter(token: string, proof: ReturnType<typeof proofFor>) {
  return api("POST", "/api/identity/game-center", proof, token);
}

async function saveDrawing(token: string): Promise<string> {
  const response = await api("POST", "/api/gallery", {
    playerName: "You",
    opponentName: "Rival",
    strokes: [{ id: "s1", path: "M1 1 L2 2", color: "#000000", strokeWidth: 4 }],
    roundCount: 3,
    sessionToken: token,
  });
  expect(response.status).toBe(201);
  return response.body.id as string;
}

async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const result = await appPool.query(sql, params);
  return result.rows as T[];
}

/** A WebSocket client that records every server message it receives. */
class TestPlayer {
  readonly messages: ServerMessage[] = [];
  private waiters: Array<() => void> = [];

  private constructor(private readonly ws: WebSocket) {
    ws.on("message", (data) => {
      this.messages.push(JSON.parse(data.toString()) as ServerMessage);
      for (const wake of this.waiters.splice(0)) wake();
    });
  }

  /** Authenticates and joins the queue in the same tick, as the app does on open. */
  static async queue(deviceToken: string): Promise<TestPlayer> {
    const ws = new WebSocket(wsUrl);
    await new Promise<void>((resolveOpen, reject) => {
      ws.once("open", () => resolveOpen());
      ws.once("error", reject);
    });
    const player = new TestPlayer(ws);
    player.send({ type: "authenticate", sessionToken: deviceToken });
    player.send({ type: "join_queue" });
    await player.waitFor("queue_joined");
    return player;
  }

  send(message: Record<string, unknown>): void {
    this.ws.send(JSON.stringify(message));
  }

  received(type: string): ServerMessage[] {
    return this.messages.filter((message) => message.type === type);
  }

  async waitFor(type: string): Promise<ServerMessage> {
    const deadline = Date.now() + MESSAGE_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const found = this.messages.find((message) => message.type === type);
      if (found) return found;
      await new Promise<void>((wake) => {
        const timer = setTimeout(wake, 100);
        this.waiters.push(() => {
          clearTimeout(timer);
          wake();
        });
      });
    }
    throw new Error(`Timed out waiting for ${type}; received ${JSON.stringify(this.messages)}`);
  }

  async close(): Promise<void> {
    if (this.ws.readyState === WebSocket.CLOSED) return;
    await new Promise<void>((resolveClose) => {
      this.ws.once("close", () => resolveClose());
      this.ws.close();
    });
  }
}

async function closeAll(players: TestPlayer[]): Promise<void> {
  await Promise.all(players.map((player) => player.close()));
  // Give the server a moment to process the disconnects and drop them from the queue.
  await new Promise((resolveWait) => setTimeout(resolveWait, 200));
}

beforeAll(async () => {
  certs = generateTestCertificates();
  database = await startIsolatedDatabase();
  previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = database.databaseUrl;

  // Imported after DATABASE_URL points at the throwaway database.
  const [{ registerRoutes }, { setupWebSocket }, storageModule, dbModule] = await Promise.all([
    import("../routes"),
    import("../websocket"),
    import("../storage"),
    import("../db"),
  ]);
  storage = storageModule.storage;
  appPool = dbModule.pool as Pool;

  const gameCenterVerifier = createGameCenterVerifier({
    bundleIds: [BUNDLE_ID],
    trustedRoots: [certs.root],
    fetchCertificate: async (url) => (url === TEST_INTERMEDIATE_URL ? certs.intermediateDer : certs.appleSigner.der),
  });

  const app = express();
  app.use(express.json({ limit: "2mb" }));
  httpServer = await registerRoutes(app, { gameCenterVerifier, identityLinksPerMinute: 1_000 });
  wss = setupWebSocket(httpServer);
  await new Promise<void>((resolveListen) => httpServer.listen(0, "127.0.0.1", resolveListen));
  const address = httpServer.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind to a TCP port");
  baseUrl = `http://127.0.0.1:${address.port}`;
  wsUrl = `ws://127.0.0.1:${address.port}/ws`;
}, TEST_TIMEOUT_MS);

afterAll(async () => {
  if (wss) {
    for (const client of wss.clients) client.terminate();
    await new Promise<void>((resolveClose) => wss.close(() => resolveClose()));
  }
  if (httpServer?.listening) {
    await new Promise<void>((resolveClose) => httpServer.close(() => resolveClose()));
  }
  await appPool?.end();
  await database?.stop();
  certs?.cleanup();
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
}, TEST_TIMEOUT_MS);

describe("Game Center sign-in", () => {
  const PLAYER = "T:_integration-player";
  const tokenA = newDeviceToken();
  const tokenB = newDeviceToken();
  const opponentToken = newDeviceToken();
  const earlyBlockerToken = newDeviceToken();
  let accountKey: string;
  let sharedGameId: string;
  let drawingId: string;
  let legacyDrawingId: string;

  it("links the first device and keeps its history with the account", async () => {
    const keyA = deviceKeyFor(tokenA);
    sharedGameId = (await storage.createGame(undefined, keyA, deviceKeyFor(opponentToken))).id;
    await storage.createGame(undefined, deviceKeyFor(earlyBlockerToken), keyA);
    drawingId = await saveDrawing(tokenA);
    // Rows saved before owner keys existed stored the raw device token.
    [{ id: legacyDrawingId }] = await query<{ id: string }>(
      "insert into gallery_drawings (player_name, strokes, session_token) values ('You', '[]', $1) returning id",
      [tokenA],
    );

    const linked = await linkGameCenter(tokenA, proofFor(PLAYER));
    expect(linked).toEqual({ status: 200, body: { linked: true, isNewAccount: true } });

    const [account] = await query<{ player_key: string }>(
      "select player_key from player_accounts where game_center_player_id = $1",
      [PLAYER],
    );
    accountKey = account.player_key;
    expect(accountKey).toMatch(/^[a-f0-9]{64}$/);
    expect(accountKey).not.toBe(keyA);
    expect(await storage.resolvePlayerIdentity(keyA)).toEqual({
      playerKey: accountKey,
      aliasKeys: expect.arrayContaining([accountKey, keyA]),
      gameCenterPlayerId: PLAYER,
    });
  }, TEST_TIMEOUT_MS);

  it("rejects forged, wrong-app, stale and replayed proofs without linking", async () => {
    const token = newDeviceToken();
    const otherToken = newDeviceToken();
    const forged = proofFor("T:_forged");
    const signature = Buffer.from(forged.signature, "base64");
    signature[0] ^= 0xff;

    expect((await linkGameCenter(token, { ...forged, signature: signature.toString("base64") })).status).toBe(401);
    expect((await linkGameCenter(token, proofFor("T:_forged", { bundleId: "com.other.app" }))).status).toBe(401);
    expect((await linkGameCenter(token, proofFor("T:_forged", { timestamp: Date.now() - 10 * 60_000 }))).status).toBe(401);

    const proof = proofFor("T:_replayed");
    expect((await linkGameCenter(token, proof)).status).toBe(200);
    expect((await linkGameCenter(otherToken, proof)).status).toBe(401);

    const links = await query<{ device_key: string }>(
      "select device_key from player_device_links where device_key = any($1)",
      [[deviceKeyFor(token), deviceKeyFor(otherToken)]],
    );
    expect(links.map((row) => row.device_key)).toEqual([deviceKeyFor(token)]);
    const accounts = await query<{ game_center_player_id: string }>(
      "select game_center_player_id from player_accounts where game_center_player_id = 'T:_forged'",
    );
    expect(accounts).toEqual([]);
  }, TEST_TIMEOUT_MS);

  it("recognizes the same player on a second device, with blocks, reports and gallery ownership", async () => {
    const linked = await linkGameCenter(tokenB, proofFor(PLAYER));
    expect(linked).toEqual({ status: 200, body: { linked: true, isNewAccount: false } });

    // Gallery drawings saved on device A belong to the player on device B.
    expect((await api("DELETE", `/api/gallery/${drawingId}`, undefined, tokenB)).status).toBe(200);
    expect((await api("DELETE", `/api/gallery/${legacyDrawingId}`, undefined, tokenB)).status).toBe(200);

    // Device B can report and block an opponent the player met on device A.
    const report = await api("POST", "/api/reports", { reportType: "match", gameId: sharedGameId, reason: "harassment" }, tokenB);
    expect(report.status).toBe(201);
    const [reportRow] = await query<{ reporter_session_key: string; target_player_key: string }>(
      "select reporter_session_key, target_player_key from moderation_reports where game_id = $1",
      [sharedGameId],
    );
    expect(reportRow).toEqual({ reporter_session_key: accountKey, target_player_key: deviceKeyFor(opponentToken) });

    const block = await api("POST", "/api/blocks", { blockedPlayerId: deviceKeyFor(opponentToken) }, tokenB);
    expect(block.status).toBe(201);

    // Someone who met device A before it linked blocks using the old device key.
    const earlyBlock = await api("POST", "/api/blocks", { blockedPlayerId: deviceKeyFor(tokenA) }, earlyBlockerToken);
    expect(earlyBlock.status).toBe(201);
    const blocks = await query<{ blocker_session_key: string; blocked_player_key: string }>(
      "select blocker_session_key, blocked_player_key from player_blocks order by created_at",
    );
    expect(blocks).toEqual([
      { blocker_session_key: accountKey, blocked_player_key: deviceKeyFor(opponentToken) },
      { blocker_session_key: deviceKeyFor(earlyBlockerToken), blocked_player_key: accountKey },
    ]);
  }, TEST_TIMEOUT_MS);

  it("matches both devices as one player and keeps blocked players apart", async () => {
    const players: TestPlayer[] = [];
    try {
      const deviceA = await TestPlayer.queue(tokenA);
      const deviceB = await TestPlayer.queue(tokenB);
      const opponent = await TestPlayer.queue(opponentToken);
      players.push(deviceA, deviceB, opponent);
      await new Promise((resolveWait) => setTimeout(resolveWait, NO_MATCH_WAIT_MS));
      for (const player of players) {
        expect(player.received("match_found")).toEqual([]);
      }

      const stranger = await TestPlayer.queue(newDeviceToken());
      players.push(stranger);
      const strangerMatch = await stranger.waitFor("match_found");
      const deviceMatch = await deviceA.waitFor("match_found");
      expect(strangerMatch.opponentPlayerId).toBe(accountKey);
      expect(deviceMatch.gameId).toBe(strangerMatch.gameId);
      const [game] = await query<{ player1_session_key: string; player2_session_key: string }>(
        "select player1_session_key, player2_session_key from games where id = $1",
        [deviceMatch.gameId],
      );
      expect(game.player1_session_key).toBe(accountKey);

      expect(opponent.received("match_found")).toEqual([]);
      await closeAll([opponent]);

      // A block placed against device A's old key also keeps device B apart.
      const earlyBlocker = await TestPlayer.queue(earlyBlockerToken);
      players.push(earlyBlocker);
      await new Promise((resolveWait) => setTimeout(resolveWait, NO_MATCH_WAIT_MS));
      for (const player of [deviceB, earlyBlocker]) {
        expect(player.received("match_found")).toEqual([]);
      }
    } finally {
      await closeAll(players);
    }
  }, TEST_TIMEOUT_MS);
});

describe("Shared devices and open connections", () => {
  it("never moves a linked device to a different player, and lets the app retry with a fresh token", async () => {
    const sharedToken = newDeviceToken();
    expect((await linkGameCenter(sharedToken, proofFor("T:_shared-alice"))).status).toBe(200);
    const alice = await storage.resolvePlayerIdentity(deviceKeyFor(sharedToken));
    const drawing = await saveDrawing(sharedToken);

    // Bob signs in on the same phone while it still holds Alice's token.
    const bobProof = proofFor("T:_shared-bob");
    const conflict = await linkGameCenter(sharedToken, bobProof);
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe("DEVICE_LINKED_TO_OTHER_PLAYER");
    expect(await storage.resolvePlayerIdentity(deviceKeyFor(sharedToken))).toEqual(alice);
    expect(await query("select 1 from player_accounts where game_center_player_id = 'T:_shared-bob'")).toEqual([]);

    // The app replaces its token and retries with the same proof.
    const freshToken = newDeviceToken();
    expect((await linkGameCenter(freshToken, bobProof)).status).toBe(200);
    const bob = await storage.resolvePlayerIdentity(deviceKeyFor(freshToken));
    expect(bob.playerKey).not.toBe(alice.playerKey);
    expect(bob.aliasKeys).not.toContain(deviceKeyFor(sharedToken));

    // Bob's fresh token cannot touch Alice's drawings; Alice's old token still can.
    expect((await api("DELETE", `/api/gallery/${drawing}`, undefined, freshToken)).status).toBe(403);
    expect((await api("DELETE", `/api/gallery/${drawing}`, undefined, sharedToken)).status).toBe(200);
  }, TEST_TIMEOUT_MS);

  it("applies a new link to a connection that is already waiting for a match", async () => {
    const players: TestPlayer[] = [];
    try {
      const existingDevice = newDeviceToken();
      expect((await linkGameCenter(existingDevice, proofFor("T:_live-carol"))).status).toBe(200);
      const carol = await storage.resolvePlayerIdentity(deviceKeyFor(existingDevice));
      const blockerToken = newDeviceToken();
      await storage.createGame(undefined, carol.playerKey, deviceKeyFor(blockerToken));
      expect((await api("POST", "/api/blocks", { blockedPlayerId: carol.playerKey }, blockerToken)).status).toBe(201);

      // A new phone connects and queues before it is linked to Carol.
      const newPhoneToken = newDeviceToken();
      const newPhone = await TestPlayer.queue(newPhoneToken);
      players.push(newPhone);
      expect((await linkGameCenter(newPhoneToken, proofFor("T:_live-carol"))).status).toBe(200);

      // Carol's blocker is kept apart without the phone reconnecting.
      const blocker = await TestPlayer.queue(blockerToken);
      players.push(blocker);
      await new Promise((resolveWait) => setTimeout(resolveWait, NO_MATCH_WAIT_MS));
      expect(newPhone.received("match_found")).toEqual([]);
      expect(blocker.received("match_found")).toEqual([]);
      await closeAll([blocker]);

      // And the phone is matched as Carol's account.
      const stranger = await TestPlayer.queue(newDeviceToken());
      players.push(stranger);
      const strangerMatch = await stranger.waitFor("match_found");
      expect(strangerMatch.opponentPlayerId).toBe(carol.playerKey);
    } finally {
      await closeAll(players);
    }
  }, TEST_TIMEOUT_MS);
});

describe("Players who do not sign in to Game Center", () => {
  it("keep playing, saving and deleting with their device identity", async () => {
    const tokenC = newDeviceToken();
    const tokenD = newDeviceToken();

    expect((await api("POST", "/api/identity/game-center", proofFor("T:_no-token"))).status).toBe(401);
    expect((await api("POST", "/api/identity/game-center", { playerId: "T:_x" }, tokenC)).status).toBe(400);

    const playerC = await TestPlayer.queue(tokenC);
    const playerD = await TestPlayer.queue(tokenD);
    const [matchC, matchD] = await Promise.all([playerC.waitFor("match_found"), playerD.waitFor("match_found")]);
    expect(matchC.opponentPlayerId).toBe(deviceKeyFor(tokenD));
    expect(matchD.opponentPlayerId).toBe(deviceKeyFor(tokenC));
    await closeAll([playerC, playerD]);

    const drawing = await saveDrawing(tokenC);
    expect((await api("DELETE", `/api/gallery/${drawing}`, undefined, tokenD)).status).toBe(403);
    expect((await api("DELETE", `/api/gallery/${drawing}`, undefined, tokenC)).status).toBe(200);

    const links = await query<{ device_key: string }>(
      "select device_key from player_device_links where device_key = any($1)",
      [[deviceKeyFor(tokenC), deviceKeyFor(tokenD)]],
    );
    expect(links).toEqual([]);
  }, TEST_TIMEOUT_MS);

  it("never exposes owner keys or device tokens in the public gallery", async () => {
    await saveDrawing(newDeviceToken());
    const gallery = await api("GET", "/api/gallery");
    const drawings = gallery.body as unknown as Record<string, unknown>[];
    expect(drawings.length).toBeGreaterThan(0);
    for (const drawing of drawings) {
      expect(drawing).not.toHaveProperty("ownerPlayerKey");
      expect(drawing).not.toHaveProperty("sessionToken");
    }
  }, TEST_TIMEOUT_MS);
});
