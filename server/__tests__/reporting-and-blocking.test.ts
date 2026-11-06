import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import WebSocket from "ws";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { getSessionKey } from "../sessionIdentity";
import {
  startIsolatedDatabase,
  startServer,
  stopServer,
  type IsolatedDatabase,
  type RunningServer,
} from "./support/realServer";

// End-to-end safety checks: real HTTP routes, real WebSocket matchmaking and a
// real (throwaway) Postgres database with the app's schema.

const MODERATOR_TOKEN = "reporting-blocking-test-moderator-token";
const TEST_TIMEOUT_MS = 60_000;
const MESSAGE_TIMEOUT_MS = 10_000;

type ServerMessage = { type: string; [key: string]: unknown };

type ReportRow = {
  id: string;
  report_type: string;
  reason: string;
  reporter_session_key: string;
  target_player_key: string | null;
  gallery_drawing_id: string | null;
  game_id: string | null;
  evidence: unknown;
  status: string;
};

function newDeviceToken(): string {
  return randomBytes(32).toString("hex");
}

function sessionKeyFor(token: string): string {
  const key = getSessionKey(token);
  if (!key) throw new Error("Test device token is not a valid session token");
  return key;
}

/** A WebSocket game client that records every server message it receives. */
class TestPlayer {
  readonly messages: ServerMessage[] = [];
  private waiters: Array<() => void> = [];

  private constructor(private readonly ws: WebSocket) {
    ws.on("message", (data) => {
      this.messages.push(JSON.parse(data.toString()) as ServerMessage);
      for (const wake of this.waiters.splice(0)) wake();
    });
  }

  static async connect(wsUrl: string, deviceToken: string): Promise<TestPlayer> {
    const ws = new WebSocket(wsUrl);
    await new Promise<void>((resolveOpen, reject) => {
      ws.once("open", () => resolveOpen());
      ws.once("error", reject);
    });
    const player = new TestPlayer(ws);
    player.send({ type: "authenticate", sessionToken: deviceToken });
    return player;
  }

  send(message: Record<string, unknown>): void {
    this.ws.send(JSON.stringify(message));
  }

  received(type: string): ServerMessage[] {
    return this.messages.filter((message) => message.type === type);
  }

  async waitFor(
    type: string,
    predicate: (message: ServerMessage) => boolean = () => true,
  ): Promise<ServerMessage> {
    const deadline = Date.now() + MESSAGE_TIMEOUT_MS;
    for (;;) {
      const match = this.messages.find((message) => message.type === type && predicate(message));
      if (match) return match;
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw new Error(
          `Timed out waiting for "${type}"; received: ${JSON.stringify(this.messages.map((m) => m.type))}`,
        );
      }
      await new Promise<void>((wake) => {
        const timer = setTimeout(wake, remaining);
        this.waiters.push(() => {
          clearTimeout(timer);
          wake();
        });
      });
    }
  }

  async joinQueue(): Promise<void> {
    const alreadyJoined = this.received("queue_joined").length;
    this.send({ type: "join_queue" });
    await this.waitFor("queue_joined", () => this.received("queue_joined").length > alreadyJoined);
  }

  async close(): Promise<void> {
    if (this.ws.readyState === WebSocket.CLOSED) return;
    await new Promise<void>((resolveClose) => {
      this.ws.once("close", () => resolveClose());
      this.ws.close();
    });
  }
}

