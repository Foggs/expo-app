import { eq, and, desc, or, notExists } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  games,
  turns,
  galleryDrawings,
  playerBlocks,
  moderationReports,
  type User,
  type InsertUser,
  type Game,
  type Turn,
  type GalleryDrawing,
} from "@shared/schema";
import { filterDisplayName } from "@shared/contentFilter";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  createGame(player1Id?: string, player1SessionKey?: string, player2SessionKey?: string): Promise<Game>;
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
    sessionToken?: string;
  }): Promise<GalleryDrawing>;
  getGalleryDrawings(limit?: number): Promise<GalleryDrawing[]>;
  getGalleryDrawing(id: string): Promise<GalleryDrawing | undefined>;
  deleteGalleryDrawingOwned(id: string, sessionToken: string): Promise<boolean>;
  arePlayersBlocked(firstKey: string, secondKey: string): Promise<boolean>;
  havePlayedTogether(firstKey: string, secondKey: string): Promise<boolean>;
  blockPlayer(blockerKey: string, blockedPlayerKey: string): Promise<void>;
  createModerationReport(data: {
    reportType: string;
    reason: string;
    reporterSessionKey: string;
    targetPlayerKey?: string | null;
    targetName: string;
    galleryDrawingId?: string | null;
    gameId?: string | null;
    evidence: unknown;
  }): Promise<string>;
  getModerationReports(limit?: number): Promise<(typeof moderationReports.$inferSelect)[]>;
  getModerationReportAlertDeliveryStatus(id: string): Promise<string | undefined>;
  claimFailedModerationReportAlertRetry(id: string): Promise<boolean>;
  updateModerationReportAlertDeliveryStatus(id: string, status: "pending" | "delivered" | "failed"): Promise<boolean>;
  reviewModerationReport(id: string, status: string, reviewNote?: string): Promise<boolean>;
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

  async createGame(player1Id?: string, player1SessionKey?: string, player2SessionKey?: string): Promise<Game> {
    const [game] = await db
      .insert(games)
      .values({
        player1Id: player1Id || null,
        player1SessionKey: player1SessionKey || null,
        player2SessionKey: player2SessionKey || null,
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
    sessionToken?: string;
  }): Promise<GalleryDrawing> {
    const [drawing] = await db
      .insert(galleryDrawings)
      .values({
        playerName: filterDisplayName(data.playerName || "Anonymous"),
        opponentName: filterDisplayName(data.opponentName || "Unknown"),
        strokes: data.strokes,
        roundCount: data.roundCount || 3,
        sessionToken: data.sessionToken || null,
      })
      .returning();
    return drawing;
  }

  async getGalleryDrawings(limit = 50): Promise<GalleryDrawing[]> {
    const rows = await db
      .select()
      .from(galleryDrawings)
      .where(notExists(
        db.select({ id: moderationReports.id })
          .from(moderationReports)
          .where(and(
            eq(moderationReports.galleryDrawingId, galleryDrawings.id),
            or(
              eq(moderationReports.status, "pending"),
              eq(moderationReports.status, "actioned"),
            ),
          )),
      ))
      .orderBy(desc(galleryDrawings.createdAt))
      .limit(limit);
    return rows.map((drawing) => ({
      ...drawing,
      playerName: filterDisplayName(drawing.playerName),
      opponentName: filterDisplayName(drawing.opponentName),
    }));
  }

  async getGalleryDrawing(id: string): Promise<GalleryDrawing | undefined> {
    const [drawing] = await db
      .select()
      .from(galleryDrawings)
      .where(eq(galleryDrawings.id, id));
    return drawing;
  }

  async deleteGalleryDrawingOwned(id: string, sessionToken: string): Promise<boolean> {
    const result = await db.delete(galleryDrawings)
      .where(and(
        eq(galleryDrawings.id, id),
        eq(galleryDrawings.sessionToken, sessionToken),
      ))
      .returning({ id: galleryDrawings.id });
    return result.length > 0;
  }

  async arePlayersBlocked(firstKey: string, secondKey: string): Promise<boolean> {
    const [block] = await db
      .select({ id: playerBlocks.id })
      .from(playerBlocks)
      .where(or(
        and(
          eq(playerBlocks.blockerSessionKey, firstKey),
          eq(playerBlocks.blockedPlayerKey, secondKey),
        ),
        and(
          eq(playerBlocks.blockerSessionKey, secondKey),
          eq(playerBlocks.blockedPlayerKey, firstKey),
        ),
      ))
      .limit(1);
    return Boolean(block);
  }

  async havePlayedTogether(firstKey: string, secondKey: string): Promise<boolean> {
    const [game] = await db.select({ id: games.id })
      .from(games)
      .where(or(
        and(
          eq(games.player1SessionKey, firstKey),
          eq(games.player2SessionKey, secondKey),
        ),
        and(
          eq(games.player1SessionKey, secondKey),
          eq(games.player2SessionKey, firstKey),
        ),
      ))
      .limit(1);
    return Boolean(game);
  }

  async blockPlayer(blockerKey: string, blockedPlayerKey: string): Promise<void> {
    await db.insert(playerBlocks)
      .values({ blockerSessionKey: blockerKey, blockedPlayerKey })
      .onConflictDoNothing();
  }

  async createModerationReport(data: {
    reportType: string;
    reason: string;
    reporterSessionKey: string;
    targetPlayerKey?: string | null;
    targetName: string;
    galleryDrawingId?: string | null;
    gameId?: string | null;
    evidence: unknown;
  }): Promise<string> {
    const [report] = await db.insert(moderationReports).values({
      ...data,
      targetPlayerKey: data.targetPlayerKey || null,
      galleryDrawingId: data.galleryDrawingId || null,
      gameId: data.gameId || null,
    }).returning({ id: moderationReports.id });
    return report.id;
  }

  async getModerationReports(limit = 100): Promise<(typeof moderationReports.$inferSelect)[]> {
    return db.select().from(moderationReports)
      .orderBy(desc(moderationReports.createdAt))
      .limit(limit);
  }

  async getModerationReportAlertDeliveryStatus(id: string): Promise<string | undefined> {
    const [report] = await db.select({ status: moderationReports.alertDeliveryStatus })
      .from(moderationReports)
      .where(eq(moderationReports.id, id));
    return report?.status;
  }

  async claimFailedModerationReportAlertRetry(id: string): Promise<boolean> {
    const rows = await db.update(moderationReports)
      .set({ alertDeliveryStatus: "pending" })
      .where(and(
        eq(moderationReports.id, id),
        eq(moderationReports.alertDeliveryStatus, "failed"),
      ))
      .returning({ id: moderationReports.id });
    return rows.length > 0;
  }

  async updateModerationReportAlertDeliveryStatus(
    id: string,
    status: "pending" | "delivered" | "failed",
  ): Promise<boolean> {
    const rows = await db.update(moderationReports)
      .set({ alertDeliveryStatus: status })
      .where(eq(moderationReports.id, id))
      .returning({ id: moderationReports.id });
    return rows.length > 0;
  }

  async reviewModerationReport(id: string, status: string, reviewNote?: string): Promise<boolean> {
    const rows = await db.update(moderationReports)
      .set({
        status,
        reviewNote: reviewNote || null,
        reviewedAt: new Date(),
      })
      .where(eq(moderationReports.id, id))
      .returning({ id: moderationReports.id });
    return rows.length > 0;
  }
}

export const storage = new DatabaseStorage();
