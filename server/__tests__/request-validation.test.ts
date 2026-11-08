import express from "express";
import { createServer, type Server } from "node:http";
import WebSocket from "ws";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { registerRoutes } from "../routes";
import { setupWebSocket } from "../websocket";

// Invalid input must be rejected at the edge (HTTP routes and the WebSocket)
// before anything reaches the database.

const storageCalls = vi.hoisted(() => [] as string[]);

vi.mock("../storage", () => ({
  storage: new Proxy({}, {
    get: (_target, method: string) => async (key?: unknown) => {
      storageCalls.push(method);
      if (method === "resolvePlayerIdentity") {
        return { playerKey: key, aliasKeys: [key], gameCenterPlayerId: null };
      }
      return undefined;
    },
  }),
}));

const SESSION_TOKEN = "d".repeat(64);
const MODERATOR_TOKEN = "request-validation-moderator-token";

describe("HTTP route validation", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    vi.stubEnv("SESSION_SECRET", MODERATOR_TOKEN);
    const app = express();
    // Mirrors the production body parser limits in server/index.ts.
    app.use(express.json({ limit: "2mb" }));
    server = await registerRoutes(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind to a TCP port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  });

  beforeEach(() => {
    storageCalls.length = 0;
  });

  function send(method: string, path: string, body: unknown, headers: Record<string, string> = {}) {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  }

  it("rejects invalid gallery saves with per-field errors", async () => {
    const response = await send("POST", "/api/gallery", {
      strokes: [{ id: "s", path: "M0 0", color: "#000", strokeWidth: 0 }],
      roundCount: 99,
    });
    expect(response.status).toBe(400);
    const body = await response.json() as { message: string; errors: Record<string, string[]> };
    expect(body.message).toBe("Invalid drawing data");
    expect(Object.keys(body.errors).sort()).toEqual(["roundCount", "strokes"]);
    expect(body.errors.roundCount.every((message) => typeof message === "string")).toBe(true);
    expect(storageCalls).toEqual([]);
  });

  it("rejects gallery saves with too many strokes", async () => {
    const strokes = Array.from({ length: 501 }, (_, i) => ({ id: `s${i}`, path: "M0 0", color: "#000", strokeWidth: 2 }));
    const response = await send("POST", "/api/gallery", { strokes });
    expect(response.status).toBe(400);
    expect(storageCalls).toEqual([]);
  });

  it("rejects invalid content reports", async () => {
    const headers = { "x-session-token": SESSION_TOKEN };
    for (const body of [
      { reportType: "gallery", galleryDrawingId: "d1", reason: "made-up" },
      { reportType: "match", reason: "spam" },
      { reportType: "unknown", gameId: "g1", reason: "spam" },
      { reportType: "match", gameId: "g1", reason: "spam", extra: true },
    ]) {
      const response = await send("POST", "/api/reports", body, headers);
      expect(response.status).toBe(400);
      const parsed = await response.json() as { message: string; errors: unknown };
      expect(parsed.message).toBe("Invalid report");
      expect(typeof parsed.errors).toBe("object");
    }
    expect(storageCalls).toEqual([]);
  });

  it("rejects invalid player blocks and moderator reviews", async () => {
    const block = await send("POST", "/api/blocks", { blockedPlayerId: "XYZ" }, { "x-session-token": SESSION_TOKEN });
    expect(block.status).toBe(400);

    const review = await send(
      "PATCH",
      "/api/moderation/reports/r1",
      { status: "deleted" },
      { "x-moderation-admin-token": MODERATOR_TOKEN },
    );
    expect(review.status).toBe(400);
    expect(storageCalls).toEqual([]);
  });

  it("lets valid bodies through to storage", async () => {
    const response = await send("POST", "/api/reports", {
      reportType: "gallery",
      galleryDrawingId: "missing-drawing",
      reason: "spam",
    }, { "x-session-token": SESSION_TOKEN });
    expect(response.status).toBe(404);
    expect(storageCalls).toEqual(["resolvePlayerIdentity", "getGalleryDrawing"]);
  });
});

