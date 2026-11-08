import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { randomBytes, timingSafeEqual } from "crypto";
import rateLimit from "express-rate-limit";
import {
  storage,
  DeviceLinkedToOtherPlayerError,
  ProofAlreadyUsedError,
  type PlayerIdentity,
} from "./storage";
import { applyLinkedIdentity } from "./websocket";
import {
  createGameSchema,
  submitTurnSchema,
  insertGalleryDrawingSchema,
  createReportSchema,
  createPlayerBlockSchema,
  reviewReportSchema,
  gameCenterIdentityProofSchema,
} from "@shared/schema";
import { getRequestSessionKey, getSessionKey } from "./sessionIdentity";
import { filterDisplayName } from "@shared/contentFilter";
import {
  createDefaultGameCenterVerifier,
  GameCenterVerificationError,
  type GameCenterVerifier,
} from "./gameCenterVerifier";
import { moderationPage } from "./moderation-page";
import {
  getModerationNotificationStatus,
  ModerationNotificationError,
  sendModerationNotification,
} from "./moderation-notifications";

const GALLERY_MAX_BODY_SIZE = 2 * 1024 * 1024; // 2MB
const REPORT_NOTIFICATION_MAX_ATTEMPTS = 3;
const REPORT_NOTIFICATION_RETRY_DELAYS_MS = [500, 1_500] as const;
let isResumingModerationReportAlerts = false;
let nextModerationAlertScanErrorLogAt = 0;

async function deliverReportAlert(reportId: string): Promise<"delivered" | "failed" | "pending" | "unknown"> {
  let attempt: number | undefined;
  try {
    attempt = await storage.claimPendingModerationReportAlertAttempt(reportId);
  } catch (error) {
    console.error("Could not claim a pending moderation report notification.");
    return "pending";
  }
  if (attempt === undefined) return "pending";

  try {
    await sendModerationNotification("report_created", reportId);
  } catch (error) {
    const failureKind = error instanceof ModerationNotificationError ? error.kind : "permanent";
    const exhausted = attempt !== undefined && attempt >= REPORT_NOTIFICATION_MAX_ATTEMPTS;
    const shouldRetry = failureKind === "transient" && !exhausted;
    try {
      const nextAttemptAt = shouldRetry
        ? new Date(Date.now() + REPORT_NOTIFICATION_RETRY_DELAYS_MS[attempt - 1])
        : null;
      await storage.updateModerationReportAlertDeliveryStatus(
        reportId,
        shouldRetry ? "pending" : "failed",
        nextAttemptAt,
      );
    } catch {
      // The claim lease lets the worker recover if this status update fails or the process exits.
      console.error("Could not record moderation report notification delivery failure.");
    }
    console.warn(`Moderation report notification delivery failed (${failureKind}; attempt ${attempt}).`);
    return shouldRetry ? "pending" : "failed";
  }
  try {
    await storage.updateModerationReportAlertDeliveryStatus(reportId, "delivered", null);
    return "delivered";
  } catch {
    // Do not mark a successfully sent alert as failed; that could invite a duplicate retry.
    console.error("Could not record successful moderation report notification delivery.");
    return "unknown";
  }
}

export async function resumePendingModerationReportAlerts(): Promise<void> {
  if (isResumingModerationReportAlerts) return;
  isResumingModerationReportAlerts = true;
  try {
    const deliveries = await storage.getDueModerationReportAlertDeliveries();
    for (const delivery of deliveries) {
      if (delivery.alertDeliveryAttempts >= REPORT_NOTIFICATION_MAX_ATTEMPTS) {
        try {
          await storage.updateModerationReportAlertDeliveryStatus(delivery.id, "failed", null);
        } catch {
          console.error("Could not mark an exhausted moderation report notification as failed.");
        }
        continue;
      }
      await deliverReportAlert(delivery.id);
    }
  } catch {
    if (Date.now() >= nextModerationAlertScanErrorLogAt) {
      console.error("Could not load pending moderation report notifications.");
      nextModerationAlertScanErrorLogAt = Date.now() + 60_000;
    }
  } finally {
    isResumingModerationReportAlerts = false;
  }
}

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