describe("reporting and blocking through the real server", () => {
  let database: IsolatedDatabase;
  let server: RunningServer;
  let db: Pool;
  let players: TestPlayer[] = [];

  beforeAll(async () => {
    database = await startIsolatedDatabase();
    db = new Pool({ connectionString: database.databaseUrl });
    server = await startServer({
      DATABASE_URL: database.databaseUrl,
      SESSION_SECRET: MODERATOR_TOKEN,
      // No alert destination: reports must still be stored and enforced.
      MODERATION_NOTIFICATION_WEBHOOK_URL: "",
      MODERATION_NOTIFICATION_WEBHOOK_SECRET: "",
    });
  }, TEST_TIMEOUT_MS);

  afterEach(async () => {
    await Promise.all(players.map((player) => player.close()));
    players = [];
    // Each test starts from empty tables, and nothing it wrote survives it.
    await db.query(
      "TRUNCATE moderation_reports, player_blocks, turns, games, gallery_drawings RESTART IDENTITY CASCADE",
    );
  });

  afterAll(async () => {
    await Promise.all(players.map((player) => player.close()));
    if (server) await stopServer(server.process);
    if (db) await db.end();
    if (database) await database.stop();
  }, TEST_TIMEOUT_MS);

  async function connectPlayer(deviceToken: string): Promise<TestPlayer> {
    const player = await TestPlayer.connect(server.wsUrl, deviceToken);
    players.push(player);
    return player;
  }

  async function postJson(path: string, body: unknown, headers: Record<string, string> = {}): Promise<Response> {
    return fetch(`${server.baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  }

  async function reviewReport(reportId: string, status: "dismissed" | "actioned"): Promise<void> {
    const response = await fetch(`${server.baseUrl}/api/moderation/reports/${reportId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-moderation-admin-token": MODERATOR_TOKEN },
      body: JSON.stringify({ status }),
    });
    expect(response.status).toBe(200);
  }

  async function galleryIds(): Promise<string[]> {
    const response = await fetch(`${server.baseUrl}/api/gallery`);
    expect(response.status).toBe(200);
    return ((await response.json()) as Array<{ id: string }>).map((drawing) => drawing.id);
  }

  async function saveDrawing(ownerToken: string, color: string): Promise<string> {
    const response = await postJson("/api/gallery", {
      playerName: "Gallery artist",
      opponentName: "Opponent",
      strokes: [{ id: `stroke-${color}`, path: "M0 0 L10 10", color, strokeWidth: 4 }],
      roundCount: 3,
      sessionToken: ownerToken,
    });
    expect(response.status).toBe(201);
    return ((await response.json()) as { id: string }).id;
  }

  async function reportsFor(column: "gallery_drawing_id" | "game_id", value: string): Promise<ReportRow[]> {
    const result = await db.query<ReportRow>(
      `SELECT id, report_type, reason, reporter_session_key, target_player_key,
              gallery_drawing_id, game_id, evidence, status
       FROM moderation_reports WHERE ${column} = $1`,
      [value],
    );
    return result.rows;
  }

  /** Queues two devices so they are paired, and returns their match details. */
  async function playMatch(firstToken: string, secondToken: string) {
    const first = await connectPlayer(firstToken);
    const second = await connectPlayer(secondToken);
    await first.joinQueue();
    await second.joinQueue();
    const firstMatch = await first.waitFor("match_found");
    const secondMatch = await second.waitFor("match_found");
    expect(firstMatch.gameId).toBe(secondMatch.gameId);
    expect(firstMatch.playerRole).toBe("player1");
    expect(secondMatch.playerRole).toBe("player2");
    return { first, second, gameId: firstMatch.gameId as string, firstMatch, secondMatch };
  }

  it("stores a gallery report with its reason and hides the drawing until a moderator resolves it", async () => {
    const ownerToken = newDeviceToken();
    const reporterToken = newDeviceToken();
    const dismissedDrawingId = await saveDrawing(ownerToken, "#ff0000");
    const actionedDrawingId = await saveDrawing(ownerToken, "#0000ff");
    expect(await galleryIds()).toEqual(expect.arrayContaining([dismissedDrawingId, actionedDrawingId]));

    const missingDevice = await postJson("/api/reports", {
      reportType: "gallery",
      galleryDrawingId: dismissedDrawingId,
      reason: "spam",
    });
    expect(missingDevice.status).toBe(401);

    for (const [drawingId, reason] of [
      [dismissedDrawingId, "harassment"],
      [actionedDrawingId, "hate_speech"],
    ] as const) {
      const response = await postJson(
        "/api/reports",
        { reportType: "gallery", galleryDrawingId: drawingId, reason },
        { "x-session-token": reporterToken },
      );
      expect(response.status).toBe(201);
    }

    const [dismissedReport] = await reportsFor("gallery_drawing_id", dismissedDrawingId);
    expect(dismissedReport).toMatchObject({
      report_type: "gallery",
      reason: "harassment",
      status: "pending",
      reporter_session_key: sessionKeyFor(reporterToken),
      target_player_key: sessionKeyFor(ownerToken),
    });
    expect(dismissedReport.evidence).toMatchObject({
      drawing: { strokes: [expect.objectContaining({ color: "#ff0000" })] },
    });
    const [actionedReport] = await reportsFor("gallery_drawing_id", actionedDrawingId);
    expect(actionedReport).toMatchObject({ reason: "hate_speech", status: "pending" });

    // Pending reports hide both drawings from everyone.
    const whilePending = await galleryIds();
    expect(whilePending).not.toContain(dismissedDrawingId);
    expect(whilePending).not.toContain(actionedDrawingId);

    // Dismissing a report restores the drawing; actioning keeps it hidden.
    await reviewReport(dismissedReport.id, "dismissed");
    await reviewReport(actionedReport.id, "actioned");
    const afterReview = await galleryIds();
    expect(afterReview).toContain(dismissedDrawingId);
    expect(afterReview).not.toContain(actionedDrawingId);
  }, TEST_TIMEOUT_MS);

  it("captures the opponent's drawings as match evidence and rejects reporters from outside the match", async () => {
    const artistToken = newDeviceToken();
    const reporterToken = newDeviceToken();
    const outsiderToken = newDeviceToken();
    const { first: artist, second: reporter, gameId } = await playMatch(artistToken, reporterToken);

    const artistStrokes = [{ points: [{ x: 1, y: 2 }, { x: 3, y: 4 }], color: "#ff00ff", width: 6 }];
    const reporterStrokes = [{ points: [{ x: 9, y: 9 }], color: "#00ff00", width: 2 }];
    artist.send({ type: "submit_turn", strokes: artistStrokes });
    await reporter.waitFor("turn_submitted", (message) => message.playerRole === "player1");
    reporter.send({ type: "submit_turn", strokes: reporterStrokes });
    await artist.waitFor("turn_submitted", (message) => message.playerRole === "player2");

    const outsiderReport = await postJson(
      "/api/reports",
      { reportType: "match", gameId, reason: "sexual_content" },
      { "x-session-token": outsiderToken },
    );
    expect(outsiderReport.status).toBe(403);
    expect(await reportsFor("game_id", gameId)).toHaveLength(0);

    const playerReport = await postJson(
      "/api/reports",
      { reportType: "match", gameId, reason: "sexual_content" },
      { "x-session-token": reporterToken },
    );
    expect(playerReport.status).toBe(201);

    const reports = await reportsFor("game_id", gameId);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      report_type: "match",
      reason: "sexual_content",
      reporter_session_key: sessionKeyFor(reporterToken),
      target_player_key: sessionKeyFor(artistToken),
      game_id: gameId,
    });
    // Only the reported opponent's drawing is kept as evidence, not the reporter's own.
    expect(reports[0].evidence).toEqual({
      gameId,
      turns: [{ round: 1, strokes: artistStrokes }],
    });
  }, TEST_TIMEOUT_MS);

  it("never pairs two devices again after one blocks the other", async () => {
    const blockedToken = newDeviceToken();
    const blockerToken = newDeviceToken();
    const outsiderToken = newDeviceToken();
    const { first, second, firstMatch, secondMatch } = await playMatch(blockedToken, blockerToken);
    expect(secondMatch.opponentPlayerId).toBe(sessionKeyFor(blockedToken));
    expect(firstMatch.opponentPlayerId).toBe(sessionKeyFor(blockerToken));

    const strangerBlock = await postJson(
      "/api/blocks",
      { blockedPlayerId: sessionKeyFor(blockedToken) },
      { "x-session-token": outsiderToken },
    );
    expect(strangerBlock.status).toBe(403);

    const block = await postJson(
      "/api/blocks",
      { blockedPlayerId: secondMatch.opponentPlayerId },
      { "x-session-token": blockerToken },
    );
    expect(block.status).toBe(201);
    const { rows: blocks } = await db.query(
      "SELECT blocker_session_key, blocked_player_key FROM player_blocks",
    );
    expect(blocks).toEqual([{
      blocker_session_key: sessionKeyFor(blockerToken),
      blocked_player_key: sessionKeyFor(blockedToken),
    }]);

    // Both devices leave the match and come back on fresh connections.
    await first.close();
    await second.close();
    const blockedAgain = await connectPlayer(blockedToken);
    const blockerAgain = await connectPlayer(blockerToken);
    await blockedAgain.joinQueue();
    await blockerAgain.joinQueue();

    // A third player arriving forces another matchmaking pass over all three.
    // They must be paired with the first queued device, skipping the blocked pair.
    const newcomer = await connectPlayer(newDeviceToken());
    await newcomer.joinQueue();
    const newcomerMatch = await newcomer.waitFor("match_found");
    const blockedMatch = await blockedAgain.waitFor("match_found");
    expect(blockedMatch.gameId).toBe(newcomerMatch.gameId);
    expect(blockerAgain.received("match_found")).toHaveLength(0);

    // The blocker is still matchable with anyone else.
    const latecomer = await connectPlayer(newDeviceToken());
    await latecomer.joinQueue();
    const latecomerMatch = await latecomer.waitFor("match_found");
    const blockerMatch = await blockerAgain.waitFor("match_found");
    expect(blockerMatch.gameId).toBe(latecomerMatch.gameId);
    expect(blockerMatch.opponentPlayerId).not.toBe(sessionKeyFor(blockedToken));

    const { rows: pairings } = await db.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM games
       WHERE (player1_session_key = $1 AND player2_session_key = $2)
          OR (player1_session_key = $2 AND player2_session_key = $1)`,
      [sessionKeyFor(blockedToken), sessionKeyFor(blockerToken)],
    );
    expect(pairings[0].count).toBe("1");
  }, TEST_TIMEOUT_MS);
});
