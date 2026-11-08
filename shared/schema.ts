import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { isValidRoomCode, normalizeRoomCode } from "./friendRoom";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const games = pgTable("games", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  player1Id: varchar("player1_id").references(() => users.id),
  player2Id: varchar("player2_id").references(() => users.id),
  status: text("status").notNull().default("waiting"),
  currentRound: integer("current_round").notNull().default(1),
  currentPlayer: text("current_player").notNull().default("player1"),
  totalRounds: integer("total_rounds").notNull().default(3),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  player1SessionKey: text("player1_session_key"),
  player2SessionKey: text("player2_session_key"),
});

export const turns = pgTable("turns", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  gameId: varchar("game_id")
    .references(() => games.id)
    .notNull(),
  playerId: varchar("player_id")
    .references(() => users.id),
  playerRole: text("player_role").notNull(),
  round: integer("round").notNull(),
  strokes: jsonb("strokes").notNull().default([]),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

export const galleryDrawings = pgTable("gallery_drawings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  playerName: text("player_name").notNull().default("Anonymous"),
  opponentName: text("opponent_name").notNull().default("Unknown"),
  strokes: jsonb("strokes").notNull().default([]),
  roundCount: integer("round_count").notNull().default(3),
  sessionToken: text("session_token"),
  ownerPlayerKey: text("owner_player_key"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * A verified Game Center player. playerKey is the canonical player identifier
 * used for games, blocks, reports and gallery ownership once a device links.
 */
export const playerAccounts = pgTable("player_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameCenterPlayerId: text("game_center_player_id").notNull().unique(),
  playerKey: text("player_key").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastSignedInAt: timestamp("last_signed_in_at").defaultNow().notNull(),
  /** How this player appears to Game Center friends: visible, appear_offline or do_not_disturb. */
  friendVisibility: text("friend_visibility").notNull().default("visible"),
});

/**
 * Maps a device's own player key (derived from its device token) to the
 * account it signed in with. History recorded under the device key stays
 * attached to the account through this link.
 */
export const playerDeviceLinks = pgTable("player_device_links", {
  deviceKey: text("device_key").primaryKey(),
  playerKey: text("player_key").notNull(),
  linkedAt: timestamp("linked_at").defaultNow().notNull(),
}, (table) => ({
  playerKeyIdx: index("player_device_links_player_key_idx").on(table.playerKey),
}));

/** Identity proofs already accepted, so a captured proof cannot be replayed. */
export const gameCenterProofUses = pgTable("game_center_proof_uses", {
  proofHash: text("proof_hash").primaryKey(),
  usedAt: timestamp("used_at").defaultNow().notNull(),
});

export const playerBlocks = pgTable("player_blocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  blockerSessionKey: text("blocker_session_key").notNull(),
  blockedPlayerKey: text("blocked_player_key").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  pairUnique: uniqueIndex("player_blocks_pair_unique").on(table.blockerSessionKey, table.blockedPlayerKey),
}));

export const moderationReports = pgTable("moderation_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportType: text("report_type").notNull(),
  reason: text("reason").notNull(),
  reporterSessionKey: text("reporter_session_key").notNull(),
  targetPlayerKey: text("target_player_key"),
  targetName: text("target_name").notNull().default("Unknown"),
  galleryDrawingId: varchar("gallery_drawing_id").references(() => galleryDrawings.id, { onDelete: "set null" }),
  gameId: varchar("game_id").references(() => games.id, { onDelete: "set null" }),
  evidence: jsonb("evidence").notNull().default({}),
  status: text("status").notNull().default("pending"),
  alertDeliveryStatus: text("alert_delivery_status").notNull().default("pending"),
  alertDeliveryAttempts: integer("alert_delivery_attempts").notNull().default(0),
  alertDeliveryNextAttemptAt: timestamp("alert_delivery_next_attempt_at").defaultNow(),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
});

export type GalleryDrawing = typeof galleryDrawings.$inferSelect;

