import type { IState, TransitionResult } from "../core";
import type { MatchFlowModel, MatchFlowEvent, MatchFlowEffect } from "./types";

type MState = IState<MatchFlowModel, MatchFlowEvent, MatchFlowEffect>;
type MResult = TransitionResult<MatchFlowModel, MatchFlowEffect> | null;

const RECONNECT_CAP = 8;
const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 30_000;

function computeBackoffDelay(attempt: number): number {
  const exponential = BACKOFF_BASE_MS * Math.pow(2, attempt);
  const capped = Math.min(exponential, BACKOFF_MAX_MS);
  const jitter = capped * (0.5 + Math.random() * 0.5);
  return Math.round(jitter);
}

function handleFatalFromAny(
  event: MatchFlowEvent,
): MResult {
  if (event.type === "ERROR_RAISED" && event.error.fatal) {
    return {
      nextStateId: "error_fatal",
      modelPatch: { lastError: event.error },
      effects: [],
    };
  }
  return null;
}

function handleDisconnectFromAny(
  event: MatchFlowEvent,
): MResult {
  if (event.type === "DISCONNECT_REQUESTED") {
    return {
      nextStateId: "idle",
      modelPatch: {
        gameId: null,
        playerRole: null,
        opponentName: null,
        matchType: null,
        queuePosition: 0,
        reconnectAttempt: 0,
        lastError: null,
        retryDelayMs: 0,
      },
      effects: [{ type: "CLOSE_SOCKET" }, { type: "CLEAR_RECONNECT" }, { type: "CLEAR_BACKOFF_TIMER" }],
    };
  }
  return null;
}

export const idleState: MState = {
  id: "idle",
  enter: () => [],
  exit: () => [],
  handle: (model, event): MResult => {
    if (event.type === "FIND_MATCH_CLICKED") {
      return {
        nextStateId: "connecting",
        modelPatch: { stateVersion: model.stateVersion + 1 },
        effects: [{ type: "OPEN_SOCKET" }],
      };
    }
    if (event.type === "MATCH_FOUND") {
      return {
        nextStateId: "matched",
        modelPatch: {
          gameId: event.gameId,
          playerRole: event.playerRole,
          opponentName: event.opponentName,
          matchType: event.matchType,
          queuePosition: 0,
          stateVersion: model.stateVersion + 1,
        },
        effects: [
          {
            type: "SET_CALLBACK_PAYLOAD",
            event: "matchFound",
            payload: {
              gameId: event.gameId,
              playerRole: event.playerRole,
              opponentName: event.opponentName,
              matchType: event.matchType,
            },
          },
        ],
      };
    }
    return null;
  },
};

export const connectingState: MState = {
  id: "connecting",
  enter: () => [],
  exit: () => [],
  handle: (model, event): MResult => {
    if (event.type === "WS_OPENED") {
      return {
        nextStateId: "queueing",
        modelPatch: { reconnectAttempt: 0 },
        effects: [{ type: "SEND_JOIN_QUEUE" }],
      };
    }
    if (event.type === "WS_CLOSED") {
      return {
        nextStateId: "error_recoverable",
        modelPatch: {
          lastError: {
            code: "CONNECTION_FAILED",
            source: "websocket",
            retryable: true,
            fatal: false,
            message: "Connection closed before opening",
            stateVersion: model.stateVersion,
            occurredAt: Date.now(),
          },
        },
        effects: [],
      };
    }
    return handleDisconnectFromAny(event) ?? handleFatalFromAny(event);
  },
};

export const queueingState: MState = {
  id: "queueing",
  enter: () => [],
  exit: () => [],
  handle: (model, event): MResult => {
    if (event.type === "QUEUE_JOINED") {
      return {
        nextStateId: "queueing",
        modelPatch: { queuePosition: event.position },
        effects: [],
      };
    }
    if (event.type === "MATCH_FOUND") {
      return {
        nextStateId: "matched",
        modelPatch: {
          gameId: event.gameId,
          playerRole: event.playerRole,
          opponentName: event.opponentName,
          matchType: event.matchType,
          queuePosition: 0,
        },
        effects: [
          {
            type: "SET_CALLBACK_PAYLOAD",
            event: "matchFound",
            payload: {
              gameId: event.gameId,
              playerRole: event.playerRole,
              opponentName: event.opponentName,
              matchType: event.matchType,
            },
          },
        ],
      };
    }
    if (event.type === "CANCEL_SEARCH" || event.type === "MATCHMAKING_TIMEOUT") {
      return {
        nextStateId: "idle",
        modelPatch: { queuePosition: 0 },
        effects: [{ type: "SEND_LEAVE_QUEUE" }, { type: "CLOSE_SOCKET" }],
      };
    }
    if (event.type === "WS_CLOSED") {
      return {
        nextStateId: "error_recoverable",
        modelPatch: {
          lastError: {
            code: "WS_CLOSED_IN_QUEUE",
            source: "websocket",
            retryable: true,
            fatal: false,
            message: "Connection lost while in queue",
            stateVersion: model.stateVersion,
            occurredAt: Date.now(),
          },
        },
        effects: [],
      };
    }
    return handleDisconnectFromAny(event) ?? handleFatalFromAny(event);
  },
};

