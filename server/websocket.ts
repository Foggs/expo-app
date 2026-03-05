import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { IncomingMessage } from "http";
import { wsClientMessageSchema, type WsServerMessage, type WsClientMessage } from "@shared/schema";
import { storage } from "./storage";

const MAX_MESSAGE_SIZE = 512 * 1024; // 512KB
const HEARTBEAT_INTERVAL = 30_000;
const HEARTBEAT_TIMEOUT = 10_000;
const MAX_MESSAGES_PER_MINUTE = 300;
const MATCHMAKING_TIMEOUT = 120_000; // 2 minutes
const RATE_LIMIT_WINDOW = 60_000;
const ROOM_CLEANUP_INTERVAL = 60_000;
const ROOM_CLEANUP_DELAY = 120_000; // 2 minutes after completion

interface PlayerConnection {
  ws: WebSocket;
  id: string;
  playerName: string;
  gameId: string | null;
  playerRole: "player1" | "player2" | null;
  isAlive: boolean;
  messageCount: number;
  rateLimitReset: number;
  joinedAt: number;
}

interface GameRoom {
  gameId: string;
  player1: PlayerConnection | null;
  player2: PlayerConnection | null;
  currentRound: number;
  currentPlayer: "player1" | "player2";
  totalRounds: number;
  status: string;
  completedAt: number | null;
}