function isValidAdminToken(supplied: string | undefined): boolean {
  const expected = process.env.SESSION_SECRET;
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

/** Resolves the device token header to the player it belongs to (Game Center account or device). */
async function getRequestPlayer(value: string | string[] | undefined): Promise<PlayerIdentity | null> {
  const deviceKey = getRequestSessionKey(value);
  if (!deviceKey) return null;
  return storage.resolvePlayerIdentity(deviceKey);
}

export type RegisterRoutesOptions = {
  gameCenterVerifier?: GameCenterVerifier;
  /** Game Center link attempts allowed per IP per minute. Defaults to 10. */
  identityLinksPerMinute?: number;
};

export async function registerRoutes(app: Express, options: RegisterRoutesOptions = {}): Promise<Server> {
  const gameCenterVerifier = options.gameCenterVerifier ?? createDefaultGameCenterVerifier();

  // The game REST endpoints are unauthenticated debugging helpers; the app
  // plays games exclusively over the WebSocket. Never expose them in
  // production, where they would let anyone list active games, read
  // in-progress drawings, or inject turns.
  if (process.env.NODE_ENV !== "production") {
    app.post(
      "/api/games",
      asyncHandler(async (req: Request, res: Response) => {
        const parsed = createGameSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            message: "Invalid request",
            errors: z.flattenError(parsed.error).fieldErrors,
          });
          return;
        }

        const game = await storage.createGame(parsed.data.player1Id);
        res.status(201).json(game);
      }),
    );

    app.get(
      "/api/games/:id",
      asyncHandler(async (req: Request, res: Response) => {
        const id = req.params.id;
        if (!id || typeof id !== "string") {
          res.status(400).json({ message: "Invalid game ID" });
          return;
        }

        const game = await storage.getGame(id);
        if (!game) {
          res.status(404).json({ message: "Game not found" });
          return;
        }

        const gameTurns = await storage.getTurnsByGame(id);
        const { player1SessionKey: _player1SessionKey, player2SessionKey: _player2SessionKey, ...safeGame } = game;
        res.json({ ...safeGame, turns: gameTurns });
      }),
    );

    app.get(
      "/api/games",
      asyncHandler(async (_req: Request, res: Response) => {
        const activeGames = await storage.getActiveGames();
        res.json(activeGames);
      }),
    );

    app.post(
      "/api/games/:id/turns",
      asyncHandler(async (req: Request, res: Response) => {
        const gameId = req.params.id;
        if (!gameId || typeof gameId !== "string") {
          res.status(400).json({ message: "Invalid game ID" });
          return;
        }

        const game = await storage.getGame(gameId);
        if (!game) {
          res.status(404).json({ message: "Game not found" });
          return;
        }

        if (game.status === "completed") {
          res.status(400).json({ message: "Game is already completed" });
          return;
        }

        const parsed = submitTurnSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            message: "Invalid turn data",
            errors: z.flattenError(parsed.error).fieldErrors,
          });
          return;
        }

        const { playerRole, round, strokes } = parsed.data;

        if (round !== game.currentRound) {
          res.status(400).json({
            message: `Expected round ${game.currentRound}, got ${round}`,
          });
          return;
        }

        if (playerRole !== game.currentPlayer) {
          res.status(400).json({
            message: `It is ${game.currentPlayer}'s turn, not ${playerRole}'s`,
          });
          return;
        }

        const turn = await storage.createTurn({
          gameId,
          playerRole,
          round,
          strokes,
        });

        const roundTurns = await storage.getTurnsByGameAndRound(gameId, round);
        const roundComplete = roundTurns.length >= 2;

        let nextRound = game.currentRound;
        let nextPlayer = playerRole === "player1" ? "player2" : "player1";
        let status = game.status;

        if (roundComplete) {
          if (game.currentRound >= game.totalRounds) {
            status = "completed";
          } else {
            nextRound = game.currentRound + 1;
            nextPlayer = "player1";
          }
        }

        const updatedGame = await storage.updateGame(gameId, {
          currentRound: nextRound,
          currentPlayer: nextPlayer,
          status,
          completedAt: status === "completed" ? new Date() : null,
        });

        res.status(201).json({
          turn,
          game: updatedGame,
          roundComplete,
          gameComplete: status === "completed",
        });
      }),
    );

    app.get(
      "/api/games/:id/turns",
      asyncHandler(async (req: Request, res: Response) => {
        const gameId = req.params.id;
        if (!gameId || typeof gameId !== "string") {
          res.status(400).json({ message: "Invalid game ID" });
          return;
        }

        const game = await storage.getGame(gameId);
        if (!game) {
          res.status(404).json({ message: "Game not found" });
          return;
        }

        const gameTurns = await storage.getTurnsByGame(gameId);
        res.json(gameTurns);
      }),
    );
  }

  const galleryRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many gallery requests, please slow down" },
  });

  app.post(
    "/api/gallery",
    galleryRateLimit,
    asyncHandler(async (req: Request, res: Response) => {
      const contentLength = parseInt(req.headers["content-length"] || "0", 10);
      if (contentLength > GALLERY_MAX_BODY_SIZE) {
        res.status(413).json({ message: "Request body too large" });
        return;
      }

      const parsed = insertGalleryDrawingSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          message: "Invalid drawing data",
          errors: z.flattenError(parsed.error).fieldErrors,
        });
        return;
      }

      const ownerDeviceKey = getSessionKey(parsed.data.sessionToken);
      const owner = ownerDeviceKey ? await storage.resolvePlayerIdentity(ownerDeviceKey) : null;
      const drawing = await storage.saveToGallery({
        playerName: parsed.data.playerName ? filterDisplayName(parsed.data.playerName) : undefined,
        opponentName: parsed.data.opponentName ? filterDisplayName(parsed.data.opponentName) : undefined,
        strokes: parsed.data.strokes,
        roundCount: parsed.data.roundCount,
        ownerPlayerKey: owner?.playerKey,
      });
      res.status(201).json({
        id: drawing.id,
        playerName: drawing.playerName,
        opponentName: drawing.opponentName,
        strokes: drawing.strokes,
        roundCount: drawing.roundCount,
        createdAt: drawing.createdAt,
      });
    }),
  );

  app.get(
    "/api/gallery",
    galleryRateLimit,
    asyncHandler(async (req: Request, res: Response) => {
      const limit = Math.min(
        Math.max(parseInt(req.query.limit as string) || 50, 1),
        100
      );
      const drawings = await storage.getGalleryDrawings(limit);
      res.json(
        drawings.map(({ sessionToken: _sessionToken, ownerPlayerKey: _ownerPlayerKey, ...rest }) => rest)
      );
    }),
  );

  app.delete(
    "/api/gallery/:id",
    galleryRateLimit,
    asyncHandler(async (req: Request, res: Response) => {
      const id = req.params.id;
      if (!id || typeof id !== "string") {
        res.status(400).json({ message: "Invalid drawing ID" });
        return;
      }

      const player = await getRequestPlayer(req.headers["x-session-token"]);
      if (!player) {
        res.status(401).json({ message: "Session token required" });
        return;
      }

      const drawing = await storage.getGalleryDrawing(id);
      if (!drawing) {
        res.status(404).json({ message: "Drawing not found" });
        return;
      }

      const deleted = await storage.deleteGalleryDrawingOwned(id, player.aliasKeys);
      if (!deleted) {
        res.status(403).json({ message: "You can only delete drawings saved on this device" });
        return;
      }
      res.json({ message: "Drawing deleted" });
    }),
  );

  const safetyRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many safety requests, please wait a moment" },
  });

  app.post(
    "/api/reports",
    safetyRateLimit,
    asyncHandler(async (req: Request, res: Response) => {
      const reporterDeviceKey = getRequestSessionKey(req.headers["x-session-token"]);
      if (!reporterDeviceKey) {
        res.status(401).json({ message: "A valid device session is required" });
        return;
      }

      const parsed = createReportSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Invalid report", errors: z.flattenError(parsed.error).fieldErrors });
        return;
      }
      const reporter = await storage.resolvePlayerIdentity(reporterDeviceKey);
      const reporterSessionKey = reporter.playerKey;

      let reportId: string;
      if (parsed.data.reportType === "gallery") {
        const drawing = await storage.getGalleryDrawing(parsed.data.galleryDrawingId);
        if (!drawing) {
          res.status(404).json({ message: "Drawing not found" });
          return;
        }
        const ownerKey = drawing.ownerPlayerKey ?? getSessionKey(drawing.sessionToken);
        const targetPlayerKey = ownerKey ? (await storage.resolvePlayerIdentity(ownerKey)).playerKey : null;
        reportId = await storage.createModerationReport({
          reportType: "gallery",
          reason: parsed.data.reason,
          reporterSessionKey,
          targetPlayerKey,
          targetName: filterDisplayName(drawing.playerName || "Unknown"),
          galleryDrawingId: drawing.id,
          evidence: {
            drawing: {
              playerName: filterDisplayName(drawing.playerName),
              opponentName: filterDisplayName(drawing.opponentName),
              strokes: drawing.strokes,
            },
          },
        });
      } else {
        const game = await storage.getGame(parsed.data.gameId);
        if (!game) {
          res.status(404).json({ message: "Match not found" });
          return;
        }
        const isPlayer1 = Boolean(game.player1SessionKey && reporter.aliasKeys.includes(game.player1SessionKey));
        const isPlayer2 = Boolean(game.player2SessionKey && reporter.aliasKeys.includes(game.player2SessionKey));
        const opponentKey = isPlayer1 ? game.player2SessionKey : isPlayer2 ? game.player1SessionKey : null;
        if (!opponentKey) {
          res.status(403).json({ message: "You can only report a player from your own match" });
          return;
        }
        const targetPlayerKey = (await storage.resolvePlayerIdentity(opponentKey)).playerKey;
        const opponentRole = isPlayer1 ? "player2" : "player1";
        const matchTurns = await storage.getTurnsByGame(parsed.data.gameId);
        reportId = await storage.createModerationReport({
          reportType: "match",
          reason: parsed.data.reason,
          reporterSessionKey,
          targetPlayerKey,
          targetName: "Match opponent",
          gameId: game.id,
          evidence: {
            gameId: game.id,
            turns: matchTurns
              .filter((turn) => turn.playerRole === opponentRole)
              .map((turn) => ({ round: turn.round, strokes: turn.strokes })),
          },
        });
      }

      void deliverReportAlert(reportId);

      res.status(201).json({ message: "Report received. Thank you for helping keep SketchDuel safe." });
    }),
  );

  app.post(
    "/api/blocks",
    safetyRateLimit,
    asyncHandler(async (req: Request, res: Response) => {
      const blockerDeviceKey = getRequestSessionKey(req.headers["x-session-token"]);
      if (!blockerDeviceKey) {
        res.status(401).json({ message: "A valid device session is required" });
        return;
      }
      const parsed = createPlayerBlockSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Invalid player block" });
        return;
      }
      const blocker = await storage.resolvePlayerIdentity(blockerDeviceKey);
      const blocked = await storage.resolvePlayerIdentity(parsed.data.blockedPlayerId);
      if (
        blocker.playerKey === blocked.playerKey ||
        !(await storage.havePlayedTogether(blocker.aliasKeys, blocked.aliasKeys))
      ) {
        res.status(403).json({ message: "You can only block someone you have played with" });
        return;
      }
      await storage.blockPlayer(blocker.playerKey, blocked.playerKey);
      res.status(201).json({ message: "This player will not be matched with you again" });
    }),
  );

  app.get("/moderation/reports", (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(moderationPage);
  });

  app.get(
    "/api/moderation/reports",
    asyncHandler(async (req: Request, res: Response) => {
      if (!isValidAdminToken(req.header("x-moderation-admin-token"))) {
        res.status(process.env.SESSION_SECRET ? 401 : 503).json({ message: "Moderation access unavailable" });
        return;
      }
      const reports = await storage.getModerationReports();
      res.setHeader("Cache-Control", "no-store");
      res.json(reports.map(({ reporterSessionKey, targetPlayerKey, ...report }) => report));
    }),
  );

  app.get(
    "/api/moderation/notification-status",
    (req: Request, res: Response) => {
      if (!isValidAdminToken(req.header("x-moderation-admin-token"))) {
        res.status(process.env.SESSION_SECRET ? 401 : 503).json({ message: "Moderation access unavailable" });
        return;
      }
      res.setHeader("Cache-Control", "no-store");
      res.json({ status: getModerationNotificationStatus() });
    },
  );

  app.post(
    "/api/moderation/notification-test",
    asyncHandler(async (req: Request, res: Response) => {
      if (!isValidAdminToken(req.header("x-moderation-admin-token"))) {
        res.status(process.env.SESSION_SECRET ? 401 : 503).json({ message: "Moderation access unavailable" });
        return;
      }
      try {
        await sendModerationNotification("test");
        res.json({ message: "Test notification delivered." });
      } catch {
        const status = getModerationNotificationStatus();
        res.status(status === "configured" ? 502 : 503).json({
          message: status === "configured" || status === "signing_secret_missing"
            ? "The notification destination did not accept the test."
            : "Owner notifications are not configured with a valid HTTPS destination.",
        });
      }
    }),
  );

  app.post(
    "/api/moderation/reports/:id/notification-retry",
    asyncHandler(async (req: Request, res: Response) => {
      if (!isValidAdminToken(req.header("x-moderation-admin-token"))) {
        res.status(process.env.SESSION_SECRET ? 401 : 503).json({ message: "Moderation access unavailable" });
        return;
      }
      const reportId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const claimed = await storage.claimFailedModerationReportAlertRetry(reportId);
      if (!claimed) {
        const currentStatus = await storage.getModerationReportAlertDeliveryStatus(reportId);
        if (currentStatus === undefined) {
          res.status(404).json({ message: "Report not found" });
          return;
        }
        res.status(409).json({ message: "Only failed report alerts can be retried." });
        return;
      }
      const deliveryResult = await deliverReportAlert(reportId);
      if (deliveryResult === "failed") {
        res.status(502).json({ message: "Report alert delivery failed. You can try again." });
        return;
      }
      if (deliveryResult === "pending") {
        res.status(202).json({ message: "Report alert is queued for another delivery attempt." });
        return;
      }
      if (deliveryResult === "unknown") {
        res.status(503).json({ message: "The alert was sent, but its delivery status could not be recorded." });
        return;
      }
      res.json({ message: "Report alert delivered." });
    }),
  );

  app.patch(
    "/api/moderation/reports/:id",
    asyncHandler(async (req: Request, res: Response) => {
      if (!isValidAdminToken(req.header("x-moderation-admin-token"))) {
        res.status(process.env.SESSION_SECRET ? 401 : 503).json({ message: "Moderation access unavailable" });
        return;
      }
      const parsed = reviewReportSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Invalid review update" });
        return;
      }
      const reportId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const updated = await storage.reviewModerationReport(
        reportId,
        parsed.data.status,
        parsed.data.reviewNote,
      );
      if (!updated) {
        res.status(404).json({ message: "Report not found" });
        return;
      }
      res.json({ message: "Report updated" });
    }),
  );

  const identityRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: options.identityLinksPerMinute ?? 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many sign-in attempts, please wait a moment" },
  });

  app.post(
    "/api/identity/game-center",
    identityRateLimit,
    asyncHandler(async (req: Request, res: Response) => {
      const deviceKey = getRequestSessionKey(req.headers["x-session-token"]);
      if (!deviceKey) {
        res.status(401).json({ message: "A valid device session is required" });
        return;
      }
      const parsed = gameCenterIdentityProofSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Invalid Game Center identity proof" });
        return;
      }

      let verified;
      try {
        verified = await gameCenterVerifier(parsed.data);
      } catch (error) {
        if (error instanceof GameCenterVerificationError) {
          console.warn(`Game Center proof rejected: ${error.reason}`);
          const status = error.reason === "certificate_unavailable" ? 503 : 401;
          res.status(status).json({ message: "Game Center sign-in could not be verified" });
          return;
        }
        throw error;
      }

      try {
        const linked = await storage.linkGameCenterPlayer({
          gameCenterPlayerId: verified.playerId,
          deviceKey,
          proofHash: verified.proofHash,
          newPlayerKey: randomBytes(32).toString("hex"),
        });
        try {
          applyLinkedIdentity(deviceKey, await storage.resolvePlayerIdentity(deviceKey));
        } catch (refreshError) {
          // The link is saved; open connections pick it up when they reconnect.
          console.error(
            "Could not refresh connections after a Game Center link:",
            refreshError instanceof Error ? refreshError.message : refreshError,
          );
        }
        res.json({ linked: true, isNewAccount: linked.isNewAccount });
      } catch (error) {
        if (error instanceof ProofAlreadyUsedError) {
          res.status(401).json({ message: "Game Center sign-in could not be verified" });
          return;
        }
        if (error instanceof DeviceLinkedToOtherPlayerError) {
          res.status(409).json({
            message: "This device is linked to a different player",
            code: "DEVICE_LINKED_TO_OTHER_PLAYER",
          });
          return;
        }
        throw error;
      }
    }),
  );

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}