export const matchedState: MState = {
  id: "matched",
  enter: () => [],
  exit: () => [],
  handle: (_model, event): MResult => {
    if (event.type === "GAME_STATE_RECEIVED") {
      return {
        nextStateId: "playing",
        modelPatch: { stateVersion: _model.stateVersion + 1 },
        effects: [
          {
            type: "SET_CALLBACK_PAYLOAD",
            event: "gameState",
            payload: {
              gameId: event.gameId,
              currentRound: event.currentRound,
              currentPlayer: event.currentPlayer,
              totalRounds: event.totalRounds,
              status: event.status,
            },
          },
        ],
      };
    }
    if (event.type === "CANCEL_SEARCH") {
      return {
        nextStateId: "idle",
        modelPatch: {
          gameId: null,
          playerRole: null,
          opponentName: null,
          matchType: null,
        },
        effects: [{ type: "CLOSE_SOCKET" }],
      };
    }
    return handleDisconnectFromAny(event) ?? handleFatalFromAny(event);
  },
};

export const playingState: MState = {
  id: "playing",
  enter: () => [],
  exit: () => [],
  handle: (model, event): MResult => {
    if (event.type === "GAME_STATE_RECEIVED") {
      return {
        nextStateId: "playing",
        modelPatch: { stateVersion: model.stateVersion + 1 },
        effects: [
          {
            type: "SET_CALLBACK_PAYLOAD",
            event: "gameState",
            payload: {
              gameId: event.gameId,
              currentRound: event.currentRound,
              currentPlayer: event.currentPlayer,
              totalRounds: event.totalRounds,
              status: event.status,
            },
          },
        ],
      };
    }
    if (event.type === "GAME_COMPLETE_RECEIVED") {
      return {
        nextStateId: "completed",
        modelPatch: {},
        effects: [
          {
            type: "SET_CALLBACK_PAYLOAD",
            event: "gameComplete",
            payload: event.gameId,
          },
        ],
      };
    }
    if (event.type === "OPPONENT_DISCONNECTED_RECEIVED") {
      return {
        nextStateId: "opponent_disconnected",
        modelPatch: {},
        effects: [
          {
            type: "SET_CALLBACK_PAYLOAD",
            event: "opponentDisconnected",
            payload: null,
          },
        ],
      };
    }
    if (event.type === "WS_CLOSED") {
      return {
        nextStateId: "error_recoverable",
        modelPatch: {
          lastError: {
            code: "WS_CLOSED_IN_GAME",
            source: "websocket",
            retryable: true,
            fatal: false,
            message: "Connection lost during game",
            stateVersion: model.stateVersion,
            occurredAt: Date.now(),
          },
        },
        effects: [],
      };
    }
    return handleDisconnectFromAny(event) ?? handleFatalFromAny(event);
  },
};

export const completedState: MState = {
  id: "completed",
  enter: () => [],
  exit: () => [],
  handle: (_model, event): MResult => {
    return handleDisconnectFromAny(event);
  },
};

export const opponentDisconnectedState: MState = {
  id: "opponent_disconnected",
  enter: () => [],
  exit: () => [],
  handle: (_model, event): MResult => {
    return handleDisconnectFromAny(event);
  },
};

export const reconnectingState: MState = {
  id: "reconnecting",
  enter: () => [],
  exit: () => [{ type: "CLEAR_RECONNECT" } as MatchFlowEffect],
  handle: (model, event): MResult => {
    if (event.type === "WS_OPENED") {
      return {
        nextStateId: "queueing",
        modelPatch: { reconnectAttempt: 0, lastError: null, retryDelayMs: 0, matchType: null },
        effects: [{ type: "SEND_JOIN_QUEUE" }],
      };
    }
    if (event.type === "WS_CLOSED" || (event.type === "ERROR_RAISED" && !event.error.fatal)) {
      const nextAttempt = model.reconnectAttempt + 1;
      if (nextAttempt >= RECONNECT_CAP) {
        return {
          nextStateId: "error_fatal",
          modelPatch: {
            reconnectAttempt: nextAttempt,
            lastError: {
              code: "RECONNECT_CAP_REACHED",
              source: "websocket",
              retryable: false,
              fatal: true,
              message: `Reconnect failed after ${RECONNECT_CAP} attempts`,
              stateVersion: model.stateVersion,
              occurredAt: Date.now(),
            },
          },
          effects: [],
        };
      }
      return {
        nextStateId: "error_recoverable",
        modelPatch: {
          reconnectAttempt: nextAttempt,
          lastError: event.type === "ERROR_RAISED"
            ? event.error
            : {
                code: "WS_CLOSED_RECONNECTING",
                source: "websocket" as const,
                retryable: true,
                fatal: false,
                message: "Connection closed during reconnect",
                stateVersion: model.stateVersion,
                occurredAt: Date.now(),
              },
        },
        effects: [],
      };
    }
    return handleDisconnectFromAny(event) ?? handleFatalFromAny(event);
  },
};

