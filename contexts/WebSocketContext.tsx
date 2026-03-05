/*
 * ─── MATCH FLOW TRANSITION MAP (current baseline) ───
 *
 * Now driven by MatchFlowMachine from lib/state/matchFlow.
 * See lib/state/matchFlow/states.ts for the full transition table.
 *
 * Legacy MatchStatus is derived from MatchFlowStateId for backward compatibility.
 * ConnectionStatus is derived from machine state (idle/connecting/connected mapping).
 * ────────────────────────────────────────────────────────────────────────────────
 */

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
import { createMachine } from "@/lib/state";
import type { FlowError, ErrorClass } from "@/lib/state";
import { classifyError, toFlowError } from "@/lib/state";
import {
  matchFlowStates,
  INITIAL_MATCH_FLOW_MODEL,
} from "@/lib/state/matchFlow";
import type {
  MatchFlowStateId,
  MatchFlowEvent,
  MatchFlowEffect,
  MatchFlowModel,
} from "@/lib/state/matchFlow";

export type ConnectionStatus = "disconnected" | "connecting" | "connected";
export type MatchStatus =
  | "idle"
  | "queueing"
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
  status: "active" | "completed" | "abandoned" | "waiting";
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
  onOpponentUndo?: () => void;
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
  z.object({ type: z.literal("opponent_undo") }),
  z.object({ type: z.literal("opponent_disconnected") }),
  z.object({ type: z.literal("room_created"), roomCode: z.string() }),
  z.object({ type: z.literal("room_joined"), roomCode: z.string() }),
  z.object({ type: z.literal("room_error"), message: z.string() }),
  z.object({
    type: z.literal("flow_error"),
    code: z.string(),
    message: z.string(),
    retryable: z.boolean().optional(),
    fatal: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("error"),
    message: z.string(),
    code: z.string().optional(),
  }),
]);

function flowStateToMatchStatus(stateId: MatchFlowStateId): MatchStatus {
  switch (stateId) {
    case "idle":
    case "connecting":
    case "error_fatal":
      return "idle";
    case "queueing":
    case "reconnecting":
    case "error_recoverable":
    case "error_backoff":
      return "queueing";
    case "matched":
      return "matched";
    case "playing":
      return "playing";
    case "completed":
      return "completed";
    case "opponent_disconnected":
      return "opponent_disconnected";
  }
}

function flowStateToConnectionStatus(stateId: MatchFlowStateId): ConnectionStatus {
  switch (stateId) {
    case "idle":
    case "completed":
    case "opponent_disconnected":
    case "error_fatal":
      return "disconnected";
    case "connecting":
    case "reconnecting":
    case "error_recoverable":
    case "error_backoff":
      return "connecting";
    case "queueing":
    case "matched":
    case "playing":
      return "connected";
  }
}

function flowStateToErrorState(stateId: MatchFlowStateId, model: MatchFlowModel): ErrorClass | null {
  if (!model.lastError) return null;
  switch (stateId) {
    case "error_recoverable":
      return "recoverable";
    case "error_backoff":
      return "backoff";
    case "error_fatal":
      return model.lastError.code && ["ORIGIN_VIOLATION", "TOKEN_INVALID", "TOKEN_EXPIRED", "REPLAY_DETECTED", "AUTH_FAILED"].includes(model.lastError.code)
        ? "security"
        : "fatal";
    default:
      return null;
  }
}

