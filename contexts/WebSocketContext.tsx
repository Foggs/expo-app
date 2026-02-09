import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { Platform } from "react-native";
import { z } from "zod";

export type ConnectionStatus = "disconnected" | "connecting" | "connected";
export type MatchStatus =
  | "idle"
  | "searching"
  | "matched"
  | "playing"
  | "opponent_disconnected"
  | "completed";

export interface MatchInfo {
  gameId: string;
  playerRole: "player1" | "player2";
  opponentName: string;
}

export interface GameStateFromServer {
  gameId: string;
  currentRound: number;
  currentPlayer: "player1" | "player2";
  totalRounds: number;
  status: string;
}

export interface StrokeData {
  id: string;
  path: string;
  color: string;
  strokeWidth: number;
}

export interface WebSocketCallbacks {
  onMatchFound?: (info: MatchInfo) => void;
  onGameState?: (state: GameStateFromServer) => void;
  onTurnSubmitted?: (data: {
    playerRole: "player1" | "player2";
    round: number;
    strokes: unknown[];
  }) => void;
  onRoundComplete?: (data: { round: number; nextRound: number }) => void;
  onGameComplete?: (gameId: string) => void;
  onOpponentStroke?: (stroke: StrokeData) => void;
  onOpponentClear?: () => void;
  onOpponentDisconnected?: () => void;
  onError?: (message: string, code?: string) => void;
}

const wsServerMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("pong") }),
  z.object({ type: z.literal("queue_joined"), position: z.number() }),
  z.object({ type: z.literal("queue_left") }),
  z.object({
    type: z.literal("match_found"),
    gameId: z.string(),
    playerRole: z.enum(["player1", "player2"]),
    opponentName: z.string(),
  }),
  z.object({
    type: z.literal("game_state"),
    gameId: z.string(),
    currentRound: z.number(),
    currentPlayer: z.enum(["player1", "player2"]),
    totalRounds: z.number(),
    status: z.string(),
  }),
  z.object({
    type: z.literal("turn_submitted"),
    playerRole: z.enum(["player1", "player2"]),
    round: z.number(),
    strokes: z.array(z.unknown()),
  }),
  z.object({
    type: z.literal("round_complete"),
    round: z.number(),
    nextRound: z.number(),
  }),
  z.object({ type: z.literal("game_complete"), gameId: z.string() }),
  z.object({
    type: z.literal("opponent_stroke"),
    stroke: z.object({
      id: z.string(),
      path: z.string(),
      color: z.string(),
      strokeWidth: z.number(),
    }),
  }),
  z.object({ type: z.literal("opponent_clear") }),
  z.object({ type: z.literal("opponent_disconnected") }),
  z.object({
    type: z.literal("error"),
    message: z.string(),
    code: z.string().optional(),
  }),
]);

interface WebSocketContextValue {
  connectionStatus: ConnectionStatus;
  matchStatus: MatchStatus;
  matchInfo: MatchInfo | null;
  gameState: GameStateFromServer | null;
  queuePosition: number;
  connect: () => void;
  disconnect: () => void;
  resetState: () => void;
  joinQueue: () => void;
  leaveQueue: () => void;
  submitTurn: (
    strokes: Array<{
      points: Array<{ x: number; y: number }>;
      color: string;
      width: number;
    }>
  ) => void;
  sendStroke: (stroke: StrokeData) => void;
  sendClear: () => void;
  setCallbacks: (callbacks: WebSocketCallbacks) => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000];
const PING_INTERVAL = 25_000;

