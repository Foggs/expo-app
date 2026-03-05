import type { FlowError } from "../errors";

export type MatchFlowStateId =
  | "idle"
  | "connecting"
  | "queueing"
  | "matched"
  | "playing"
  | "completed"
  | "opponent_disconnected"
  | "reconnecting"
  | "error_recoverable"
  | "error_backoff"
  | "error_fatal";

export interface MatchFlowModel {
  stateVersion: number;
  gameId: string | null;
  playerRole: "player1" | "player2" | null;
  opponentName: string | null;
  queuePosition: number;
  reconnectAttempt: number;
  lastError: FlowError | null;
  retryDelayMs: number;
}

export type MatchFlowEvent =
  | { type: "FIND_MATCH_CLICKED" }
  | { type: "WS_OPENED" }
  | { type: "WS_CLOSED"; code?: number }
  | { type: "QUEUE_JOINED"; position: number }
  | { type: "QUEUE_LEFT" }
  | {
      type: "MATCH_FOUND";
      gameId: string;
      playerRole: "player1" | "player2";
      opponentName: string;
    }
  | {
      type: "GAME_STATE_RECEIVED";
      gameId: string;
      currentRound: number;
      currentPlayer: "player1" | "player2";
      totalRounds: number;
      status: string;
    }
  | { type: "GAME_COMPLETE_RECEIVED"; gameId: string }
  | { type: "OPPONENT_DISCONNECTED_RECEIVED" }
  | { type: "CANCEL_SEARCH" }
  | { type: "MATCHMAKING_TIMEOUT" }
  | { type: "DISCONNECT_REQUESTED" }
  | { type: "RETRY_TIMER_EXPIRED" }
  | { type: "ERROR_RAISED"; error: FlowError };

export type MatchFlowEffect =
  | { type: "OPEN_SOCKET" }
  | { type: "SEND_JOIN_QUEUE" }
  | { type: "SEND_LEAVE_QUEUE" }
  | { type: "CLOSE_SOCKET" }
  | { type: "SCHEDULE_RECONNECT"; delayMs: number }
  | { type: "CLEAR_RECONNECT" }
  | { type: "SCHEDULE_BACKOFF_TIMER"; delayMs: number }
  | { type: "CLEAR_BACKOFF_TIMER" }
  | {
      type: "SET_CALLBACK_PAYLOAD";
      event: "matchFound" | "gameState" | "gameComplete" | "opponentDisconnected" | "error";
      payload: unknown;
    }
  | { type: "CLEAR_SESSION" }
  | { type: "EMIT_ERROR_UI"; error: FlowError };
