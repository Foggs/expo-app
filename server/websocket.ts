import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { IncomingMessage } from "http";
import { wsClientMessageSchema, type WsServerMessage, type WsClientMessage } from "@shared/schema";
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  isValidRoomCode,
} from "@shared/friendRoom";
import { storage, type PlayerIdentity } from "./storage";
import { randomInt } from "crypto";
import { getSessionKey } from "./sessionIdentity";

const MAX_MESSAGE_SIZE = 512 * 1024; // 512KB
const HEARTBEAT_INTERVAL = 30_000;
const HEARTBEAT_TIMEOUT = 10_000;
const MAX_CONTROL_MESSAGES_PER_MINUTE = 300;
const MAX_DRAW_MESSAGES_PER_MINUTE = 1_200;
const MATCHMAKING_TIMEOUT = 120_000; // 2 minutes
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_DIAGNOSTIC_INTERVAL = 10_000;
const ROOM_CLEANUP_INTERVAL = 60_000;
const ROOM_CLEANUP_DELAY = 120_000; // 2 minutes after completion
const FRIEND_ROOM_TTL = 10 * 60_000; // 10 minutes
const MAX_ROOM_CODE_ATTEMPTS = 25;
const MAX_CONNECTIONS = 500;
const MAX_ROOM_JOINS_PER_MINUTE = 10;
const MAX_PENDING_AUTH_MESSAGES = 20;

interface PlayerConnection {
  ws: WebSocket;
  id: string;
  playerName: string;
  /** Canonical player key: the Game Center account key once linked, otherwise the device key. */
  sessionKey: string;
  /** Every key whose history (games, blocks) belongs to this player. */
  playerKeys: string[];
  authState: "none" | "pending" | "done";
  /** One-way key of the device token this connection authenticated with. */
  deviceKey: string;
  /** Set when a link changed this player's identity while authentication was resolving. */
  identityStale: boolean;
  /** Messages received while authentication is resolving, replayed in order. */
  pendingMessages: WsClientMessage[];
  gameId: string | null;
  playerRole: "player1" | "player2" | null;
  friendRoomCode: string | null;
  isAlive: boolean;
  messageCount: number;
  drawMessageCount: number;
  droppedControlMessages: number;
  droppedDrawMessages: number;
  lastRateLimitLogAt: number;
  rateLimitReset: number;
  joinedAt: number;
  roomJoinAttempts: number;
  roomJoinReset: number;
}

interface GameRoom {
  gameId: string;
  player1: PlayerConnection | null;
  player2: PlayerConnection | null;
  matchType: "queue" | "friend";
  currentRound: number;
  currentPlayer: "player1" | "player2";
  totalRounds: number;
  status: string;
  completedAt: number | null;
}

interface FriendRoom {
  roomCode: string;
  hostId: string;
  guestId: string | null;
  createdAt: number;
  expiresAt: number;
}

const connections = new Map<string, PlayerConnection>();
const matchmakingQueue: string[] = [];
const gameRooms = new Map<string, GameRoom>();
const friendRooms = new Map<string, FriendRoom>();
const gameLocks = new Map<string, Promise<void>>();
const roomLocks = new Map<string, Promise<void>>();

function withLock(locks: Map<string, Promise<void>>, key: string, fn: () => Promise<void>): void {
  const prev = locks.get(key) ?? Promise.resolve();
  const next = prev.then(fn).catch((err) => {
    console.error(`[Lock] Error for key ${key}:`, err instanceof Error ? err.message : err);
  });
  locks.set(key, next);
  next.finally(() => {
    if (locks.get(key) === next) locks.delete(key);
  });
}
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

function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

function generateUniqueRoomCode(): string | null {
  for (let i = 0; i < MAX_ROOM_CODE_ATTEMPTS; i++) {
    const code = generateRoomCode();
    if (!friendRooms.has(code)) {
      return code;
    }
  }
  return null;
}