function getWsUrl(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;
    const port = "5000";
    return `${protocol}//${host}:${port}/ws`;
  }

  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) throw new Error("EXPO_PUBLIC_DOMAIN not set");

  const [host, port] = domain.split(":");
  if (port) {
    return `wss://${host}:${port}/ws`;
  }
  return `wss://${host}/ws`;
}

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const [matchStatus, setMatchStatus] = useState<MatchStatus>("idle");
  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
  const [gameState, setGameState] = useState<GameStateFromServer | null>(null);
  const [queuePosition, setQueuePosition] = useState<number>(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const intentionalCloseRef = useRef(false);
  const shouldReconnectRef = useRef(false);
  const mountedRef = useRef(true);
  const callbacksRef = useRef<WebSocketCallbacks>({});
  const matchStatusRef = useRef<MatchStatus>("idle");

  matchStatusRef.current = matchStatus;

  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
  }, []);

  const sendRaw = useCallback((msg: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const handleMessage = useCallback((data: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }

    const result = wsServerMessageSchema.safeParse(parsed);
    if (!result.success) {
      return;
    }

    const msg = result.data;
    const cb = callbacksRef.current;

    switch (msg.type) {
      case "pong":
        break;

      case "queue_joined":
        setMatchStatus("searching");
        setQueuePosition(msg.position);
        break;

      case "queue_left":
        setMatchStatus("idle");
        setQueuePosition(0);
        break;

      case "match_found": {
        setMatchStatus("matched");
        const info: MatchInfo = {
          gameId: msg.gameId,
          playerRole: msg.playerRole,
          opponentName: msg.opponentName,
        };
        setMatchInfo(info);
        cb.onMatchFound?.(info);
        break;
      }

      case "game_state": {
        setMatchStatus("playing");
        const state: GameStateFromServer = {
          gameId: msg.gameId,
          currentRound: msg.currentRound,
          currentPlayer: msg.currentPlayer,
          totalRounds: msg.totalRounds,
          status: msg.status,
        };
        setGameState(state);
        cb.onGameState?.(state);
        break;
      }

      case "turn_submitted":
        cb.onTurnSubmitted?.({
          playerRole: msg.playerRole,
          round: msg.round,
          strokes: msg.strokes,
        });
        break;

      case "round_complete":
        cb.onRoundComplete?.({
          round: msg.round,
          nextRound: msg.nextRound,
        });
        break;

      case "game_complete":
        setMatchStatus("completed");
        cb.onGameComplete?.(msg.gameId);
        break;

      case "opponent_stroke":
        cb.onOpponentStroke?.(msg.stroke);
        break;

      case "opponent_clear":
        cb.onOpponentClear?.();
        break;

      case "opponent_disconnected":
        setMatchStatus("opponent_disconnected");
        cb.onOpponentDisconnected?.();
        break;

      case "error":
        if (msg.code === "MATCHMAKING_TIMEOUT") {
          setMatchStatus("idle");
          setQueuePosition(0);
        }
        cb.onError?.(msg.message, msg.code);
        break;
    }
  }, []);

  const connect = useCallback(() => {
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    clearTimers();
    intentionalCloseRef.current = false;
    shouldReconnectRef.current = true;
    setConnectionStatus("connecting");

    try {
      const url = getWsUrl();
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setConnectionStatus("connected");
        reconnectAttemptRef.current = 0;

        pingTimerRef.current = setInterval(() => {
          sendRaw({ type: "ping" });
        }, PING_INTERVAL);
      };

      ws.onmessage = (event: MessageEvent) => {
        if (typeof event.data === "string") {
          handleMessage(event.data);
        }
      };

      ws.onclose = () => {
        clearTimers();
        wsRef.current = null;

        if (!mountedRef.current) return;

        setConnectionStatus("disconnected");

        if (
          !intentionalCloseRef.current &&
          shouldReconnectRef.current &&
          matchStatusRef.current !== "completed"
        ) {
          const delay =
            RECONNECT_DELAYS[
              Math.min(
                reconnectAttemptRef.current,
                RECONNECT_DELAYS.length - 1
              )
            ];
          reconnectAttemptRef.current++;
          reconnectTimerRef.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = () => {};
    } catch {
      setConnectionStatus("disconnected");
    }
  }, [clearTimers, sendRaw, handleMessage]);

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    shouldReconnectRef.current = false;
    clearTimers();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionStatus("disconnected");
    setMatchStatus("idle");
    setMatchInfo(null);
    setGameState(null);
    setQueuePosition(0);
  }, [clearTimers]);

  const resetState = useCallback(() => {
    setMatchStatus("idle");
    setMatchInfo(null);
    setGameState(null);
    setQueuePosition(0);
  }, []);

  const joinQueue = useCallback(() => {
    if (
      matchStatusRef.current !== "idle" ||
      wsRef.current?.readyState !== WebSocket.OPEN
    ) {
      return;
    }
    sendRaw({ type: "join_queue" });
  }, [sendRaw]);

  const leaveQueue = useCallback(() => {
    sendRaw({ type: "leave_queue" });
  }, [sendRaw]);

  const submitTurn = useCallback(
    (
      strokes: Array<{
        points: Array<{ x: number; y: number }>;
        color: string;
        width: number;
      }>
    ) => {
      if (matchStatusRef.current !== "playing") return;
      sendRaw({ type: "submit_turn", strokes });
    },
    [sendRaw]
  );

  const sendStroke = useCallback(
    (stroke: StrokeData) => {
      if (matchStatusRef.current !== "playing") return;
      sendRaw({ type: "draw_stroke", stroke });
    },
    [sendRaw]
  );

  const sendClear = useCallback(() => {
    if (matchStatusRef.current !== "playing") return;
    sendRaw({ type: "draw_clear" });
  }, [sendRaw]);

  const setCallbacks = useCallback((callbacks: WebSocketCallbacks) => {
    callbacksRef.current = callbacks;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      intentionalCloseRef.current = true;
      shouldReconnectRef.current = false;
      clearTimers();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [clearTimers]);

  const value = useMemo(
    () => ({
      connectionStatus,
      matchStatus,
      matchInfo,
      gameState,
      queuePosition,
      connect,
      disconnect,
      resetState,
      joinQueue,
      leaveQueue,
      submitTurn,
      sendStroke,
      sendClear,
      setCallbacks,
    }),
    [
      connectionStatus,
      matchStatus,
      matchInfo,
      gameState,
      queuePosition,
      connect,
      disconnect,
      resetState,
      joinQueue,
      leaveQueue,
      submitTurn,
      sendStroke,
      sendClear,
      setCallbacks,
    ]
  );

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useGameWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useGameWebSocket must be used within a WebSocketProvider");
  }
  return context;
}