describe("WebSocket message validation", () => {
  let server: Server;
  let wss: ReturnType<typeof setupWebSocket>;
  let wsUrl: string;

  beforeAll(async () => {
    server = createServer();
    wss = setupWebSocket(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind to a TCP port");
    wsUrl = `ws://127.0.0.1:${address.port}/ws`;
  });

  afterAll(async () => {
    for (const client of wss.clients) client.terminate();
    await new Promise<void>((resolve) => wss.close(() => resolve()));
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  });

  async function connect(): Promise<{ ws: WebSocket; next: () => Promise<Record<string, unknown>>; closed: Promise<number> }> {
    const ws = new WebSocket(wsUrl);
    const queue: Record<string, unknown>[] = [];
    const waiting: Array<(message: Record<string, unknown>) => void> = [];
    ws.on("message", (data) => {
      const message = JSON.parse(data.toString()) as Record<string, unknown>;
      const waiter = waiting.shift();
      if (waiter) waiter(message);
      else queue.push(message);
    });
    const closed = new Promise<number>((resolve) => ws.once("close", (code) => resolve(code)));
    await new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", reject);
    });
    const next = () => {
      const queued = queue.shift();
      if (queued) return Promise.resolve(queued);
      return new Promise<Record<string, unknown>>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("No server message received")), 5_000);
        waiting.push((message) => {
          clearTimeout(timer);
          resolve(message);
        });
      });
    };
    return { ws, next, closed };
  }

  it("answers malformed JSON and schema violations with error codes", async () => {
    const client = await connect();
    client.ws.send("{not json");
    expect(await client.next()).toMatchObject({ type: "error", code: "INVALID_JSON" });

    for (const message of [
      { type: "teleport" },
      { type: "ping", extra: 1 },
      { type: "authenticate", sessionToken: "short" },
      { type: "join_room", roomCode: "??" },
      { type: "draw_stroke", stroke: { id: "s", path: "x".repeat(50_001), color: "#000", strokeWidth: 4 } },
    ]) {
      client.ws.send(JSON.stringify(message));
      expect(await client.next()).toMatchObject({ type: "error", code: "VALIDATION_FAILED" });
    }
    client.ws.close();
  });

  it("closes connections that send game actions before authenticating", async () => {
    const client = await connect();
    client.ws.send(JSON.stringify({ type: "join_queue" }));
    expect(await client.closed).toBe(1008);
  });

  it("accepts a valid authenticated session", async () => {
    const client = await connect();
    client.ws.send(JSON.stringify({ type: "authenticate", sessionToken: SESSION_TOKEN }));
    client.ws.send(JSON.stringify({ type: "ping" }));
    expect(await client.next()).toEqual({ type: "pong" });
    client.ws.close();
  });

  it("rejects malformed friend and invite messages", async () => {
    const client = await connect();
    client.ws.send(JSON.stringify({ type: "authenticate", sessionToken: SESSION_TOKEN }));
    for (const message of [
      { type: "set_friends" },
      { type: "set_friends", friendIds: "T:_a" },
      { type: "set_friends", friendIds: ["T:_ok", ""] },
      { type: "set_friends", friendIds: ["T:_bad id"] },
      { type: "set_friends", friendIds: ["T:_" + "a".repeat(126)] },
      { type: "set_friends", friendIds: Array.from({ length: 501 }, (_, i) => `T:_${i}`) },
      { type: "set_friends", friendIds: [], displayNames: ["Alice"] },
      { type: "invite_friend" },
      { type: "invite_friend", playerId: 42 },
      { type: "invite_friend", playerId: "<script>" },
      { type: "invite_friend", playerId: "T:_a", roomCode: "ABC123" },
      { type: "respond_invite", inviteId: "a".repeat(32) },
      { type: "respond_invite", inviteId: "a".repeat(32), accept: "yes" },
      { type: "respond_invite", inviteId: "not-an-invite", accept: true },
      { type: "respond_invite", inviteId: "A".repeat(32), accept: true },
      { type: "cancel_invite" },
      { type: "cancel_invite", inviteId: "a".repeat(31) },
      { type: "cancel_invite", inviteId: "a".repeat(32), reason: "x" },
    ]) {
      client.ws.send(JSON.stringify(message));
      expect(await client.next()).toMatchObject({ type: "error", code: "VALIDATION_FAILED" });
    }
    client.ws.close();
  });

  it("accepts well-formed friend and invite messages and refuses sessions without Game Center", async () => {
    const client = await connect();
    client.ws.send(JSON.stringify({ type: "authenticate", sessionToken: SESSION_TOKEN }));
    client.ws.send(JSON.stringify({ type: "set_friends", friendIds: Array.from({ length: 500 }, (_, i) => `T:_${i}`) }));
    expect(await client.next()).toMatchObject({ type: "friends_error", code: "NOT_LINKED" });
    client.ws.send(JSON.stringify({ type: "invite_friend", playerId: "T:_friend.1-x" }));
    expect(await client.next()).toMatchObject({ type: "invite_error", code: "NOT_LINKED" });
    client.ws.send(JSON.stringify({ type: "respond_invite", inviteId: "a".repeat(32), accept: true }));
    expect(await client.next()).toMatchObject({ type: "invite_error", code: "INVITE_NOT_FOUND" });
    client.ws.send(JSON.stringify({ type: "cancel_invite", inviteId: "b".repeat(32) }));
    expect(await client.next()).toMatchObject({ type: "invite_error", code: "INVITE_NOT_FOUND" });
    client.ws.close();
  });

  it("rejects WebSocket messages larger than the payload limit", async () => {
    const client = await connect();
    client.ws.send(JSON.stringify({ type: "ping", padding: "x".repeat(600 * 1024) }));
    expect(await client.closed).toBe(1009);
  });
});