interface WebSocketContextValue {
  connectionStatus: ConnectionStatus;
  matchStatus: MatchStatus;
  flowState: MatchFlowStateId;
  matchInfo: MatchInfo | null;
  gameState: GameStateFromServer | null;
  queuePosition: number;
  lastError: FlowError | null;
  errorState: ErrorClass | null;
  canRetry: boolean;
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
  ) => boolean;
  sendStroke: (stroke: StrokeData) => void;
  sendClear: () => void;
  sendUndo: () => void;
  setCallbacks: (callbacks: WebSocketCallbacks) => void;
  dispatchFlow: (event: MatchFlowEvent) => void;
  canAction: (action: "findMatch" | "cancelSearch" | "submitTurn" | "draw") => boolean;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

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
  const [flowSnapshot, setFlowSnapshot] = useState<{
    stateId: MatchFlowStateId;
    model: MatchFlowModel;
  }>({ stateId: "idle", model: INITIAL_MATCH_FLOW_MODEL });

  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
  const [gameState, setGameState] = useState<GameStateFromServer | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const callbacksRef = useRef<WebSocketCallbacks>({});
  const machineRef = useRef<ReturnType<typeof createMachine<MatchFlowModel, MatchFlowEvent, MatchFlowEffect>> | null>(null);

  const clearPingTimer = useCallback(() => {
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const clearBackoffTimer = useCallback(() => {
    if (backoffTimerRef.current) {
      clearTimeout(backoffTimerRef.current);
      backoffTimerRef.current = null;
    }
  }, []);

  const sendRaw = useCallback((msg: Record<string, unknown>): boolean => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }, []);

  const handleWsMessage = useCallback((data: string) => {
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
    const machine = machineRef.current;

    switch (msg.type) {
      case "pong":
        break;

      case "queue_joined":
        machine?.dispatch({ type: "QUEUE_JOINED", position: msg.position });
        break;

      case "queue_left":
        machine?.dispatch({ type: "CANCEL_SEARCH" });
        break;

      case "match_found":
        machine?.dispatch({
          type: "MATCH_FOUND",
          gameId: msg.gameId,
          playerRole: msg.playerRole,
          opponentName: msg.opponentName,
        });
        break;

      case "game_state":
        machine?.dispatch({
          type: "GAME_STATE_RECEIVED",
          gameId: msg.gameId,
          currentRound: msg.currentRound,
          currentPlayer: msg.currentPlayer,
          totalRounds: msg.totalRounds,
          status: msg.status,
        });
        break;

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
        machine?.dispatch({ type: "GAME_COMPLETE_RECEIVED", gameId: msg.gameId });
        break;

      case "opponent_stroke":
        cb.onOpponentStroke?.(msg.stroke);
        break;

      case "opponent_clear":
        cb.onOpponentClear?.();
        break;

      case "opponent_undo":
        cb.onOpponentUndo?.();
        break;

      case "opponent_disconnected":
        machine?.dispatch({ type: "OPPONENT_DISCONNECTED_RECEIVED" });
        break;

      case "flow_error": {
        const flowError = toFlowError(
          { message: msg.message, code: msg.code },
          "server",
          machine?.model.stateVersion ?? 0,
        );
        machine?.dispatch({ type: "ERROR_RAISED", error: flowError });
        break;
      }

      case "error":
        if (msg.code === "MATCHMAKING_TIMEOUT") {
          machine?.dispatch({ type: "MATCHMAKING_TIMEOUT" });
        } else {
          const flowError = toFlowError(
            { message: msg.message, code: msg.code },
            "server",
            machine?.model.stateVersion ?? 0,
          );
          const errorClass = classifyError(msg.code);
          if (errorClass === "fatal" || errorClass === "security" || errorClass === "validation") {
            machine?.dispatch({ type: "ERROR_RAISED", error: flowError });
          }
        }
        cb.onError?.(msg.message, msg.code);
        break;
    }
  }, []);

  const openSocket = useCallback(() => {
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    try {
      const url = getWsUrl();
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        clearPingTimer();
        pingTimerRef.current = setInterval(() => {
          sendRaw({ type: "ping" });
        }, PING_INTERVAL);
        machineRef.current?.dispatch({ type: "WS_OPENED" });
      };

      ws.onmessage = (event: MessageEvent) => {
        if (typeof event.data === "string") {
          handleWsMessage(event.data);
        }
      };

      ws.onclose = (event: CloseEvent) => {
        clearPingTimer();
        wsRef.current = null;
        if (!mountedRef.current) return;
        machineRef.current?.dispatch({ type: "WS_CLOSED", code: event.code });
      };

      ws.onerror = () => {
        if (!mountedRef.current) return;
        callbacksRef.current.onError?.(
          "WebSocket connection error",
          "WS_ERROR",
        );
      };
    } catch {
      machineRef.current?.dispatch({ type: "WS_CLOSED" });
    }
  }, [clearPingTimer, sendRaw, handleWsMessage]);

  const closeSocket = useCallback(() => {
    clearPingTimer();
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, [clearPingTimer]);

  const effectRunner = useCallback(
    (effect: MatchFlowEffect, dispatch: (event: MatchFlowEvent) => void) => {
      switch (effect.type) {
        case "OPEN_SOCKET":
          openSocket();
          break;
        case "SEND_JOIN_QUEUE":
          sendRaw({ type: "join_queue" });
          break;
        case "SEND_LEAVE_QUEUE":
          sendRaw({ type: "leave_queue" });
          break;
        case "CLOSE_SOCKET":
          closeSocket();
          break;
        case "SCHEDULE_RECONNECT":
          clearReconnectTimer();
          reconnectTimerRef.current = setTimeout(() => {
            dispatch({ type: "RETRY_TIMER_EXPIRED" });
          }, effect.delayMs);
          break;
        case "CLEAR_RECONNECT":
          clearReconnectTimer();
          break;
        case "SCHEDULE_BACKOFF_TIMER":
          clearBackoffTimer();
          backoffTimerRef.current = setTimeout(() => {
            dispatch({ type: "RETRY_TIMER_EXPIRED" });
          }, effect.delayMs);
          break;
        case "CLEAR_BACKOFF_TIMER":
          clearBackoffTimer();
          break;
        case "SET_CALLBACK_PAYLOAD": {
          const cb = callbacksRef.current;
          switch (effect.event) {
            case "matchFound": {
              const info = effect.payload as MatchInfo;
              setMatchInfo(info);
              cb.onMatchFound?.(info);
              break;
            }
            case "gameState": {
              const gs = effect.payload as GameStateFromServer;
              setGameState(gs);
              cb.onGameState?.(gs);
              break;
            }
            case "gameComplete":
              cb.onGameComplete?.(effect.payload as string);
              break;
            case "opponentDisconnected":
              cb.onOpponentDisconnected?.();
              break;
            case "error": {
              const err = effect.payload as { message: string; code?: string };
              cb.onError?.(err.message, err.code);
              break;
            }
          }
          break;
        }
        case "CLEAR_SESSION":
          setMatchInfo(null);
          setGameState(null);
          break;
        case "EMIT_ERROR_UI":
          callbacksRef.current.onError?.(effect.error.message, effect.error.code);
          break;
      }
    },
    [openSocket, closeSocket, sendRaw, clearReconnectTimer, clearBackoffTimer],
  );

  useEffect(() => {
    const machine = createMachine<MatchFlowModel, MatchFlowEvent, MatchFlowEffect>(
      "MatchFlow",
      matchFlowStates,
      "idle",
      INITIAL_MATCH_FLOW_MODEL,
      effectRunner,
    );

    machineRef.current = machine;

    const unsubscribe = machine.subscribe((snapshot) => {
      if (!mountedRef.current) return;
      setFlowSnapshot({
        stateId: snapshot.stateId as MatchFlowStateId,
        model: snapshot.model,
      });
    });

    return () => {
      unsubscribe();
      machineRef.current = null;
    };
  }, [effectRunner]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearPingTimer();
      clearReconnectTimer();
      clearBackoffTimer();
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [clearPingTimer, clearReconnectTimer, clearBackoffTimer]);

  const connectionStatus = flowStateToConnectionStatus(flowSnapshot.stateId);
  const matchStatus = flowStateToMatchStatus(flowSnapshot.stateId);
  const lastError = flowSnapshot.model.lastError;
  const errorState = flowStateToErrorState(flowSnapshot.stateId, flowSnapshot.model);
  const canRetry = flowSnapshot.stateId === "error_recoverable" || flowSnapshot.stateId === "error_backoff";

  const dispatchFlow = useCallback((event: MatchFlowEvent) => {
    machineRef.current?.dispatch(event);
  }, []);

  const connect = useCallback(() => {
    machineRef.current?.dispatch({ type: "FIND_MATCH_CLICKED" });
  }, []);

  const disconnect = useCallback(() => {
    machineRef.current?.dispatch({ type: "DISCONNECT_REQUESTED" });
    closeSocket();
    setMatchInfo(null);
    setGameState(null);
  }, [closeSocket]);

  const resetState = useCallback(() => {
    machineRef.current?.dispatch({ type: "DISCONNECT_REQUESTED" });
    setMatchInfo(null);
    setGameState(null);
  }, []);

  const joinQueue = useCallback(() => {
    if (flowSnapshot.stateId === "idle") {
      machineRef.current?.dispatch({ type: "FIND_MATCH_CLICKED" });
    }
  }, [flowSnapshot.stateId]);

  const leaveQueue = useCallback(() => {
    machineRef.current?.dispatch({ type: "CANCEL_SEARCH" });
  }, []);

  const submitTurn = useCallback(
    (
      strokes: Array<{
        points: Array<{ x: number; y: number }>;
        color: string;
        width: number;
      }>
    ): boolean => {
      if (flowSnapshot.stateId !== "playing") return false;
      return sendRaw({ type: "submit_turn", strokes });
    },
    [flowSnapshot.stateId, sendRaw],
  );

  const sendStroke = useCallback(
    (stroke: StrokeData) => {
      if (flowSnapshot.stateId !== "playing") return;
      sendRaw({ type: "draw_stroke", stroke });
    },
    [flowSnapshot.stateId, sendRaw],
  );

  const sendClear = useCallback(() => {
    if (flowSnapshot.stateId !== "playing") return;
    sendRaw({ type: "draw_clear" });
  }, [flowSnapshot.stateId, sendRaw]);

  const sendUndo = useCallback(() => {
    if (flowSnapshot.stateId !== "playing") return;
    sendRaw({ type: "draw_undo" });
  }, [flowSnapshot.stateId, sendRaw]);

  const setCallbacks = useCallback((callbacks: WebSocketCallbacks) => {
    callbacksRef.current = callbacks;
  }, []);

  const canAction = useCallback(
    (action: "findMatch" | "cancelSearch" | "submitTurn" | "draw"): boolean => {
      switch (action) {
        case "findMatch":
          return flowSnapshot.stateId === "idle";
        case "cancelSearch":
          return flowSnapshot.stateId === "queueing" || flowSnapshot.stateId === "matched";
        case "submitTurn":
        case "draw":
          return flowSnapshot.stateId === "playing";
      }
    },
    [flowSnapshot.stateId],
  );

  const value = useMemo(
    () => ({
      connectionStatus,
      matchStatus,
      flowState: flowSnapshot.stateId,
      matchInfo,
      gameState,
      queuePosition: flowSnapshot.model.queuePosition,
      lastError,
      errorState,
      canRetry,
      connect,
      disconnect,
      resetState,
      joinQueue,
      leaveQueue,
      submitTurn,
      sendStroke,
      sendClear,
      sendUndo,
      setCallbacks,
      dispatchFlow,
      canAction,
    }),
    [
      connectionStatus,
      matchStatus,
      flowSnapshot,
      matchInfo,
      gameState,
      lastError,
      errorState,
      canRetry,
      connect,
      disconnect,
      resetState,
      joinQueue,
      leaveQueue,
      submitTurn,
      sendStroke,
      sendClear,
      sendUndo,
      setCallbacks,
      dispatchFlow,
      canAction,
    ],
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
