import { eq, and, desc, or, notExists, lte, lt, sql, inArray, isNull } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  games,
  turns,
  galleryDrawings,
  playerBlocks,
  moderationReports,
  playerAccounts,
  playerDeviceLinks,
  gameCenterProofUses,
  type User,
  type InsertUser,
  type Game,
  type Turn,
  type GalleryDrawing,
} from "@shared/schema";
import { filterDisplayName } from "@shared/contentFilter";

export type PlayerIdentity = {
  /** Canonical key for new records (games, blocks, reports, gallery ownership). */
  playerKey: string;
  /** Every key whose history belongs to this player, including playerKey. */
  aliasKeys: string[];
  /** The linked Game Center player (team-scoped ID), or null for a device-only player. */
  gameCenterPlayerId: string | null;
};

/** A SketchDuel account found by its Game Center player ID. */
export type FriendAccount = {
  gameCenterPlayerId: string;
  playerKey: string;
  aliasKeys: string[];
};

export class ProofAlreadyUsedError extends Error {
  constructor() {
    super("This identity proof has already been used");
    this.name = "ProofAlreadyUsedError";
  }
}

/**
 * The device token is already linked to a different Game Center player. A
 * device never moves between players: its history belongs to the first one,
 * so the app must start a fresh device identity instead.
 */
export class DeviceLinkedToOtherPlayerError extends Error {
  constructor() {
    super("This device is linked to a different player");
    this.name = "DeviceLinkedToOtherPlayerError";
  }
}

