import { describe, expect, it } from "vitest";
import { wsServerMessageSchema } from "../serverMessages";

const PLAYER_ID = "c".repeat(64);

describe("server message validation in the app", () => {
  it("accepts a match and strips keys the app does not use", () => {
    const result = wsServerMessageSchema.safeParse({
      type: "match_found",
      gameId: "g1",
      playerRole: "player2",
      opponentName: "Pixel Fox",
      opponentPlayerId: PLAYER_ID,
      matchType: "queue",
      serverDebug: "ignored",
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      type: "match_found",
      gameId: "g1",
      playerRole: "player2",
      opponentName: "Pixel Fox",
      opponentPlayerId: PLAYER_ID,
      matchType: "queue",
    });
  });

  it("ignores malformed matches", () => {
    const base = { type: "match_found", gameId: "g1", playerRole: "player1", opponentName: "A", matchType: "friend" };
    expect(wsServerMessageSchema.safeParse({ ...base, opponentPlayerId: "not-a-key" }).success).toBe(false);
    expect(wsServerMessageSchema.safeParse({ ...base, opponentPlayerId: PLAYER_ID, playerRole: "spectator" }).success).toBe(false);
  });

  it("accepts live opponent strokes and turn results", () => {
    expect(wsServerMessageSchema.safeParse({
      type: "opponent_stroke",
      stroke: { id: "s", path: "M0 0", color: "#000", strokeWidth: 3 },
    }).success).toBe(true);
    expect(wsServerMessageSchema.safeParse({
      type: "turn_submitted",
      playerRole: "player1",
      round: 2,
      strokes: [{ anything: true }],
    }).success).toBe(true);
    expect(wsServerMessageSchema.safeParse({ type: "opponent_stroke", stroke: { id: "s" } }).success).toBe(false);
  });

  it("shows every room error the server can send, including join rate limiting", () => {
    for (const code of ["ALREADY_IN_GAME", "ROOM_NOT_FOUND", "ROOM_FULL", "ROOM_EXPIRED", "STATE_BLOCKED", "RATE_LIMITED"]) {
      expect(wsServerMessageSchema.safeParse({ type: "room_error", message: "x", code }).success).toBe(true);
    }
    expect(wsServerMessageSchema.safeParse({ type: "room_error", message: "x" }).success).toBe(true);
    expect(wsServerMessageSchema.safeParse({ type: "room_error", message: "x", code: "MADE_UP" }).success).toBe(false);
  });

  it("accepts errors and flow errors with optional fields", () => {
    expect(wsServerMessageSchema.safeParse({ type: "error", message: "Rate limited, slow down", code: "RATE_LIMITED" }).success).toBe(true);
    expect(wsServerMessageSchema.safeParse({ type: "error", message: "x" }).success).toBe(true);
    expect(wsServerMessageSchema.safeParse({ type: "flow_error", code: "X", message: "y", retryable: true }).success).toBe(true);
    expect(wsServerMessageSchema.safeParse({ type: "flow_error", code: "X", message: "y", fatal: "yes" }).success).toBe(false);
  });

  it("ignores unknown or non-object messages", () => {
    expect(wsServerMessageSchema.safeParse({ type: "surprise" }).success).toBe(false);
    expect(wsServerMessageSchema.safeParse(null).success).toBe(false);
    expect(wsServerMessageSchema.safeParse([]).success).toBe(false);
  });
});
