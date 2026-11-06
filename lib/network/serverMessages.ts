import { z } from "zod";

/**
 * Validates messages the game server sends over the WebSocket. Unknown keys are
 * stripped; messages that don't match are ignored by the client.
 */
export const wsServerMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("pong") }),
  z.object({ type: z.literal("queue_joined"), position: z.number() }),
  z.object({ type: z.literal("queue_left") }),
  z.object({
    type: z.literal("match_found"),
    gameId: z.string(),
    playerRole: z.enum(["player1", "player2"]),
    opponentName: z.string(),
    opponentPlayerId: z.string().regex(/^[a-f0-9]{64}$/),
    matchType: z.enum(["queue", "friend"]),
  }),
  z.object({
    type: z.literal("game_state"),
    gameId: z.string(),
    currentRound: z.number(),
    currentPlayer: z.enum(["player1", "player2"]),
    totalRounds: z.number(),
    status: z.string(),
  }),
  z.object({
    type: z.literal("turn_submitted"),
    playerRole: z.enum(["player1", "player2"]),
    round: z.number(),
    strokes: z.array(z.unknown()),
  }),
  z.object({
    type: z.literal("round_complete"),
    round: z.number(),
    nextRound: z.number(),
  }),
  z.object({ type: z.literal("game_complete"), gameId: z.string() }),
  z.object({
    type: z.literal("opponent_stroke"),
    stroke: z.object({
      id: z.string(),
      path: z.string(),
      color: z.string(),
      strokeWidth: z.number(),
    }),
  }),
  z.object({ type: z.literal("opponent_clear") }),
  z.object({ type: z.literal("opponent_undo") }),
  z.object({ type: z.literal("opponent_disconnected") }),
  z.object({ type: z.literal("room_created"), roomCode: z.string() }),
  z.object({ type: z.literal("room_joined"), roomCode: z.string() }),
  z.object({
    type: z.literal("room_error"),
    message: z.string(),
    code: z
      .enum([
        "ALREADY_IN_GAME",
        "ROOM_NOT_FOUND",
        "ROOM_FULL",
        "ROOM_EXPIRED",
        "STATE_BLOCKED",
        "RATE_LIMITED",
      ])
      .optional(),
  }),
  z.object({
    type: z.literal("flow_error"),
    code: z.string(),
    message: z.string(),
    retryable: z.boolean().optional(),
    fatal: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("error"),
    message: z.string(),
    code: z.string().optional(),
  }),
]);