const connections = new Map<string, PlayerConnection>();
const matchmakingQueue: string[] = [];
const gameRooms = new Map<string, GameRoom>();
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let matchmakingTimer: ReturnType<typeof setInterval> | null = null;
let roomCleanupTimer: ReturnType<typeof setInterval> | null = null;

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function generatePlayerName(): string {
  const adjectives = ["Swift", "Bold", "Clever", "Daring", "Eager", "Fierce", "Gentle", "Happy", "Keen", "Lively", "Mighty", "Noble"];
  const nouns = ["Artist", "Painter", "Sketcher", "Drawer", "Creator", "Doodler", "Crafter", "Maker", "Scriber", "Designer"];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}${noun}${num}`;
}

function sendMessage(conn: PlayerConnection, message: WsServerMessage): void {
  if (conn.ws.readyState === WebSocket.OPEN) {
    try {
      conn.ws.send(JSON.stringify(message));
    } catch {
      // Connection might have closed between check and send
    }
  }
}

function isRateLimited(conn: PlayerConnection): boolean {
  const now = Date.now();
  if (now > conn.rateLimitReset) {
    conn.messageCount = 0;
    conn.rateLimitReset = now + RATE_LIMIT_WINDOW;
  }
  conn.messageCount++;
  return conn.messageCount > MAX_MESSAGES_PER_MINUTE;
}

function validateOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // Allow connections without origin (native apps)

  let hostname: string;
  try {
    hostname = new URL(origin).hostname;
  } catch {
    return false;
  }

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return true;
  }

  if (process.env.REPLIT_DEV_DOMAIN) {
    const devDomain = process.env.REPLIT_DEV_DOMAIN;
    if (hostname === devDomain || hostname.endsWith("." + devDomain)) {
      return true;
    }
  }

  if (process.env.REPLIT_DOMAINS) {
    const domains = process.env.REPLIT_DOMAINS.split(",").map(d => d.trim());
    for (const domain of domains) {
      if (hostname === domain || hostname.endsWith("." + domain)) return true;
    }
  }

  return false;
}

function removeFromQueue(connId: string): void {
  const idx = matchmakingQueue.indexOf(connId);
  if (idx !== -1) {
    matchmakingQueue.splice(idx, 1);
  }
}

function cleanupConnection(connId: string): void {
  const conn = connections.get(connId);
  if (!conn) return;

  removeFromQueue(connId);

  if (conn.gameId && conn.playerRole) {
    const room = gameRooms.get(conn.gameId);
    if (room) {
      const otherRole = conn.playerRole === "player1" ? "player2" : "player1";
      const otherConn = room[otherRole];

      room[conn.playerRole] = null;

      if (otherConn) {
        sendMessage(otherConn, { type: "opponent_disconnected" });
      }

      if (room.status !== "completed") {
        room.status = "abandoned";
        room.completedAt = Date.now();
        storage.updateGame(conn.gameId, { status: "abandoned" }).catch((err) => {
          console.error(`Failed to mark game ${conn.gameId} as abandoned:`, err);
        });
      }

      if (!room.player1 && !room.player2) {
        gameRooms.delete(conn.gameId);
      }
    }
  }

  connections.delete(connId);
}

async function attemptMatchmaking(): Promise<void> {
  while (matchmakingQueue.length >= 2) {
    const p1Id = matchmakingQueue.shift()!;
    const p2Id = matchmakingQueue.shift()!;

    const p1 = connections.get(p1Id);
    const p2 = connections.get(p2Id);

    if (!p1 || p1.ws.readyState !== WebSocket.OPEN) {
      if (p2 && p2.ws.readyState === WebSocket.OPEN) {
        matchmakingQueue.unshift(p2Id);
      }
      continue;
    }

    if (!p2 || p2.ws.readyState !== WebSocket.OPEN) {
      matchmakingQueue.unshift(p1Id);
      continue;
    }

    try {
      const game = await storage.createGame();
      const gameId = game.id;

      const room: GameRoom = {
        gameId,
        player1: p1,
        player2: p2,
        currentRound: 1,
        currentPlayer: "player1",
        totalRounds: 3,
        status: "active",
        completedAt: null,
      };

      gameRooms.set(gameId, room);

      p1.gameId = gameId;
      p1.playerRole = "player1";
      p2.gameId = gameId;
      p2.playerRole = "player2";

      await storage.updateGame(gameId, { status: "active" });

      sendMessage(p1, {
        type: "match_found",
        gameId,
        playerRole: "player1",
        opponentName: p2.playerName,
      });

      sendMessage(p2, {
        type: "match_found",
        gameId,
        playerRole: "player2",
        opponentName: p1.playerName,
      });

      sendMessage(p1, {
        type: "game_state",
        gameId,
        currentRound: 1,
        currentPlayer: "player1",
        totalRounds: 3,
        status: "active",
      });

      sendMessage(p2, {
        type: "game_state",
        gameId,
        currentRound: 1,
        currentPlayer: "player1",
        totalRounds: 3,
        status: "active",
      });

      console.log(`Match created: ${p1.playerName} vs ${p2.playerName} (game ${gameId})`);
    } catch (err) {
      console.error("Failed to create match:", err);
      matchmakingQueue.unshift(p1Id);
      matchmakingQueue.unshift(p2Id);
    }
  }
}

async function handleSubmitTurn(conn: PlayerConnection, strokes: unknown[]): Promise<void> {
  if (!conn.gameId || !conn.playerRole) {
    sendMessage(conn, { type: "error", message: "Not in a game", code: "NOT_IN_GAME" });
    return;
  }

  const room = gameRooms.get(conn.gameId);
  if (!room) {
    sendMessage(conn, { type: "error", message: "Game room not found", code: "ROOM_NOT_FOUND" });
    return;
  }

  if (room.status === "completed") {
    sendMessage(conn, { type: "error", message: "Game is already completed", code: "GAME_COMPLETED" });
    return;
  }

  if (room.currentPlayer !== conn.playerRole) {
    sendMessage(conn, { type: "error", message: "Not your turn", code: "NOT_YOUR_TURN" });
    return;
  }

  try {
    await storage.createTurn({
      gameId: conn.gameId,
      playerRole: conn.playerRole,
      round: room.currentRound,
      strokes,
    });

    const otherRole = conn.playerRole === "player1" ? "player2" : "player1";
    const otherConn = room[otherRole];

    if (otherConn) {
      sendMessage(otherConn, {
        type: "turn_submitted",
        playerRole: conn.playerRole,
        round: room.currentRound,
        strokes,
      });
    }

    sendMessage(conn, {
      type: "turn_submitted",
      playerRole: conn.playerRole,
      round: room.currentRound,
      strokes,
    });

    if (room.currentPlayer === "player2") {
      if (room.currentRound >= room.totalRounds) {
        room.status = "completed";
        room.completedAt = Date.now();
        room.currentPlayer = "player1";

        await storage.updateGame(conn.gameId, {
          status: "completed",
          completedAt: new Date(),
          currentRound: room.currentRound,
          currentPlayer: "player1",
        });

        const completeMsg: WsServerMessage = { type: "game_complete", gameId: conn.gameId };
        if (room.player1) sendMessage(room.player1, completeMsg);
        if (room.player2) sendMessage(room.player2, completeMsg);

        console.log(`Game ${conn.gameId} completed`);
      } else {
        const nextRound = room.currentRound + 1;
        room.currentRound = nextRound;
        room.currentPlayer = "player1";

        await storage.updateGame(conn.gameId, {
          currentRound: nextRound,
          currentPlayer: "player1",
        });

        const roundMsg: WsServerMessage = {
          type: "round_complete",
          round: room.currentRound - 1,
          nextRound,
        };
        if (room.player1) sendMessage(room.player1, roundMsg);
        if (room.player2) sendMessage(room.player2, roundMsg);

        const stateMsg: WsServerMessage = {
          type: "game_state",
          gameId: conn.gameId,
          currentRound: nextRound,
          currentPlayer: "player1",
          totalRounds: room.totalRounds,
          status: "active",
        };
        if (room.player1) sendMessage(room.player1, stateMsg);
        if (room.player2) sendMessage(room.player2, stateMsg);
      }
    } else {
      room.currentPlayer = "player2";

      await storage.updateGame(conn.gameId, {
        currentPlayer: "player2",
      });

      const stateMsg: WsServerMessage = {
        type: "game_state",
        gameId: conn.gameId,
        currentRound: room.currentRound,
        currentPlayer: "player2",
        totalRounds: room.totalRounds,
        status: "active",
      };
      if (room.player1) sendMessage(room.player1, stateMsg);
      if (room.player2) sendMessage(room.player2, stateMsg);
    }
  } catch (err) {
    console.error("Failed to submit turn:", err);
    sendMessage(conn, { type: "error", message: "Failed to submit turn", code: "SUBMIT_FAILED" });
  }
}

function handleMessage(conn: PlayerConnection, data: Buffer | ArrayBuffer | Buffer[]): void {
  if (isRateLimited(conn)) {
    sendMessage(conn, { type: "error", message: "Rate limited, slow down", code: "RATE_LIMITED" });
    return;
  }

  let raw: string;
  try {
    raw = data.toString();
  } catch {
    sendMessage(conn, { type: "error", message: "Invalid message encoding", code: "INVALID_ENCODING" });
    return;
  }

  if (raw.length > MAX_MESSAGE_SIZE) {
    sendMessage(conn, { type: "error", message: "Message too large", code: "MESSAGE_TOO_LARGE" });
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    sendMessage(conn, { type: "error", message: "Invalid JSON", code: "INVALID_JSON" });
    return;
  }

  const result = wsClientMessageSchema.safeParse(parsed);
  if (!result.success) {
    sendMessage(conn, {
      type: "error",
      message: "Invalid message format",
      code: "VALIDATION_FAILED",
    });
    return;
  }

  const msg: WsClientMessage = result.data;

  switch (msg.type) {
    case "ping":
      sendMessage(conn, { type: "pong" });
      break;

    case "join_queue":
      if (conn.gameId) {
        sendMessage(conn, { type: "error", message: "Already in a game", code: "ALREADY_IN_GAME" });
        return;
      }
      if (matchmakingQueue.includes(conn.id)) {
        sendMessage(conn, { type: "error", message: "Already in queue", code: "ALREADY_IN_QUEUE" });
        return;
      }
      conn.joinedAt = Date.now();
      matchmakingQueue.push(conn.id);
      sendMessage(conn, { type: "queue_joined", position: matchmakingQueue.length });
      console.log(`${conn.playerName} joined queue (position ${matchmakingQueue.length})`);
      attemptMatchmaking();
      break;

    case "leave_queue":
      removeFromQueue(conn.id);
      sendMessage(conn, { type: "queue_left" });
      break;

    case "draw_stroke": {
      if (!conn.gameId || !conn.playerRole) {
        sendMessage(conn, { type: "error", message: "Not in a game", code: "NOT_IN_GAME" });
        break;
      }
      const room = gameRooms.get(conn.gameId);
      if (!room || room.currentPlayer !== conn.playerRole) {
        break;
      }
      const pathRegex = /^[MLml\d\s,.\-]+$/;
      if (!pathRegex.test(msg.stroke.path)) {
        sendMessage(conn, { type: "error", message: "Invalid stroke path", code: "INVALID_STROKE" });
        break;
      }
      const colorRegex = /^#[0-9A-Fa-f]{3,8}$|^[a-zA-Z]+$/;
      if (!colorRegex.test(msg.stroke.color)) {
        sendMessage(conn, { type: "error", message: "Invalid stroke color", code: "INVALID_STROKE" });
        break;
      }
      const otherRole = conn.playerRole === "player1" ? "player2" : "player1";
      const otherConn = room[otherRole];
      if (otherConn) {
        sendMessage(otherConn, { type: "opponent_stroke", stroke: msg.stroke });
      }
      break;
    }

    case "draw_undo": {
      if (!conn.gameId || !conn.playerRole) {
        sendMessage(conn, { type: "error", message: "Not in a game", code: "NOT_IN_GAME" });
        break;
      }
      const undoRoom = gameRooms.get(conn.gameId);
      if (!undoRoom || undoRoom.currentPlayer !== conn.playerRole) {
        break;
      }
      const undoOpponentRole = conn.playerRole === "player1" ? "player2" : "player1";
      const undoOpponentConn = undoRoom[undoOpponentRole];
      if (undoOpponentConn) {
        sendMessage(undoOpponentConn, { type: "opponent_undo" });
      }
      break;
    }

    case "draw_clear": {
      if (!conn.gameId || !conn.playerRole) {
        sendMessage(conn, { type: "error", message: "Not in a game", code: "NOT_IN_GAME" });
        return;
      }
      const drawClearRoom = gameRooms.get(conn.gameId);
      if (!drawClearRoom) {
        sendMessage(conn, { type: "error", message: "Game room not found", code: "ROOM_NOT_FOUND" });
        return;
      }
      if (drawClearRoom.currentPlayer !== conn.playerRole) {
        sendMessage(conn, { type: "error", message: "Not your turn", code: "NOT_YOUR_TURN" });
        return;
      }
      const clearOpponentRole = conn.playerRole === "player1" ? "player2" : "player1";
      const clearOpponentConn = drawClearRoom[clearOpponentRole];
      if (clearOpponentConn) {
        sendMessage(clearOpponentConn, { type: "opponent_clear" });
      }
      break;
    }

    case "submit_turn":
      handleSubmitTurn(conn, msg.strokes);
      break;
  }
}

export function setupWebSocket(server: Server): void {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: MAX_MESSAGE_SIZE,
    verifyClient: (info: { origin: string; req: IncomingMessage }, callback: (result: boolean, code?: number, message?: string) => void) => {
      if (!validateOrigin(info.origin)) {
        console.warn(`WebSocket connection rejected: invalid origin ${info.origin}`);
        callback(false, 403, "Forbidden");
        return;
      }
      callback(true);
    },
  });

  heartbeatTimer = setInterval(() => {
    for (const [connId, conn] of connections) {
      if (!conn.isAlive) {
        console.log(`Heartbeat timeout: ${conn.playerName}`);
        conn.ws.terminate();
        cleanupConnection(connId);
        continue;
      }
      conn.isAlive = false;
      try {
        conn.ws.ping();
      } catch {
        conn.ws.terminate();
        cleanupConnection(connId);
      }
    }
  }, HEARTBEAT_INTERVAL);

  matchmakingTimer = setInterval(() => {
    const now = Date.now();
    for (let i = matchmakingQueue.length - 1; i >= 0; i--) {
      const connId = matchmakingQueue[i];
      const conn = connections.get(connId);
      if (!conn || conn.ws.readyState !== WebSocket.OPEN) {
        matchmakingQueue.splice(i, 1);
        continue;
      }
      if (now - conn.joinedAt > MATCHMAKING_TIMEOUT) {
        matchmakingQueue.splice(i, 1);
        sendMessage(conn, { type: "error", message: "Matchmaking timed out", code: "MATCHMAKING_TIMEOUT" });
      }
    }
  }, 10_000);

  roomCleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [gameId, room] of gameRooms) {
      if (
        room.completedAt &&
        (room.status === "completed" || room.status === "abandoned") &&
        now - room.completedAt > ROOM_CLEANUP_DELAY
      ) {
        if (room.player1) {
          room.player1.gameId = null;
          room.player1.playerRole = null;
        }
        if (room.player2) {
          room.player2.gameId = null;
          room.player2.playerRole = null;
        }
        gameRooms.delete(gameId);
      }
    }
  }, ROOM_CLEANUP_INTERVAL);

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const connId = generateId();
    const conn: PlayerConnection = {
      ws,
      id: connId,
      playerName: generatePlayerName(),
      gameId: null,
      playerRole: null,
      isAlive: true,
      messageCount: 0,
      rateLimitReset: Date.now() + RATE_LIMIT_WINDOW,
      joinedAt: Date.now(),
    };

    connections.set(connId, conn);
    console.log(`WebSocket connected: ${conn.playerName} (${connId})`);

    ws.on("pong", () => {
      conn.isAlive = true;
    });

    ws.on("message", (data: Buffer | ArrayBuffer | Buffer[]) => {
      handleMessage(conn, data);
    });

    ws.on("close", () => {
      console.log(`WebSocket disconnected: ${conn.playerName} (${connId})`);
      cleanupConnection(connId);
    });

    ws.on("error", (err: Error) => {
      console.error(`WebSocket error for ${conn.playerName}:`, err.message);
      cleanupConnection(connId);
    });
  });

  wss.on("error", (err: Error) => {
    console.error("WebSocket server error:", err);
  });

  wss.on("close", () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (matchmakingTimer) clearInterval(matchmakingTimer);
    if (roomCleanupTimer) clearInterval(roomCleanupTimer);
  });

  console.log("WebSocket server ready on /ws");
}
