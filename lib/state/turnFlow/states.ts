import type { IState, TransitionResult } from "../core";
import type { TurnFlowModel, TurnFlowEvent, TurnFlowEffect } from "./types";

type TState = IState<TurnFlowModel, TurnFlowEvent, TurnFlowEffect>;
type TResult = TransitionResult<TurnFlowModel, TurnFlowEffect> | null;

const SUBMIT_RETRY_CAP = 5;

function generateSubmissionId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function handleGameComplete(event: TurnFlowEvent): TResult {
  if (event.type === "SERVER_GAME_COMPLETED") {
    return {
      nextStateId: "game_complete",
      modelPatch: {},
      effects: [],
    };
  }
  return null;
}

function handleOpponentDisconnected(event: TurnFlowEvent): TResult {
  if (event.type === "SERVER_OPPONENT_DISCONNECTED") {
    return {
      nextStateId: "opponent_disconnected",
      modelPatch: {},
      effects: [],
    };
  }
  return null;
}

function handleFatalError(event: TurnFlowEvent): TResult {
  if (event.type === "ERROR_RAISED" && event.error.fatal) {
    return {
      nextStateId: "sync_error_fatal",
      modelPatch: { lastError: event.error },
      effects: [],
    };
  }
  return null;
}

function handleTerminalEvents(event: TurnFlowEvent): TResult {
  return (
    handleGameComplete(event) ??
    handleOpponentDisconnected(event) ??
    handleFatalError(event)
  );
}

export const waitingForTurnState: TState = {
  id: "waiting_for_turn",
  enter: () => [
    { type: "STOP_OPPONENT_COUNTDOWN" } as TurnFlowEffect,
    { type: "START_OPPONENT_COUNTDOWN" } as TurnFlowEffect,
  ],
  exit: () => [{ type: "STOP_OPPONENT_COUNTDOWN" } as TurnFlowEffect],
  handle: (model, event): TResult => {
    if (event.type === "SERVER_TURN_CHANGED" && event.currentPlayer === model.playerRole) {
      return {
        nextStateId: "drawing_turn",
        modelPatch: {
          currentPlayer: event.currentPlayer,
          currentRound: event.currentRound,
          totalRounds: event.totalRounds,
          stateVersion: model.stateVersion + 1,
        },
        effects: [],
      };
    }
    if (event.type === "SERVER_TURN_CHANGED" && event.currentPlayer !== model.playerRole) {
      return {
        nextStateId: "waiting_for_turn",
        modelPatch: {
          currentPlayer: event.currentPlayer,
          currentRound: event.currentRound,
          totalRounds: event.totalRounds,
          stateVersion: model.stateVersion + 1,
        },
        effects: [],
      };
    }
    if (event.type === "SERVER_GAME_STATE_ACK" && event.currentPlayer === model.playerRole) {
      return {
        nextStateId: "drawing_turn",
        modelPatch: {
          currentPlayer: event.currentPlayer,
          currentRound: event.currentRound,
          totalRounds: event.totalRounds,
          stateVersion: model.stateVersion + 1,
        },
        effects: [],
      };
    }
    return handleTerminalEvents(event);
  },
};

export const drawingTurnState: TState = {
  id: "drawing_turn",
  enter: () => [{ type: "START_PLAYER_TIMER" } as TurnFlowEffect],
  exit: () => [{ type: "PAUSE_PLAYER_TIMER" } as TurnFlowEffect],
  handle: (model, event): TResult => {
    if (event.type === "USER_SUBMIT" || event.type === "TIMER_EXPIRED") {
      const strokes = event.strokes;
      const submissionId = generateSubmissionId();
      return {
        nextStateId: "submitting_turn",
        modelPatch: {
          submissionId,
          pendingStrokes: strokes,
          retryCount: 0,
        },
        effects: [
          { type: "COMMIT_ROUND_DRAWING", round: model.currentRound, strokes },
        ],
      };
    }
    if (event.type === "SERVER_TURN_CHANGED" && event.currentPlayer !== model.playerRole) {
      return {
        nextStateId: "waiting_for_turn",
        modelPatch: {
          currentPlayer: event.currentPlayer,
          currentRound: event.currentRound,
          totalRounds: event.totalRounds,
          stateVersion: model.stateVersion + 1,
        },
        effects: [],
      };
    }
    return handleTerminalEvents(event);
  },
};