export const errorRecoverableState: MState = {
  id: "error_recoverable",
  enter: (model) => {
    const effects: MatchFlowEffect[] = [];
    if (model.lastError) {
      effects.push({ type: "EMIT_ERROR_UI", error: model.lastError });
    }
    if (model.reconnectAttempt > 0) {
      const delay = computeBackoffDelay(model.reconnectAttempt);
      effects.push({ type: "SCHEDULE_BACKOFF_TIMER", delayMs: delay });
      return effects;
    }
    effects.push({ type: "SCHEDULE_RECONNECT", delayMs: 0 });
    return effects;
  },
  exit: () => [
    { type: "CLEAR_RECONNECT" } as MatchFlowEffect,
    { type: "CLEAR_BACKOFF_TIMER" } as MatchFlowEffect,
  ],
  handle: (model, event): MResult => {
    if (event.type === "RETRY_TIMER_EXPIRED") {
      if (model.reconnectAttempt > 0) {
        return {
          nextStateId: "reconnecting",
          modelPatch: {},
          effects: [{ type: "OPEN_SOCKET" }],
        };
      }
      return {
        nextStateId: "reconnecting",
        modelPatch: {},
        effects: [{ type: "OPEN_SOCKET" }],
      };
    }
    return handleDisconnectFromAny(event) ?? handleFatalFromAny(event);
  },
};

export const errorBackoffState: MState = {
  id: "error_backoff",
  enter: (model) => {
    const delay = computeBackoffDelay(model.reconnectAttempt);
    return [
      { type: "SCHEDULE_BACKOFF_TIMER", delayMs: delay },
    ];
  },
  exit: () => [{ type: "CLEAR_BACKOFF_TIMER" } as MatchFlowEffect],
  handle: (_model, event): MResult => {
    if (event.type === "RETRY_TIMER_EXPIRED") {
      return {
        nextStateId: "reconnecting",
        modelPatch: {},
        effects: [{ type: "OPEN_SOCKET" }],
      };
    }
    if (event.type === "DISCONNECT_REQUESTED") {
      return {
        nextStateId: "idle",
        modelPatch: {
          gameId: null,
          playerRole: null,
          opponentName: null,
          matchType: null,
          queuePosition: 0,
          reconnectAttempt: 0,
          lastError: null,
          retryDelayMs: 0,
        },
        effects: [{ type: "CLEAR_BACKOFF_TIMER" }],
      };
    }
    return handleFatalFromAny(event);
  },
};

export const errorFatalState: MState = {
  id: "error_fatal",
  enter: (model) => {
    const effects: MatchFlowEffect[] = [
      { type: "CLOSE_SOCKET" },
      { type: "CLEAR_RECONNECT" },
      { type: "CLEAR_BACKOFF_TIMER" },
      { type: "CLEAR_SESSION" },
    ];
    if (model.lastError) {
      effects.push({ type: "EMIT_ERROR_UI", error: model.lastError });
    }
    return effects;
  },
  exit: () => [],
  handle: (_model, event): MResult => {
    return handleDisconnectFromAny(event);
  },
};

export const matchFlowStates: Record<string, MState> = {
  idle: idleState,
  connecting: connectingState,
  queueing: queueingState,
  matched: matchedState,
  playing: playingState,
  completed: completedState,
  opponent_disconnected: opponentDisconnectedState,
  reconnecting: reconnectingState,
  error_recoverable: errorRecoverableState,
  error_backoff: errorBackoffState,
  error_fatal: errorFatalState,
};

export const INITIAL_MATCH_FLOW_MODEL: MatchFlowModel = {
  stateVersion: 0,
  gameId: null,
  playerRole: null,
  opponentName: null,
  matchType: null,
  queuePosition: 0,
  reconnectAttempt: 0,
  lastError: null,
  retryDelayMs: 0,
};