const PROOF_RETENTION_MS = 15 * 60_000;

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
    ownerPlayerKey?: string;
  }): Promise<GalleryDrawing>;
  getGalleryDrawings(limit?: number): Promise<GalleryDrawing[]>;
  getGalleryDrawing(id: string): Promise<GalleryDrawing | undefined>;
  deleteGalleryDrawingOwned(id: string, ownerKeys: string[]): Promise<boolean>;
  arePlayersBlocked(firstKeys: string[], secondKeys: string[]): Promise<boolean>;
  havePlayedTogether(firstKeys: string[], secondKeys: string[]): Promise<boolean>;
  resolvePlayerIdentity(key: string): Promise<PlayerIdentity>;
  findFriendAccounts(gameCenterPlayerIds: string[]): Promise<FriendAccount[]>;
  findBlockedPlayerKeys(playerKeys: string[], others: Pick<FriendAccount, "playerKey" | "aliasKeys">[]): Promise<Set<string>>;
  linkGameCenterPlayer(data: {
    gameCenterPlayerId: string;
    deviceKey: string;
    proofHash: string;
    newPlayerKey: string;
  }): Promise<{ playerKey: string; isNewAccount: boolean }>;
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
  getDueModerationReportAlertDeliveries(limit?: number): Promise<Pick<typeof moderationReports.$inferSelect, "id" | "alertDeliveryAttempts">[]>;
  claimPendingModerationReportAlertAttempt(id: string): Promise<number | undefined>;
  getModerationReportAlertDeliveryStatus(id: string): Promise<string | undefined>;
  claimFailedModerationReportAlertRetry(id: string): Promise<boolean>;
  updateModerationReportAlertDeliveryStatus(
    id: string,
    status: "pending" | "delivered" | "failed",
    nextAttemptAt?: Date | null,
  ): Promise<boolean>;
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
    ownerPlayerKey?: string;
  }): Promise<GalleryDrawing> {
    const [drawing] = await db
      .insert(galleryDrawings)
      .values({
        playerName: filterDisplayName(data.playerName || "Anonymous"),
        opponentName: filterDisplayName(data.opponentName || "Unknown"),
        strokes: data.strokes,
        roundCount: data.roundCount || 3,
        ownerPlayerKey: data.ownerPlayerKey || null,
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

  async deleteGalleryDrawingOwned(id: string, ownerKeys: string[]): Promise<boolean> {
    if (ownerKeys.length === 0) return false;
    // Older rows stored the raw device token instead of an owner key; derive
    // the same one-way key in SQL so those drawings stay deletable by their owner.
    const legacyOwnerKey = sql`encode(sha256(convert_to(lower(${galleryDrawings.sessionToken}), 'UTF8')), 'hex')`;
    const result = await db.delete(galleryDrawings)
      .where(and(
        eq(galleryDrawings.id, id),
        or(
          inArray(galleryDrawings.ownerPlayerKey, ownerKeys),
          and(
            isNull(galleryDrawings.ownerPlayerKey),
            inArray(legacyOwnerKey, ownerKeys),
          ),
        ),
      ))
      .returning({ id: galleryDrawings.id });
    return result.length > 0;
  }

  async arePlayersBlocked(firstKeys: string[], secondKeys: string[]): Promise<boolean> {
    if (firstKeys.length === 0 || secondKeys.length === 0) return false;
    const [block] = await db
      .select({ id: playerBlocks.id })
      .from(playerBlocks)
      .where(or(
        and(
          inArray(playerBlocks.blockerSessionKey, firstKeys),
          inArray(playerBlocks.blockedPlayerKey, secondKeys),
        ),
        and(
          inArray(playerBlocks.blockerSessionKey, secondKeys),
          inArray(playerBlocks.blockedPlayerKey, firstKeys),
        ),
      ))
      .limit(1);
    return Boolean(block);
  }

  async havePlayedTogether(firstKeys: string[], secondKeys: string[]): Promise<boolean> {
    if (firstKeys.length === 0 || secondKeys.length === 0) return false;
    const [game] = await db.select({ id: games.id })
      .from(games)
      .where(or(
        and(
          inArray(games.player1SessionKey, firstKeys),
          inArray(games.player2SessionKey, secondKeys),
        ),
        and(
          inArray(games.player1SessionKey, secondKeys),
          inArray(games.player2SessionKey, firstKeys),
        ),
      ))
      .limit(1);
    return Boolean(game);
  }

  async resolvePlayerIdentity(key: string): Promise<PlayerIdentity> {
    const [link] = await db.select({ playerKey: playerDeviceLinks.playerKey })
      .from(playerDeviceLinks)
      .where(eq(playerDeviceLinks.deviceKey, key));
    const playerKey = link?.playerKey ?? key;
    const linkedDevices = await db.select({ deviceKey: playerDeviceLinks.deviceKey })
      .from(playerDeviceLinks)
      .where(eq(playerDeviceLinks.playerKey, playerKey));
    const aliasKeys = Array.from(new Set([playerKey, ...linkedDevices.map((row) => row.deviceKey)]));
    const [account] = await db.select({ gameCenterPlayerId: playerAccounts.gameCenterPlayerId })
      .from(playerAccounts)
      .where(eq(playerAccounts.playerKey, playerKey));
    return { playerKey, aliasKeys, gameCenterPlayerId: account?.gameCenterPlayerId ?? null };
  }

  /** The accounts (with every key their history uses) for these Game Center player IDs. */
  async findFriendAccounts(gameCenterPlayerIds: string[]): Promise<FriendAccount[]> {
    if (gameCenterPlayerIds.length === 0) return [];
    const accounts = await db.select({
      gameCenterPlayerId: playerAccounts.gameCenterPlayerId,
      playerKey: playerAccounts.playerKey,
    })
      .from(playerAccounts)
      .where(inArray(playerAccounts.gameCenterPlayerId, gameCenterPlayerIds));
    if (accounts.length === 0) return [];
    const links = await db.select({ deviceKey: playerDeviceLinks.deviceKey, playerKey: playerDeviceLinks.playerKey })
      .from(playerDeviceLinks)
      .where(inArray(playerDeviceLinks.playerKey, accounts.map((account) => account.playerKey)));
    const devicesByAccount = new Map<string, string[]>();
    for (const row of links) {
      const devices = devicesByAccount.get(row.playerKey) ?? [];
      devices.push(row.deviceKey);
      devicesByAccount.set(row.playerKey, devices);
    }
    return accounts.map((account) => ({
      ...account,
      aliasKeys: [account.playerKey, ...(devicesByAccount.get(account.playerKey) ?? [])],
    }));
  }

  /** Which of `others` (by playerKey) have a block with this player, in either direction. */
  async findBlockedPlayerKeys(
    playerKeys: string[],
    others: Pick<FriendAccount, "playerKey" | "aliasKeys">[],
  ): Promise<Set<string>> {
    const accountByKey = new Map<string, string>();
    for (const other of others) {
      for (const key of other.aliasKeys) accountByKey.set(key, other.playerKey);
    }
    const otherKeys = Array.from(accountByKey.keys());
    if (playerKeys.length === 0 || otherKeys.length === 0) return new Set();
    const rows = await db.select({
      blocker: playerBlocks.blockerSessionKey,
      blocked: playerBlocks.blockedPlayerKey,
    })
      .from(playerBlocks)
      .where(or(
        and(inArray(playerBlocks.blockerSessionKey, playerKeys), inArray(playerBlocks.blockedPlayerKey, otherKeys)),
        and(inArray(playerBlocks.blockerSessionKey, otherKeys), inArray(playerBlocks.blockedPlayerKey, playerKeys)),
      ));
    const blocked = new Set<string>();
    for (const row of rows) {
      const account = accountByKey.get(row.blocked) ?? accountByKey.get(row.blocker);
      if (account) blocked.add(account);
    }
    return blocked;
  }

  async linkGameCenterPlayer(data: {
    gameCenterPlayerId: string;
    deviceKey: string;
    proofHash: string;
    newPlayerKey: string;
  }): Promise<{ playerKey: string; isNewAccount: boolean }> {
    return db.transaction(async (tx) => {
      await tx.delete(gameCenterProofUses)
        .where(lt(gameCenterProofUses.usedAt, new Date(Date.now() - PROOF_RETENTION_MS)));
      const proofRows = await tx.insert(gameCenterProofUses)
        .values({ proofHash: data.proofHash })
        .onConflictDoNothing()
        .returning({ proofHash: gameCenterProofUses.proofHash });
      if (proofRows.length === 0) throw new ProofAlreadyUsedError();

      const created = await tx.insert(playerAccounts)
        .values({ gameCenterPlayerId: data.gameCenterPlayerId, playerKey: data.newPlayerKey })
        .onConflictDoNothing({ target: playerAccounts.gameCenterPlayerId })
        .returning({ playerKey: playerAccounts.playerKey });
      let playerKey: string;
      if (created.length > 0) {
        playerKey = created[0].playerKey;
      } else {
        const [account] = await tx.update(playerAccounts)
          .set({ lastSignedInAt: new Date() })
          .where(eq(playerAccounts.gameCenterPlayerId, data.gameCenterPlayerId))
          .returning({ playerKey: playerAccounts.playerKey });
        playerKey = account.playerKey;
      }

      const inserted = await tx.insert(playerDeviceLinks)
        .values({ deviceKey: data.deviceKey, playerKey })
        .onConflictDoNothing({ target: playerDeviceLinks.deviceKey })
        .returning({ playerKey: playerDeviceLinks.playerKey });
      if (inserted.length === 0) {
        const [existing] = await tx.select({ playerKey: playerDeviceLinks.playerKey })
          .from(playerDeviceLinks)
          .where(eq(playerDeviceLinks.deviceKey, data.deviceKey))
          .for("update");
        // Rolls back the whole transaction, including the proof use and any
        // new account, so the app can retry the same proof with a fresh token.
        if (existing.playerKey !== playerKey) throw new DeviceLinkedToOtherPlayerError();
        await tx.update(playerDeviceLinks)
          .set({ linkedAt: new Date() })
          .where(eq(playerDeviceLinks.deviceKey, data.deviceKey));
      }

      return { playerKey, isNewAccount: created.length > 0 };
    });
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

  async getDueModerationReportAlertDeliveries(
    limit = 100,
  ): Promise<Pick<typeof moderationReports.$inferSelect, "id" | "alertDeliveryAttempts">[]> {
    return db.select({
      id: moderationReports.id,
      alertDeliveryAttempts: moderationReports.alertDeliveryAttempts,
    })
      .from(moderationReports)
      .where(and(
        eq(moderationReports.alertDeliveryStatus, "pending"),
        lte(moderationReports.alertDeliveryNextAttemptAt, new Date()),
      ))
      .orderBy(moderationReports.alertDeliveryNextAttemptAt)
      .limit(limit);
  }

  async claimPendingModerationReportAlertAttempt(id: string): Promise<number | undefined> {
    const now = new Date();
    // A short lease recovers work if the process exits while the webhook request is in flight.
    const leaseUntil = new Date(now.getTime() + 7_000);
    const rows = await db.update(moderationReports)
      .set({
        alertDeliveryAttempts: sql`${moderationReports.alertDeliveryAttempts} + 1`,
        alertDeliveryNextAttemptAt: leaseUntil,
      })
      .where(and(
        eq(moderationReports.id, id),
        eq(moderationReports.alertDeliveryStatus, "pending"),
        lte(moderationReports.alertDeliveryNextAttemptAt, now),
        sql`${moderationReports.alertDeliveryAttempts} < 3`,
      ))
      .returning({ attempts: moderationReports.alertDeliveryAttempts });
    return rows[0]?.attempts;
  }

  async getModerationReportAlertDeliveryStatus(id: string): Promise<string | undefined> {
    const [report] = await db.select({ status: moderationReports.alertDeliveryStatus })
      .from(moderationReports)
      .where(eq(moderationReports.id, id));
    return report?.status;
  }

  async claimFailedModerationReportAlertRetry(id: string): Promise<boolean> {
    const rows = await db.update(moderationReports)
      .set({
        alertDeliveryStatus: "pending",
        alertDeliveryAttempts: 0,
        alertDeliveryNextAttemptAt: new Date(),
      })
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
    nextAttemptAt: Date | null = null,
  ): Promise<boolean> {
    const rows = await db.update(moderationReports)
      .set({
        alertDeliveryStatus: status,
        alertDeliveryNextAttemptAt: nextAttemptAt,
      })
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
