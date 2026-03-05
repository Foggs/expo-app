import type { FlowError } from "../errors";

export type TurnFlowStateId =
  | "waiting_for_turn"
  | "drawing_turn"
  | "submitting_turn"
  | "awaiting_server_ack"
  | "game_complete"
  | "opponent_disconnected"
  | "submit_retrying"
  | "submit_failed"
  | "sync_error_fatal";

export interface TurnFlowModel {
  playerRole: "player1" | "player2";
  currentRound: number;
  currentPlayer: "player1" | "player2" | null;
  totalRounds: number;
  submissionId: string | null;
  retryCount: number;
  pendingStrokes: unknown[] | null;
  lastError: FlowError | null;
  stateVersion: number;
}

export type TurnFlowEvent =
  | { type: "SERVER_TURN_CHANGED"; currentPlayer: "player1" | "player2"; currentRound: number; totalRounds: number }
  | { type: "USER_SUBMIT"; strokes: unknown[] }
  | { type: "TIMER_EXPIRED"; strokes: unknown[] }
  | { type: "SUBMIT_SEND_OK" }
  | { type: "SUBMIT_SEND_FAILED"; error: FlowError }
  | { type: "SERVER_GAME_STATE_ACK"; currentPlayer: "player1" | "player2"; currentRound: number; totalRounds: number }
  | { type: "SERVER_NOT_YOUR_TURN" }
  | { type: "SERVER_GAME_COMPLETED" }
  | { type: "SERVER_OPPONENT_DISCONNECTED" }
  | { type: "RETRY_BUDGET_REMAINING" }
  | { type: "RETRY_BUDGET_EXHAUSTED" }
  | { type: "USER_RETRY_SUBMIT" }
  | { type: "SERVER_STATE_RESYNC"; currentPlayer: "player1" | "player2"; currentRound: number; totalRounds: number }
  | { type: "NAVIGATE_HOME" }
  | { type: "ERROR_RAISED"; error: FlowError };

export type TurnFlowEffect =
  | { type: "START_PLAYER_TIMER" }
  | { type: "PAUSE_PLAYER_TIMER" }
  | { type: "START_OPPONENT_COUNTDOWN" }
  | { type: "STOP_OPPONENT_COUNTDOWN" }
  | { type: "QUEUE_SUBMIT_RETRY"; submissionId: string; strokes: unknown[] }
  | { type: "CLEAR_SUBMIT_RETRY" }
  | { type: "CLEAR_TRANSIENT_STROKES" }
  | { type: "COMMIT_ROUND_DRAWING"; round: number; strokes: unknown[] }
  | { type: "NAVIGATE_RESULTS" }
  | { type: "NAVIGATE_HOME" }
  | { type: "EMIT_ERROR_UI"; error: FlowError };
