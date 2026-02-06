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

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const createGameSchema = z.object({
  player1Id: z.string().optional(),
  totalRounds: z.number().min(1).max(5).default(3),
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

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Game = typeof games.$inferSelect;
export type Turn = typeof turns.$inferSelect;
export type CreateGame = z.infer<typeof createGameSchema>;
export type SubmitTurn = z.infer<typeof submitTurnSchema>;
