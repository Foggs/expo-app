import { useState, useEffect, useRef, useCallback } from "react";
import { Platform } from "react-native";
import type { WsServerMessage, WsClientMessage } from "@shared/schema";

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export type MatchStatus = "idle" | "searching" | "matched" | "playing" | "opponent_disconnected" | "completed";

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

interface UseWebSocketOptions {
  onMatchFound?: (info: MatchInfo) => void;
  onGameState?: (state: GameStateFromServer) => void;
  onTurnSubmitted?: (data: { playerRole: "player1" | "player2"; round: number; strokes: unknown[] }) => void;
  onRoundComplete?: (data: { round: number; nextRound: number }) => void;
  onGameComplete?: (gameId: string) => void;
  onOpponentDisconnected?: () => void;
  onOpponentStroke?: (stroke: { id: string; path: string; color: string; strokeWidth: number }) => void;
  onOpponentClear?: () => void;
  onError?: (message: string, code?: string) => void;
}

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000];
const PING_INTERVAL = 25_000;

function getWsUrl(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host =
      window.location.hostname === "localhost"
        ? "127.0.0.1"
        : window.location.hostname;
    const port = process.env.EXPO_PUBLIC_SERVER_PORT || "5050";
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

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [matchStatus, setMatchStatus] = useState<MatchStatus>("idle");
  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
  const [gameState, setGameState] = useState<GameStateFromServer | null>(null);
  const [queuePosition, setQueuePosition] = useState<number>(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const optionsRef = useRef(options);
  const intentionalCloseRef = useRef(false);
  const shouldReconnectRef = useRef(false);

  optionsRef.current = options;

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

  const sendMessage = useCallback((msg: WsClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const handleMessage = useCallback((data: string) => {
    let msg: WsServerMessage;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

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

      case "match_found":
        setMatchStatus("matched");
        const info: MatchInfo = {
          gameId: msg.gameId,
          playerRole: msg.playerRole,
          opponentName: msg.opponentName,
        };
        setMatchInfo(info);
        optionsRef.current.onMatchFound?.(info);
        break;

      case "game_state":
        setMatchStatus("playing");
        const state: GameStateFromServer = {
          gameId: msg.gameId,
          currentRound: msg.currentRound,
          currentPlayer: msg.currentPlayer,
          totalRounds: msg.totalRounds,
          status: msg.status,
        };
        setGameState(state);
        optionsRef.current.onGameState?.(state);
        break;

      case "turn_submitted":
        optionsRef.current.onTurnSubmitted?.({
          playerRole: msg.playerRole,
          round: msg.round,
          strokes: msg.strokes,
        });
        break;

      case "round_complete":
        optionsRef.current.onRoundComplete?.({
          round: msg.round,
          nextRound: msg.nextRound,
        });
        break;

      case "game_complete":
        setMatchStatus("completed");
        optionsRef.current.onGameComplete?.(msg.gameId);
        break;

      case "opponent_stroke":
        optionsRef.current.onOpponentStroke?.(msg.stroke);
        break;

      case "opponent_clear":
        optionsRef.current.onOpponentClear?.();
        break;

      case "opponent_disconnected":
        setMatchStatus("opponent_disconnected");
        optionsRef.current.onOpponentDisconnected?.();
        break;

      case "error":
        if (msg.code === "MATCHMAKING_TIMEOUT") {
          setMatchStatus("idle");
          setQueuePosition(0);
        }
        optionsRef.current.onError?.(msg.message, msg.code);
        break;
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
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
        setConnectionStatus("connected");
        reconnectAttemptRef.current = 0;

        pingTimerRef.current = setInterval(() => {
          sendMessage({ type: "ping" });
        }, PING_INTERVAL);
      };

      ws.onmessage = (event: MessageEvent) => {
        if (typeof event.data === "string") {
          handleMessage(event.data);
        }
      };

      ws.onclose = () => {
        setConnectionStatus("disconnected");
        clearTimers();
        wsRef.current = null;

        if (!intentionalCloseRef.current && shouldReconnectRef.current && matchStatus !== "completed") {
          const delay = RECONNECT_DELAYS[Math.min(reconnectAttemptRef.current, RECONNECT_DELAYS.length - 1)];
          reconnectAttemptRef.current++;
          reconnectTimerRef.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = () => {
        // onclose will fire after this
      };
    } catch {
      setConnectionStatus("disconnected");
    }
  }, [clearTimers, sendMessage, handleMessage, matchStatus]);

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

  const joinQueue = useCallback(() => {
    sendMessage({ type: "join_queue" });
  }, [sendMessage]);

  const leaveQueue = useCallback(() => {
    sendMessage({ type: "leave_queue" });
  }, [sendMessage]);

  const submitTurn = useCallback((strokes: Array<{ points: Array<{ x: number; y: number }>; color: string; width: number }>) => {
    sendMessage({ type: "submit_turn", strokes });
  }, [sendMessage]);

  const sendStroke = useCallback((stroke: { id: string; path: string; color: string; strokeWidth: number }) => {
    sendMessage({ type: "draw_stroke", stroke });
  }, [sendMessage]);

  const sendClear = useCallback(() => {
    sendMessage({ type: "draw_clear" });
  }, [sendMessage]);

  useEffect(() => {
    return () => {
      intentionalCloseRef.current = true;
      shouldReconnectRef.current = false;
      clearTimers();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [clearTimers]);

  return {
    connectionStatus,
    matchStatus,
    matchInfo,
    gameState,
    queuePosition,
    connect,
    disconnect,
    joinQueue,
    leaveQueue,
    submitTurn,
    sendStroke,
    sendClear,
  };
}