export const submittingTurnState: TState = {
  id: "submitting_turn",
  enter: () => [],
  exit: () => [],
  handle: (_model, event): TResult => {
    if (event.type === "SUBMIT_SEND_OK") {
      return {
        nextStateId: "awaiting_server_ack",
        modelPatch: {},
        effects: [],
      };
    }
    if (event.type === "SUBMIT_SEND_FAILED") {
      if (event.error.fatal) {
        return {
          nextStateId: "sync_error_fatal",
          modelPatch: { lastError: event.error },
          effects: [],
        };
      }
      return {
        nextStateId: "submit_retrying",
        modelPatch: { lastError: event.error },
        effects: [],
      };
    }
    return handleTerminalEvents(event);
  },
};

export const awaitingServerAckState: TState = {
  id: "awaiting_server_ack",
  enter: () => [],
  exit: () => [],
  handle: (model, event): TResult => {
    if (event.type === "SERVER_GAME_STATE_ACK") {
      if (event.currentPlayer === model.playerRole) {
        return {
          nextStateId: "drawing_turn",
          modelPatch: {
            currentPlayer: event.currentPlayer,
            currentRound: event.currentRound,
            totalRounds: event.totalRounds,
            submissionId: null,
            pendingStrokes: null,
            retryCount: 0,
            stateVersion: model.stateVersion + 1,
          },
          effects: [{ type: "CLEAR_TRANSIENT_STROKES" }],
        };
      }
      return {
        nextStateId: "waiting_for_turn",
        modelPatch: {
          currentPlayer: event.currentPlayer,
          currentRound: event.currentRound,
          totalRounds: event.totalRounds,
          submissionId: null,
          pendingStrokes: null,
          retryCount: 0,
          stateVersion: model.stateVersion + 1,
        },
        effects: [{ type: "CLEAR_TRANSIENT_STROKES" }],
      };
    }
    if (event.type === "SERVER_TURN_CHANGED") {
      if (event.currentPlayer === model.playerRole) {
        return {
          nextStateId: "drawing_turn",
          modelPatch: {
            currentPlayer: event.currentPlayer,
            currentRound: event.currentRound,
            totalRounds: event.totalRounds,
            submissionId: null,
            pendingStrokes: null,
            retryCount: 0,
            stateVersion: model.stateVersion + 1,
          },
          effects: [{ type: "CLEAR_TRANSIENT_STROKES" }],
        };
      }
      return {
        nextStateId: "waiting_for_turn",
        modelPatch: {
          currentPlayer: event.currentPlayer,
          currentRound: event.currentRound,
          totalRounds: event.totalRounds,
          submissionId: null,
          pendingStrokes: null,
          retryCount: 0,
          stateVersion: model.stateVersion + 1,
        },
        effects: [{ type: "CLEAR_TRANSIENT_STROKES" }],
      };
    }
    if (event.type === "ERROR_RAISED" && !event.error.fatal) {
      return {
        nextStateId: "submit_retrying",
        modelPatch: { lastError: event.error },
        effects: [],
      };
    }
    return handleTerminalEvents(event);
  },
};

export const submitRetryingState: TState = {
  id: "submit_retrying",
  enter: (model) => {
    const effects: TurnFlowEffect[] = [{ type: "PAUSE_PLAYER_TIMER" }];
    if (model.submissionId && model.pendingStrokes) {
      effects.push({
        type: "QUEUE_SUBMIT_RETRY",
        submissionId: model.submissionId,
        strokes: model.pendingStrokes,
      });
    }
    return effects;
  },
  exit: () => [{ type: "CLEAR_SUBMIT_RETRY" } as TurnFlowEffect],
  handle: (model, event): TResult => {
    if (event.type === "RETRY_BUDGET_REMAINING") {
      const nextRetry = model.retryCount + 1;
      if (nextRetry >= SUBMIT_RETRY_CAP) {
        return {
          nextStateId: "submit_failed",
          modelPatch: { retryCount: nextRetry },
          effects: [],
        };
      }
      return {
        nextStateId: "awaiting_server_ack",
        modelPatch: { retryCount: nextRetry },
        effects: [],
      };
    }
    if (event.type === "RETRY_BUDGET_EXHAUSTED") {
      return {
        nextStateId: "submit_failed",
        modelPatch: {},
        effects: [],
      };
    }
    if (event.type === "SERVER_GAME_STATE_ACK" || event.type === "SERVER_TURN_CHANGED") {
      const currentPlayer = event.currentPlayer;
      const nextState = currentPlayer === model.playerRole ? "drawing_turn" : "waiting_for_turn";
      return {
        nextStateId: nextState,
        modelPatch: {
          currentPlayer,
          currentRound: event.currentRound,
          totalRounds: event.totalRounds,
          submissionId: null,
          pendingStrokes: null,
          retryCount: 0,
          lastError: null,
          stateVersion: model.stateVersion + 1,
        },
        effects: [{ type: "CLEAR_TRANSIENT_STROKES" }],
      };
    }
    return handleTerminalEvents(event);
  },
};

