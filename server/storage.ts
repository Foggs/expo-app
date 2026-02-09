import { eq, and, desc } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  games,
  turns,
  galleryDrawings,
  type User,
  type InsertUser,
  type Game,
  type Turn,
  type GalleryDrawing,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  createGame(player1Id?: string): Promise<Game>;
  getGame(id: string): Promise<Game | undefined>;
  updateGame(id: string, data: Partial<Game>): Promise<Game | undefined>;
  getActiveGames(): Promise<Game[]>;

  createTurn(data: {
    gameId: string;
    playerId?: string;
    playerRole: string;
    round: number;
    strokes: unknown;
  }): Promise<Turn>;
  getTurnsByGame(gameId: string): Promise<Turn[]>;
  getTurnsByGameAndRound(gameId: string, round: number): Promise<Turn[]>;

  saveToGallery(data: {
    playerName?: string;
    opponentName?: string;
    strokes: unknown;
    roundCount?: number;
  }): Promise<GalleryDrawing>;
  getGalleryDrawings(limit?: number): Promise<GalleryDrawing[]>;
  deleteGalleryDrawing(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async createGame(player1Id?: string): Promise<Game> {
    const [game] = await db
      .insert(games)
      .values({
        player1Id: player1Id || null,
        status: "waiting",
        currentRound: 1,
        currentPlayer: "player1",
      })
      .returning();
    return game;
  }

  async getGame(id: string): Promise<Game | undefined> {
    const [game] = await db.select().from(games).where(eq(games.id, id));
    return game;
  }

  async updateGame(
    id: string,
    data: Partial<Game>,
  ): Promise<Game | undefined> {
    const [game] = await db
      .update(games)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(games.id, id))
      .returning();
    return game;
  }

  async getActiveGames(): Promise<Game[]> {
    return db
      .select()
      .from(games)
      .where(eq(games.status, "waiting"))
      .orderBy(desc(games.createdAt));
  }

  async createTurn(data: {
    gameId: string;
    playerId?: string;
    playerRole: string;
    round: number;
    strokes: unknown;
  }): Promise<Turn> {
    const [turn] = await db
      .insert(turns)
      .values({
        gameId: data.gameId,
        playerId: data.playerId || null,
        playerRole: data.playerRole,
        round: data.round,
        strokes: data.strokes,
      })
      .returning();
    return turn;
  }

  async getTurnsByGame(gameId: string): Promise<Turn[]> {
    return db
      .select()
      .from(turns)
      .where(eq(turns.gameId, gameId))
      .orderBy(turns.round);
  }

  async getTurnsByGameAndRound(
    gameId: string,
    round: number,
  ): Promise<Turn[]> {
    return db
      .select()
      .from(turns)
      .where(and(eq(turns.gameId, gameId), eq(turns.round, round)));
  }

  async saveToGallery(data: {
    playerName?: string;
    opponentName?: string;
    strokes: unknown;
    roundCount?: number;
  }): Promise<GalleryDrawing> {
    const [drawing] = await db
      .insert(galleryDrawings)
      .values({
        playerName: data.playerName || "Anonymous",
        opponentName: data.opponentName || "Unknown",
        strokes: data.strokes,
        roundCount: data.roundCount || 3,
      })
      .returning();
    return drawing;
  }

  async getGalleryDrawings(limit = 50): Promise<GalleryDrawing[]> {
    return db
      .select()
      .from(galleryDrawings)
      .orderBy(desc(galleryDrawings.createdAt))
      .limit(limit);
  }

  async deleteGalleryDrawing(id: string): Promise<boolean> {
    const result = await db
      .delete(galleryDrawings)
      .where(eq(galleryDrawings.id, id))
      .returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