export const reportReasonSchema = z.enum([
  "harassment",
  "sexual_content",
  "violence",
  "hate_speech",
  "spam",
  "other",
]);

export const createReportSchema = z.discriminatedUnion("reportType", [
  z.object({
    reportType: z.literal("gallery"),
    galleryDrawingId: z.string().min(1).max(100),
    reason: reportReasonSchema,
  }).strict(),
  z.object({
    reportType: z.literal("match"),
    gameId: z.string().min(1).max(100),
    reason: reportReasonSchema,
  }).strict(),
]);

export const createPlayerBlockSchema = z.object({
  blockedPlayerId: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

export const reviewReportSchema = z.object({
  status: z.enum(["reviewed", "dismissed", "actioned"]),
  reviewNote: z.string().max(1000).optional(),
}).strict();

export const insertGalleryDrawingSchema = z.object({
  playerName: z.string().max(50).optional(),
  opponentName: z.string().max(50).optional(),
  strokes: z.array(z.object({
    id: z.string().max(100),
    path: z.string().max(50000),
    color: z.string().max(20),
    strokeWidth: z.number().min(1).max(50),
  }).strict()).max(500),
  roundCount: z.number().min(1).max(10).optional(),
  sessionToken: z.string().max(100).optional(),
}).strict();

export const gameCenterIdentityProofSchema = z.object({
  playerId: z.string().min(1).max(128),
  publicKeyUrl: z.string().min(1).max(512),
  signature: z.string().min(1).max(2048).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  salt: z.string().min(1).max(128).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  timestamp: z.string().regex(/^\d{1,16}$/),
}).strict();

export type GameCenterIdentityProof = z.infer<typeof gameCenterIdentityProofSchema>;

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const createGameSchema = z.object({
  player1Id: z.string().optional(),
}).strict();

export const submitTurnSchema = z.object({
  playerRole: z.enum(["player1", "player2"]),
  round: z.number().min(1).max(5),
  strokes: z.array(z.object({
    points: z.array(z.object({
      x: z.number(),
      y: z.number(),
    }).strict()),
    color: z.string().max(20),
    width: z.number().min(1).max(50),
  }).strict()),
}).strict();

export const strokeSchema = z.object({
  points: z.array(z.object({
    x: z.number(),
    y: z.number(),
  }).strict()).max(5000),
  color: z.string().max(20),
  width: z.number().min(1).max(50),
}).strict();

/** Game Center team-scoped player IDs, as uploaded by the app (e.g. "T:_abc123"). */
export const gameCenterPlayerIdSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9:_.\-]+$/);
export const MAX_UPLOADED_FRIENDS = 500;
export const friendInviteIdSchema = z.string().regex(/^[a-f0-9]{32}$/);
/** How a player appears to Game Center friends. */
export const friendVisibilitySchema = z.enum(["visible", "appear_offline", "do_not_disturb"]);
export type FriendVisibility = z.infer<typeof friendVisibilitySchema>;

export const wsClientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("authenticate"),
    sessionToken: z.string().regex(/^[a-f0-9]{64}$/i),
  }).strict(),
  z.object({ type: z.literal("join_queue") }).strict(),
  z.object({ type: z.literal("leave_queue") }).strict(),
  z.object({ type: z.literal("create_room") }).strict(),
  z.object({
    type: z.literal("join_room"),
    roomCode: z
      .string()
      .transform((value) => normalizeRoomCode(value))
      .refine((value) => isValidRoomCode(value), {
        error: "Invalid room code",
      }),
  }).strict(),
  z.object({ type: z.literal("leave_room") }).strict(),
  z.object({
    type: z.literal("draw_stroke"),
    stroke: z.object({
      id: z.string().max(50),
      path: z.string().max(50000),
      color: z.string().max(20),
      strokeWidth: z.number().min(1).max(50),
    }).strict(),
  }).strict(),
  z.object({ type: z.literal("draw_clear") }).strict(),
  z.object({ type: z.literal("draw_undo") }).strict(),
  z.object({
    type: z.literal("submit_turn"),
    strokes: z.array(strokeSchema).max(500),
  }).strict(),
  z.object({ type: z.literal("ping") }).strict(),
  z.object({ type: z.literal("request_game_state") }).strict(),
  z.object({
    type: z.literal("set_friends"),
    friendIds: z.array(gameCenterPlayerIdSchema).max(MAX_UPLOADED_FRIENDS),
  }).strict(),
  z.object({ type: z.literal("invite_friend"), playerId: gameCenterPlayerIdSchema }).strict(),
  z.object({
    type: z.literal("respond_invite"),
    inviteId: friendInviteIdSchema,
    accept: z.boolean(),
  }).strict(),
  z.object({ type: z.literal("cancel_invite"), inviteId: friendInviteIdSchema }).strict(),
  z.object({ type: z.literal("set_visibility"), visibility: friendVisibilitySchema }).strict(),
]);