export const submitFailedState: TState = {
  id: "submit_failed",
  enter: (model) => {
    const effects: TurnFlowEffect[] = [{ type: "CLEAR_SUBMIT_RETRY" }];
    if (model.lastError) {
      effects.push({ type: "EMIT_ERROR_UI", error: model.lastError });
    }
    return effects;
  },
  exit: () => [],
  handle: (model, event): TResult => {
    if (event.type === "USER_RETRY_SUBMIT") {
      return {
        nextStateId: "submitting_turn",
        modelPatch: { retryCount: 0 },
        effects: [],
      };
    }
    if (event.type === "SERVER_STATE_RESYNC") {
      const nextState = event.currentPlayer === model.playerRole ? "drawing_turn" : "waiting_for_turn";
      return {
        nextStateId: nextState,
        modelPatch: {
          currentPlayer: event.currentPlayer,
          currentRound: event.currentRound,
          totalRounds: event.totalRounds,
          submissionId: null,
          pendingStrokes: null,
          retryCount: 0,
          lastError: null,
          stateVersion: model.stateVersion + 1,
        },
        effects: [{ type: "CLEAR_TRANSIENT_STROKES" }],
      };
    }
    if (event.type === "NAVIGATE_HOME") {
      return {
        nextStateId: "sync_error_fatal",
        modelPatch: {},
        effects: [{ type: "NAVIGATE_HOME" }],
      };
    }
    return handleFatalError(event) ?? handleGameComplete(event) ?? handleOpponentDisconnected(event);
  },
};

export const syncErrorFatalState: TState = {
  id: "sync_error_fatal",
  enter: (model) => {
    const effects: TurnFlowEffect[] = [
      { type: "PAUSE_PLAYER_TIMER" },
      { type: "STOP_OPPONENT_COUNTDOWN" },
      { type: "CLEAR_SUBMIT_RETRY" },
    ];
    if (model.lastError) {
      effects.push({ type: "EMIT_ERROR_UI", error: model.lastError });
    }
    return effects;
  },
  exit: () => [],
  handle: (_model, event): TResult => {
    if (event.type === "NAVIGATE_HOME") {
      return {
        nextStateId: "sync_error_fatal",
        modelPatch: {},
        effects: [{ type: "NAVIGATE_HOME" }],
      };
    }
    return null;
  },
};

export const gameCompleteState: TState = {
  id: "game_complete",
  enter: () => [
    { type: "PAUSE_PLAYER_TIMER" } as TurnFlowEffect,
    { type: "STOP_OPPONENT_COUNTDOWN" } as TurnFlowEffect,
    { type: "CLEAR_SUBMIT_RETRY" } as TurnFlowEffect,
    { type: "NAVIGATE_RESULTS" } as TurnFlowEffect,
  ],
  exit: () => [],
  handle: (): TResult => {
    return null;
  },
};

export const opponentDisconnectedState: TState = {
  id: "opponent_disconnected",
  enter: () => [
    { type: "PAUSE_PLAYER_TIMER" } as TurnFlowEffect,
    { type: "STOP_OPPONENT_COUNTDOWN" } as TurnFlowEffect,
    { type: "CLEAR_SUBMIT_RETRY" } as TurnFlowEffect,
    { type: "NAVIGATE_HOME" } as TurnFlowEffect,
  ],
  exit: () => [],
  handle: (): TResult => {
    return null;
  },
};

export const turnFlowStates: Record<string, TState> = {
  waiting_for_turn: waitingForTurnState,
  drawing_turn: drawingTurnState,
  submitting_turn: submittingTurnState,
  awaiting_server_ack: awaitingServerAckState,
  game_complete: gameCompleteState,
  opponent_disconnected: opponentDisconnectedState,
  submit_retrying: submitRetryingState,
  submit_failed: submitFailedState,
  sync_error_fatal: syncErrorFatalState,
};

export const INITIAL_TURN_FLOW_MODEL: TurnFlowModel = {
  playerRole: "player1",
  currentRound: 1,
  currentPlayer: null,
  totalRounds: 3,
  submissionId: null,
  retryCount: 0,
  pendingStrokes: null,
  lastError: null,
  stateVersion: 0,
};
