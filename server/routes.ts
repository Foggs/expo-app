import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import { createGameSchema, submitTurnSchema, insertGalleryDrawingSchema } from "@shared/schema";

const GALLERY_MAX_BODY_SIZE = 2 * 1024 * 1024; // 2MB

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
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
      res.json({ ...game, turns: gameTurns });
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
        playerName: parsed.data.playerName,
        opponentName: parsed.data.opponentName,
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

      if (drawing.sessionToken && drawing.sessionToken !== sessionToken) {
        res.status(403).json({ message: "Not authorized to delete this drawing" });
        return;
      }

      const deleted = await storage.deleteGalleryDrawing(id);
      if (!deleted) {
        res.status(404).json({ message: "Drawing not found" });
        return;
      }
      res.json({ message: "Drawing deleted" });
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
