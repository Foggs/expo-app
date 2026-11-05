import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { timingSafeEqual } from "crypto";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import {
  createGameSchema,
  submitTurnSchema,
  insertGalleryDrawingSchema,
  createReportSchema,
  createPlayerBlockSchema,
  reviewReportSchema,
} from "@shared/schema";
import { getRequestSessionKey, getSessionKey } from "./sessionIdentity";
import { filterDisplayName } from "@shared/contentFilter";
import { moderationPage } from "./moderation-page";
import {
  getModerationNotificationStatus,
  sendModerationNotification,
} from "./moderation-notifications";

const GALLERY_MAX_BODY_SIZE = 2 * 1024 * 1024; // 2MB

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

export async function registerRoutes(app: Express): Promise<Server> {
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
            errors: parsed.error.flatten().fieldErrors,
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
            errors: parsed.error.flatten().fieldErrors,
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
          errors: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      const drawing = await storage.saveToGallery({
        playerName: parsed.data.playerName ? filterDisplayName(parsed.data.playerName) : undefined,
        opponentName: parsed.data.opponentName ? filterDisplayName(parsed.data.opponentName) : undefined,
        strokes: parsed.data.strokes,
        roundCount: parsed.data.roundCount,
        sessionToken: parsed.data.sessionToken,
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
        drawings.map(({ sessionToken, ...rest }) => rest)
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

      const sessionToken = req.headers["x-session-token"] as string | undefined;
      if (!sessionToken) {
        res.status(401).json({ message: "Session token required" });
        return;
      }

      const drawing = await storage.getGalleryDrawing(id);
      if (!drawing) {
        res.status(404).json({ message: "Drawing not found" });
        return;
      }

      const deleted = await storage.deleteGalleryDrawingOwned(id, sessionToken);
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
      const reporterSessionKey = getRequestSessionKey(req.headers["x-session-token"]);
      if (!reporterSessionKey) {
        res.status(401).json({ message: "A valid device session is required" });
        return;
      }

      const parsed = createReportSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Invalid report", errors: parsed.error.flatten().fieldErrors });
        return;
      }

      if (parsed.data.reportType === "gallery") {
        const drawing = await storage.getGalleryDrawing(parsed.data.galleryDrawingId);
        if (!drawing) {
          res.status(404).json({ message: "Drawing not found" });
          return;
        }
        await storage.createModerationReport({
          reportType: "gallery",
          reason: parsed.data.reason,
          reporterSessionKey,
          targetPlayerKey: getSessionKey(drawing.sessionToken),
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
        const targetPlayerKey =
          game.player1SessionKey === reporterSessionKey
            ? game.player2SessionKey
            : game.player2SessionKey === reporterSessionKey
              ? game.player1SessionKey
              : null;
        if (!targetPlayerKey) {
          res.status(403).json({ message: "You can only report a player from your own match" });
          return;
        }
        const opponentRole =
          game.player1SessionKey === reporterSessionKey ? "player2" : "player1";
        const matchTurns = await storage.getTurnsByGame(parsed.data.gameId);
        await storage.createModerationReport({
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

      void sendModerationNotification("report_created").catch(() => {
        console.warn("Moderation report notification delivery failed.");
      });

      res.status(201).json({ message: "Report received. Thank you for helping keep SketchDuel safe." });
    }),
  );

  app.post(
    "/api/blocks",
    safetyRateLimit,
    asyncHandler(async (req: Request, res: Response) => {
      const blockerKey = getRequestSessionKey(req.headers["x-session-token"]);
      if (!blockerKey) {
        res.status(401).json({ message: "A valid device session is required" });
        return;
      }
      const parsed = createPlayerBlockSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Invalid player block" });
        return;
      }
      const { blockedPlayerId } = parsed.data;
      if (blockerKey === blockedPlayerId || !(await storage.havePlayedTogether(blockerKey, blockedPlayerId))) {
        res.status(403).json({ message: "You can only block someone you have played with" });
        return;
      }
      await storage.blockPlayer(blockerKey, blockedPlayerId);
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
          message: status === "configured"
            ? "The notification destination did not accept the test."
            : "Owner notifications are not configured with a valid HTTPS destination.",
        });
      }
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