/** "busy" is a friend with Do Not Disturb on. Appear Offline shows as "offline". */
export type FriendPresenceStatus = "online" | "in_game" | "busy" | "offline";
export type FriendInviteClosedReason =
  | "declined"
  | "expired"
  | "cancelled"
  | "unavailable"
  | "answered_elsewhere"
  | "busy";
export type FriendInviteErrorCode =
  | "NOT_LINKED"
  | "RATE_LIMITED"
  | "ALREADY_INVITING"
  | "FRIEND_UNAVAILABLE"
  | "FRIEND_BUSY"
  | "IN_GAME"
  | "INVITE_NOT_FOUND";

export type WsClientMessage = z.infer<typeof wsClientMessageSchema>;

export type WsServerMessage =
  | { type: "queue_joined"; position: number }
  | { type: "queue_left" }
  | {
      type: "match_found";
      gameId: string;
      playerRole: "player1" | "player2";
      opponentName: string;
      opponentPlayerId: string;
      matchType: "queue" | "friend";
    }
  | { type: "game_state"; gameId: string; currentRound: number; currentPlayer: "player1" | "player2"; totalRounds: number; status: string }
  | { type: "turn_submitted"; playerRole: "player1" | "player2"; round: number; strokes: unknown[] }
  | { type: "round_complete"; round: number; nextRound: number }
  | { type: "game_complete"; gameId: string }
  | { type: "opponent_disconnected" }
  | { type: "opponent_stroke"; stroke: { id: string; path: string; color: string; strokeWidth: number } }
  | { type: "opponent_clear" }
  | { type: "opponent_undo" }
  | { type: "room_created"; roomCode: string }
  | { type: "room_joined"; roomCode: string }
  | {
      type: "room_error";
      message: string;
      code?:
        | "ALREADY_IN_GAME"
        | "ROOM_NOT_FOUND"
        | "ROOM_FULL"
        | "ROOM_EXPIRED"
        | "STATE_BLOCKED"
        | "RATE_LIMITED";
    }
  | { type: "error"; message: string; code?: string }
  | { type: "pong" }
  | { type: "friends_status"; friends: { playerId: string; status: FriendPresenceStatus }[] }
  | { type: "friend_presence"; playerId: string; status: FriendPresenceStatus }
  | { type: "friend_removed"; playerId: string }
  | { type: "friends_error"; code: "NOT_LINKED" | "RATE_LIMITED" | "FAILED"; message: string }
  | { type: "invite_sent"; inviteId: string; playerId: string; expiresInMs: number }
  | { type: "invite_received"; inviteId: string; playerId: string; expiresInMs: number }
  | { type: "invite_accepted"; inviteId: string; roomCode: string }
  | { type: "invite_closed"; inviteId: string; reason: FriendInviteClosedReason }
  | { type: "invite_error"; code: FriendInviteErrorCode; message: string }
  | { type: "visibility_status"; visibility: FriendVisibility };

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Game = typeof games.$inferSelect;
export type Turn = typeof turns.$inferSelect;
export type CreateGame = z.infer<typeof createGameSchema>;
export type SubmitTurn = z.infer<typeof submitTurnSchema>;
