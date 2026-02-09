import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type GalleryDrawing = typeof galleryDrawings.$inferSelect;

export const insertGalleryDrawingSchema = z.object({
  playerName: z.string().max(50).optional(),
  opponentName: z.string().max(50).optional(),
  strokes: z.array(z.object({
    id: z.string(),
    path: z.string(),
    color: z.string(),
    strokeWidth: z.number(),
  })).max(2000),
  roundCount: z.number().min(1).max(10).optional(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const createGameSchema = z.object({
  player1Id: z.string().optional(),
});

export const submitTurnSchema = z.object({
  playerRole: z.enum(["player1", "player2"]),
  round: z.number().min(1).max(5),
  strokes: z.array(z.object({
    points: z.array(z.object({
      x: z.number(),
      y: z.number(),
    })),
    color: z.string().max(20),
    width: z.number().min(1).max(50),
  })),
});

export const strokeSchema = z.object({
  points: z.array(z.object({
    x: z.number(),
    y: z.number(),
  })).max(5000),
  color: z.string().max(20),
  width: z.number().min(1).max(50),
});

export const wsClientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("join_queue"),
  }),
  z.object({
    type: z.literal("leave_queue"),
  }),
  z.object({
    type: z.literal("draw_stroke"),
    stroke: z.object({
      id: z.string().max(50),
      path: z.string().max(50000),
      color: z.string().max(20),
      strokeWidth: z.number().min(1).max(50),
    }),
  }),
  z.object({
    type: z.literal("draw_clear"),
  }),
  z.object({
    type: z.literal("submit_turn"),
    strokes: z.array(strokeSchema).max(500),
  }),
  z.object({
    type: z.literal("ping"),
  }),
]);

export type WsClientMessage = z.infer<typeof wsClientMessageSchema>;

export type WsServerMessage =
  | { type: "queue_joined"; position: number }
  | { type: "queue_left" }
  | { type: "match_found"; gameId: string; playerRole: "player1" | "player2"; opponentName: string }
  | { type: "game_state"; gameId: string; currentRound: number; currentPlayer: "player1" | "player2"; totalRounds: number; status: string }
  | { type: "turn_submitted"; playerRole: "player1" | "player2"; round: number; strokes: unknown[] }
  | { type: "round_complete"; round: number; nextRound: number }
  | { type: "game_complete"; gameId: string }
  | { type: "opponent_disconnected" }
  | { type: "opponent_stroke"; stroke: { id: string; path: string; color: string; strokeWidth: number } }
  | { type: "opponent_clear" }
  | { type: "error"; message: string; code?: string }
  | { type: "pong" };

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Game = typeof games.$inferSelect;
export type Turn = typeof turns.$inferSelect;
export type CreateGame = z.infer<typeof createGameSchema>;
export type SubmitTurn = z.infer<typeof submitTurnSchema>;