function sendMessage(conn: PlayerConnection, message: WsServerMessage): void {
  if (conn.ws.readyState === WebSocket.OPEN) {
    try {
      conn.ws.send(JSON.stringify(message));
    } catch (err) {
      console.warn(
        `[WS] Failed to send "${message.type}" to ${conn.playerName ?? conn.id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }
}

type RateLimitBucket = "control" | "draw";

function maybeLogRateLimitDiagnostics(
  conn: PlayerConnection,
  now: number,
  force = false,
): void {
  if (process.env.NODE_ENV === "production") return;
  if (!force && now - conn.lastRateLimitLogAt < RATE_LIMIT_DIAGNOSTIC_INTERVAL) {
    return;
  }
  if (conn.droppedControlMessages === 0 && conn.droppedDrawMessages === 0) {
    return;
  }

  console.warn(
    `[ws-rate-limit] ${conn.playerName} throttled messages: draw=${conn.droppedDrawMessages}, control=${conn.droppedControlMessages}`,
  );
  conn.droppedControlMessages = 0;
  conn.droppedDrawMessages = 0;
  conn.lastRateLimitLogAt = now;
}

function resetRateLimitWindowIfNeeded(conn: PlayerConnection, now: number): void {
  if (now <= conn.rateLimitReset) return;
  maybeLogRateLimitDiagnostics(conn, now, true);
  conn.messageCount = 0;
  conn.drawMessageCount = 0;
  conn.rateLimitReset = now + RATE_LIMIT_WINDOW;
}

function isRateLimited(conn: PlayerConnection, bucket: RateLimitBucket): boolean {
  const now = Date.now();
  resetRateLimitWindowIfNeeded(conn, now);

  if (bucket === "draw") {
    conn.drawMessageCount++;
    if (conn.drawMessageCount > MAX_DRAW_MESSAGES_PER_MINUTE) {
      conn.droppedDrawMessages++;
      maybeLogRateLimitDiagnostics(conn, now);
      return true;
    }
    return false;
  }

  conn.messageCount++;
  if (conn.messageCount > MAX_CONTROL_MESSAGES_PER_MINUTE) {
    conn.droppedControlMessages++;
    maybeLogRateLimitDiagnostics(conn, now);
    return true;
  }

  return false;
}

function isPrivateOrLocalHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  );
}

function parseConfiguredHostname(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    if (/^https?:\/\//i.test(trimmed)) {
      return new URL(trimmed).hostname;
    }
    return new URL(`https://${trimmed}`).hostname;
  } catch {
    return null;
  }
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

  if (
    process.env.NODE_ENV !== "production" &&
    isPrivateOrLocalHostname(hostname)
  ) {
    return true;
  }

  if (
    process.env.NODE_ENV !== "production" &&
    (hostname.endsWith(".ngrok-free.dev") || hostname.endsWith(".ngrok.io"))
  ) {
    return true;
  }

  const publicDomain = process.env.EXPO_PUBLIC_DOMAIN;
  if (publicDomain) {
    const configuredHost = parseConfiguredHostname(publicDomain);
    if (configuredHost && (hostname === configuredHost || hostname.endsWith("." + configuredHost))) {
      return true;
    }
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

function getOpenConnection(connId: string | null | undefined): PlayerConnection | null {
  if (!connId) return null;
  const conn = connections.get(connId);
  if (!conn || conn.ws.readyState !== WebSocket.OPEN) {
    return null;
  }
  return conn;
}

function clearFriendRoomCode(conn: PlayerConnection, roomCode: string): void {
  if (conn.friendRoomCode === roomCode) {
    conn.friendRoomCode = null;
  }
}

function removeFriendRoom(roomCode: string): void {
  const room = friendRooms.get(roomCode);
  if (!room) return;

  const hostConn = connections.get(room.hostId);
  if (hostConn) {
    clearFriendRoomCode(hostConn, roomCode);
  }

  if (room.guestId) {
    const guestConn = connections.get(room.guestId);
    if (guestConn) {
      clearFriendRoomCode(guestConn, roomCode);
    }
  }

  friendRooms.delete(roomCode);
}

function leaveFriendRoom(conn: PlayerConnection, notifyOtherPlayer = true): void {
  const roomCode = conn.friendRoomCode;
  if (!roomCode) return;

  conn.friendRoomCode = null;

  const room = friendRooms.get(roomCode);
  if (!room) return;

  if (room.hostId === conn.id) {
    if (room.guestId) {
      const guestConn = connections.get(room.guestId);
      if (guestConn) {
        clearFriendRoomCode(guestConn, roomCode);
        if (notifyOtherPlayer && guestConn.ws.readyState === WebSocket.OPEN) {
          sendMessage(guestConn, {
            type: "room_error",
            message: "Host left the room.",
            code: "STATE_BLOCKED",
          });
        }
      }
    }
    friendRooms.delete(roomCode);
    return;
  }

  if (room.guestId === conn.id) {
    room.guestId = null;
    room.expiresAt = Date.now() + FRIEND_ROOM_TTL;

    const hostConn = getOpenConnection(room.hostId);
    if (notifyOtherPlayer && hostConn) {
      sendMessage(hostConn, {
        type: "room_error",
        message: "Friend left the room.",
        code: "STATE_BLOCKED",
      });
    }
    return;
  }
}

function abandonGame(conn: PlayerConnection, notifyOtherPlayer = true): void {
  if (!conn.gameId || !conn.playerRole) return;

  const gameId = conn.gameId;
  const playerRole = conn.playerRole;

  conn.gameId = null;
  conn.playerRole = null;

  const room = gameRooms.get(gameId);
  if (!room) return;

  const otherRole = playerRole === "player1" ? "player2" : "player1";
  const otherConn = room[otherRole];
  const shouldNotifyOpponent =
    notifyOtherPlayer && room.status !== "completed";

  room[playerRole] = null;

  if (shouldNotifyOpponent && otherConn) {
    sendMessage(otherConn, { type: "opponent_disconnected" });
  }

  if (otherConn) {
    otherConn.gameId = null;
    otherConn.playerRole = null;
    room[otherRole] = null;
  }

  if (room.status !== "completed" && room.status !== "abandoned") {
    room.status = "abandoned";
    room.completedAt = Date.now();
    storage.updateGame(gameId, { status: "abandoned" }).catch((err) => {
      console.error(`Failed to mark game ${gameId} as abandoned:`, err);
    });
  }

  gameRooms.delete(gameId);
}

function cleanupConnection(connId: string): void {
  const conn = connections.get(connId);
  if (!conn) return;

  removeFromQueue(connId);
  leaveFriendRoom(conn, true);
  abandonGame(conn, true);

  connections.delete(connId);
}

async function startGameForPlayers(
  player1: PlayerConnection,
  player2: PlayerConnection,
  matchType: "queue" | "friend",
): Promise<string> {
  removeFromQueue(player1.id);
  removeFromQueue(player2.id);

  let gameId: string | null = null;

  try {
    const game = await storage.createGame(undefined, player1.sessionKey, player2.sessionKey);
    gameId = game.id;

    const room: GameRoom = {
      gameId,
      player1,
      player2,
      matchType,
      currentRound: 1,
      currentPlayer: "player1",
      totalRounds: 3,
      status: "active",
      completedAt: null,
    };

    gameRooms.set(gameId, room);

    player1.gameId = gameId;
    player1.playerRole = "player1";
    player2.gameId = gameId;
    player2.playerRole = "player2";

    await storage.updateGame(gameId, { status: "active" });
  } catch (err) {
    // Roll back in-memory state so players are not left in a ghost game.
    if (gameId) {
      gameRooms.delete(gameId);
    }
    player1.gameId = null;
    player1.playerRole = null;
    player2.gameId = null;
    player2.playerRole = null;
    throw err;
  }

  sendMessage(player1, {
    type: "match_found",
    gameId,
    playerRole: "player1",
    opponentName: player2.playerName,
    opponentPlayerId: player2.sessionKey,
    matchType,
  });

  sendMessage(player2, {
    type: "match_found",
    gameId,
    playerRole: "player2",
    opponentName: player1.playerName,
    opponentPlayerId: player1.sessionKey,
    matchType,
  });

  const initialState: WsServerMessage = {
    type: "game_state",
    gameId,
    currentRound: 1,
    currentPlayer: "player1",
    totalRounds: 3,
    status: "active",
  };

  sendMessage(player1, initialState);
  sendMessage(player2, initialState);

  return gameId;
}

let isMatchmaking = false;
let matchmakingPending = false;

async function attemptMatchmaking(): Promise<void> {
  if (isMatchmaking) {
    matchmakingPending = true;
    return;
  }
  isMatchmaking = true;
  try {
    do {
      matchmakingPending = false;
      while (matchmakingQueue.length >= 2) {
        let selectedPair: [number, number, PlayerConnection, PlayerConnection] | null = null;
        const staleIds = matchmakingQueue.filter((id) => !getOpenConnection(id));
        for (const staleId of staleIds) removeFromQueue(staleId);
        const available = matchmakingQueue
          .map((id, index) => ({ id, index, conn: getOpenConnection(id) }))
          .filter((entry): entry is { id: string; index: number; conn: PlayerConnection } => Boolean(entry.conn));

        for (let i = 0; i < available.length && !selectedPair; i++) {
          for (let j = i + 1; j < available.length; j++) {
            const first = available[i].conn;
            const second = available[j].conn;
            if (first.sessionKey === second.sessionKey) continue;
            if (await storage.arePlayersBlocked(first.playerKeys, second.playerKeys)) continue;
            selectedPair = [available[i].index, available[j].index, first, second];
            break;
          }
        }

        if (!selectedPair) break;
        const [firstIndex, secondIndex, p1, p2] = selectedPair;
        matchmakingQueue.splice(secondIndex, 1);
        matchmakingQueue.splice(firstIndex, 1);

        try {
          const gameId = await startGameForPlayers(p1, p2, "queue");
          console.log(`Match created: ${p1.playerName} vs ${p2.playerName} (game ${gameId})`);
        } catch (err) {
          console.error("Failed to create match:", err);
          matchmakingQueue.unshift(p2.id);
          matchmakingQueue.unshift(p1.id);
          break;
        }
      }
    } while (matchmakingPending);
  } finally {
    isMatchmaking = false;
    matchmakingPending = false;
  }
}

function handleCreateRoom(conn: PlayerConnection): void {
  if (conn.gameId) {
    sendMessage(conn, {
      type: "room_error",
      message: "Already in a game.",
      code: "ALREADY_IN_GAME",
    });
    return;
  }

  removeFromQueue(conn.id);
  leaveFriendRoom(conn, true);

  const roomCode = generateUniqueRoomCode();
  if (!roomCode) {
    sendMessage(conn, {
      type: "room_error",
      message: "Could not create room. Please try again.",
      code: "STATE_BLOCKED",
    });
    return;
  }

  const now = Date.now();
  const room: FriendRoom = {
    roomCode,
    hostId: conn.id,
    guestId: null,
    createdAt: now,
    expiresAt: now + FRIEND_ROOM_TTL,
  };

  friendRooms.set(roomCode, room);
  conn.friendRoomCode = roomCode;

  sendMessage(conn, { type: "room_created", roomCode });
}

async function handleJoinRoom(conn: PlayerConnection, roomCode: string): Promise<void> {
  if (conn.gameId) {
    sendMessage(conn, {
      type: "room_error",
      message: "Already in a game.",
      code: "ALREADY_IN_GAME",
    });
    return;
  }

  const now = Date.now();
  if (now > conn.roomJoinReset) {
    conn.roomJoinAttempts = 0;
    conn.roomJoinReset = now + RATE_LIMIT_WINDOW;
  }
  conn.roomJoinAttempts++;
  if (conn.roomJoinAttempts > MAX_ROOM_JOINS_PER_MINUTE) {
    sendMessage(conn, {
      type: "room_error",
      message: "Too many join attempts. Please wait a moment.",
      code: "RATE_LIMITED",
    });
    return;
  }

  if (!isValidRoomCode(roomCode)) {
    sendMessage(conn, {
      type: "room_error",
      message: "Invalid room code.",
      code: "STATE_BLOCKED",
    });
    return;
  }

  removeFromQueue(conn.id);
  leaveFriendRoom(conn, true);

  const room = friendRooms.get(roomCode);
  if (!room) {
    sendMessage(conn, {
      type: "room_error",
      message: "Room not found.",
      code: "ROOM_NOT_FOUND",
    });
    return;
  }

  if (room.hostId === conn.id) {
    sendMessage(conn, {
      type: "room_error",
      message: "You cannot join your own room.",
      code: "STATE_BLOCKED",
    });
    return;
  }

  if (Date.now() > room.expiresAt) {
    removeFriendRoom(roomCode);
    sendMessage(conn, {
      type: "room_error",
      message: "Room has expired.",
      code: "ROOM_EXPIRED",
    });
    return;
  }

  const hostConn = getOpenConnection(room.hostId);
  if (!hostConn) {
    removeFriendRoom(roomCode);
    sendMessage(conn, {
      type: "room_error",
      message: "Host is no longer available.",
      code: "ROOM_NOT_FOUND",
    });
    return;
  }

  if (room.guestId && room.guestId !== conn.id) {
    sendMessage(conn, {
      type: "room_error",
      message: "Room is full.",
      code: "ROOM_FULL",
    });
    return;
  }

  room.guestId = conn.id;
  room.expiresAt = Date.now() + FRIEND_ROOM_TTL;
  conn.friendRoomCode = roomCode;

  sendMessage(conn, { type: "room_joined", roomCode });
  sendMessage(hostConn, { type: "room_joined", roomCode });

  try {
    const gameId = await startGameForPlayers(hostConn, conn, "friend");
    console.log(`Friend match created in room ${roomCode} (game ${gameId})`);
    removeFriendRoom(roomCode);
  } catch (err) {
    room.guestId = null;
    conn.friendRoomCode = null;
    room.expiresAt = Date.now() + FRIEND_ROOM_TTL;
    console.error(`Failed to start friend room ${roomCode}:`, err);
    sendMessage(conn, {
      type: "room_error",
      message: "Failed to start room match.",
      code: "STATE_BLOCKED",
    });
    sendMessage(hostConn, {
      type: "room_error",
      message: "Failed to start room match.",
      code: "STATE_BLOCKED",
    });
  }
}

function handleLeaveRoom(conn: PlayerConnection): void {
  leaveFriendRoom(conn, true);
  abandonGame(conn, true);
}

function handleRequestGameState(conn: PlayerConnection): void {
  if (!conn.gameId || !conn.playerRole) {
    sendMessage(conn, { type: "error", message: "Not in a game", code: "NOT_IN_GAME" });
    return;
  }

  const room = gameRooms.get(conn.gameId);
  if (!room) {
    sendMessage(conn, { type: "error", message: "Game room not found", code: "ROOM_NOT_FOUND" });
    return;
  }

  sendMessage(conn, {
    type: "game_state",
    gameId: room.gameId,
    currentRound: room.currentRound,
    currentPlayer: room.currentPlayer,
    totalRounds: room.totalRounds,
    status: room.status,
  });
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
        const completedGameId = conn.gameId;
        if (!completedGameId) {
          sendMessage(conn, { type: "error", message: "Game room not found", code: "ROOM_NOT_FOUND" });
          return;
        }
        room.status = "completed";
        room.completedAt = Date.now();
        room.currentPlayer = "player1";

        await storage.updateGame(completedGameId, {
          status: "completed",
          completedAt: new Date(),
          currentRound: room.currentRound,
          currentPlayer: "player1",
        });

        const completeMsg: WsServerMessage = { type: "game_complete", gameId: completedGameId };
        if (room.player1) sendMessage(room.player1, completeMsg);
        if (room.player2) sendMessage(room.player2, completeMsg);

        if (room.player1) {
          room.player1.gameId = null;
          room.player1.playerRole = null;
        }
        if (room.player2) {
          room.player2.gameId = null;
          room.player2.playerRole = null;
        }
        gameRooms.delete(completedGameId);

        console.log(`Game ${completedGameId} completed`);
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
  let raw: string;
  try {
    raw = data.toString();
  } catch {
    if (isRateLimited(conn, "control")) return;
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
    if (isRateLimited(conn, "control")) return;
    sendMessage(conn, { type: "error", message: "Invalid JSON", code: "INVALID_JSON" });
    return;
  }

  const result = wsClientMessageSchema.safeParse(parsed);
  if (!result.success) {
    if (isRateLimited(conn, "control")) return;
    sendMessage(conn, {
      type: "error",
      message: "Invalid message format",
      code: "VALIDATION_FAILED",
    });
    return;
  }

  const msg: WsClientMessage = result.data;
  const rateLimitBucket: RateLimitBucket =
    msg.type === "draw_stroke" ? "draw" : "control";
  if (isRateLimited(conn, rateLimitBucket)) {
    if (rateLimitBucket === "control") {
      sendMessage(conn, {
        type: "error",
        message: "Rate limited, slow down",
        code: "RATE_LIMITED",
      });
    }
    return;
  }

  if (msg.type === "authenticate") {
    if (conn.authState !== "none") {
      sendMessage(conn, { type: "error", message: "Session is already authenticated", code: "ALREADY_AUTHENTICATED" });
      return;
    }
    const deviceKey = getSessionKey(msg.sessionToken);
    if (!deviceKey) {
      conn.ws.close(1008, "Valid device session required");
      return;
    }
    conn.authState = "pending";
    conn.deviceKey = deviceKey;
    void authenticateConnection(conn, deviceKey);
    return;
  }

  if (conn.authState === "pending") {
    if (conn.pendingMessages.length >= MAX_PENDING_AUTH_MESSAGES) {
      conn.ws.close(1008, "Too many messages before authentication finished");
      return;
    }
    conn.pendingMessages.push(msg);
    return;
  }

  if (conn.authState !== "done") {
    conn.ws.close(1008, "Authenticate before sending game actions");
    return;
  }

  dispatchMessage(conn, msg);
}

/**
 * Resolves the device key to its player (a linked Game Center account or the
 * device itself), then replays any messages that arrived meanwhile.
 */
async function authenticateConnection(conn: PlayerConnection, deviceKey: string): Promise<void> {
  try {
    let identity = await storage.resolvePlayerIdentity(deviceKey);
    while (conn.identityStale) {
      conn.identityStale = false;
      identity = await storage.resolvePlayerIdentity(deviceKey);
    }
    if (conn.ws.readyState !== WebSocket.OPEN) return;
    conn.sessionKey = identity.playerKey;
    conn.playerKeys = identity.aliasKeys;
    conn.authState = "done";
  } catch (error) {
    console.error("Could not resolve player identity:", error instanceof Error ? error.message : error);
    conn.pendingMessages = [];
    if (conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.close(1011, "Could not verify session");
    }
    return;
  }
  const queued = conn.pendingMessages;
  conn.pendingMessages = [];
  for (const queuedMessage of queued) {
    if (conn.ws.readyState !== WebSocket.OPEN) return;
    dispatchMessage(conn, queuedMessage);
  }
}

function dispatchMessage(conn: PlayerConnection, msg: WsClientMessage): void {
  switch (msg.type) {
    case "ping":
      sendMessage(conn, { type: "pong" });
      break;

    case "join_queue":
      if (conn.gameId) {
        sendMessage(conn, { type: "error", message: "Already in a game", code: "ALREADY_IN_GAME" });
        return;
      }
      if (conn.friendRoomCode) {
        sendMessage(conn, {
          type: "room_error",
          message: "Leave your friend room before queueing.",
          code: "STATE_BLOCKED",
        });
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

    case "create_room":
      handleCreateRoom(conn);
      break;

    case "join_room":
      withLock(roomLocks, msg.roomCode, () => handleJoinRoom(conn, msg.roomCode));
      break;

    case "leave_room":
      handleLeaveRoom(conn);
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
      if (conn.gameId) {
        withLock(gameLocks, conn.gameId, () => handleSubmitTurn(conn, msg.strokes));
      } else {
        handleSubmitTurn(conn, msg.strokes);
      }
      break;
    case "request_game_state":
      handleRequestGameState(conn);
      break;
  }
}

/**
 * Applies a new Game Center link to open connections, so a player who links
 * while connected (or is connected on another of their devices) is matched
 * and block-checked as the account straight away, without reconnecting.
 */
export function applyLinkedIdentity(deviceKey: string, identity: PlayerIdentity): void {
  for (const conn of connections.values()) {
    if (conn.authState === "pending") {
      // Its lookup may have read the links before this one was committed.
      conn.identityStale = true;
      continue;
    }
    if (conn.authState !== "done") continue;
    if (conn.deviceKey !== deviceKey && !identity.aliasKeys.includes(conn.sessionKey)) continue;
    conn.sessionKey = identity.playerKey;
    conn.playerKeys = identity.aliasKeys;
  }
}

export function setupWebSocket(server: Server): WebSocketServer {
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

    for (const [roomCode, room] of friendRooms) {
      const hostConn = connections.get(room.hostId);
      const hostAlive = Boolean(hostConn && hostConn.ws.readyState === WebSocket.OPEN);
      const guestConn = room.guestId ? connections.get(room.guestId) : null;
      const guestAlive = Boolean(guestConn && guestConn.ws.readyState === WebSocket.OPEN);

      if (!hostAlive || now > room.expiresAt) {
        if (hostConn) {
          clearFriendRoomCode(hostConn, roomCode);
        }
        if (guestConn) {
          clearFriendRoomCode(guestConn, roomCode);
          if (guestAlive) {
            sendMessage(guestConn, {
              type: "room_error",
              message: "Room expired or was closed by host.",
              code: "ROOM_EXPIRED",
            });
          }
        }
        friendRooms.delete(roomCode);
        continue;
      }

      if (room.guestId && !guestAlive) {
        if (guestConn) {
          clearFriendRoomCode(guestConn, roomCode);
        }
        room.guestId = null;
        room.expiresAt = now + FRIEND_ROOM_TTL;
        if (hostConn && hostConn.ws.readyState === WebSocket.OPEN) {
          sendMessage(hostConn, {
            type: "room_error",
            message: "Friend disconnected from room.",
            code: "STATE_BLOCKED",
          });
        }
      }
    }
  }, ROOM_CLEANUP_INTERVAL);

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    if (connections.size >= MAX_CONNECTIONS) {
      console.warn(`Connection rejected: max connections (${MAX_CONNECTIONS}) reached`);
      ws.close(1013, "Server at capacity");
      return;
    }

    const now = Date.now();
    const connId = generateId();
    const conn: PlayerConnection = {
      ws,
      id: connId,
      playerName: generatePlayerName(),
      sessionKey: "",
      playerKeys: [],
      authState: "none",
      deviceKey: "",
      identityStale: false,
      pendingMessages: [],
      gameId: null,
      playerRole: null,
      friendRoomCode: null,
      isAlive: true,
      messageCount: 0,
      drawMessageCount: 0,
      droppedControlMessages: 0,
      droppedDrawMessages: 0,
      lastRateLimitLogAt: now,
      rateLimitReset: now + RATE_LIMIT_WINDOW,
      joinedAt: now,
      roomJoinAttempts: 0,
      roomJoinReset: now + RATE_LIMIT_WINDOW,
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
  return wss;
}
