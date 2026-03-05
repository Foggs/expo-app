import { useState, useRef, useCallback, useEffect } from "react";
import { createMachine } from "@/lib/state";
import type { FlowError } from "@/lib/state";
import {
  turnFlowStates,
  INITIAL_TURN_FLOW_MODEL,
} from "@/lib/state/turnFlow";
import type {
  TurnFlowStateId,
  TurnFlowEvent,
  TurnFlowEffect,
  TurnFlowModel,
} from "@/lib/state/turnFlow";
import type { GameStateFromServer } from "@/contexts/WebSocketContext";

export type PlayerId = "player1" | "player2";

const TOTAL_ROUNDS = 3;
const OPPONENT_TURN_DURATION = 60;
const GET_READY_THRESHOLD = 10;
const SUBMIT_RETRY_DELAY_MS = 3000;

interface UseTurnFlowOptions {
  playerRole: PlayerId;
  serverGameState: GameStateFromServer | null;
  onTimerStart?: () => void;
  onTimerPause?: () => void;
  onTimerRestart?: () => void;
  onSubmitStrokes?: (submissionId: string, strokes: unknown[]) => boolean;
  onNavigateResults?: () => void;
  onNavigateHome?: () => void;
}

interface UseTurnFlowReturn {
  turnState: TurnFlowStateId;
  isMyTurn: boolean;
  isSubmitting: boolean;
  currentRound: number;
  currentPlayer: PlayerId | null;
  totalRounds: number;
  roundDisplay: string;
  turnDisplay: string;
  lastError: FlowError | null;
  canRetry: boolean;
  showGetReady: boolean;
  getReadyCountdown: number;
  dispatchTurn: (event: TurnFlowEvent) => void;
  submitTurn: (strokes: unknown[]) => void;
  retrySubmit: () => void;
  navigateHome: () => void;
}

export function useTurnFlow(options: UseTurnFlowOptions): UseTurnFlowReturn {
  const {
    playerRole,
    serverGameState,
    onTimerStart,
    onTimerPause,
    onTimerRestart,
    onSubmitStrokes,
    onNavigateResults,
    onNavigateHome,
  } = options;

  const [snapshot, setSnapshot] = useState<{
    stateId: TurnFlowStateId;
    model: TurnFlowModel;
  }>({
    stateId: "waiting_for_turn",
    model: { ...INITIAL_TURN_FLOW_MODEL, playerRole },
  });

  const [showGetReady, setShowGetReady] = useState(false);
  const [getReadyCountdown, setGetReadyCountdown] = useState(GET_READY_THRESHOLD);

  const machineRef = useRef<ReturnType<typeof createMachine<TurnFlowModel, TurnFlowEvent, TurnFlowEffect>> | null>(null);
  const mountedRef = useRef(true);
  const opponentTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const opponentTimeRef = useRef(OPPONENT_TURN_DURATION);
  const submitRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const callbackRefs = useRef(options);
  callbackRefs.current = options;

  const clearOpponentTimer = useCallback(() => {
    if (opponentTimerRef.current) {
      clearInterval(opponentTimerRef.current);
      opponentTimerRef.current = null;
    }
  }, []);

  const startOpponentTimer = useCallback(() => {
    clearOpponentTimer();
    opponentTimeRef.current = OPPONENT_TURN_DURATION;
    if (mountedRef.current) {
      setShowGetReady(false);
      setGetReadyCountdown(GET_READY_THRESHOLD);
    }
    opponentTimerRef.current = setInterval(() => {
      if (!mountedRef.current) {
        clearOpponentTimer();
        return;
      }
      opponentTimeRef.current -= 1;
      if (opponentTimeRef.current <= GET_READY_THRESHOLD && opponentTimeRef.current > 0) {
        setGetReadyCountdown(opponentTimeRef.current);
        setShowGetReady(true);
      }
      if (opponentTimeRef.current <= 0) {
        clearOpponentTimer();
      }
    }, 1000);
  }, [clearOpponentTimer]);

  const clearSubmitRetryTimer = useCallback(() => {
    if (submitRetryTimerRef.current) {
      clearTimeout(submitRetryTimerRef.current);
      submitRetryTimerRef.current = null;
    }
  }, []);

  const effectRunner = useCallback(
    (effect: TurnFlowEffect, dispatch: (event: TurnFlowEvent) => void) => {
      switch (effect.type) {
        case "START_PLAYER_TIMER":
          callbackRefs.current.onTimerRestart?.();
          break;
        case "PAUSE_PLAYER_TIMER":
          callbackRefs.current.onTimerPause?.();
          break;
        case "START_OPPONENT_COUNTDOWN":
          startOpponentTimer();
          break;
        case "STOP_OPPONENT_COUNTDOWN":
          clearOpponentTimer();
          setShowGetReady(false);
          break;
        case "QUEUE_SUBMIT_RETRY":
          clearSubmitRetryTimer();
          submitRetryTimerRef.current = setTimeout(() => {
            if (!mountedRef.current) return;
            const sent = callbackRefs.current.onSubmitStrokes?.(
              effect.submissionId,
              effect.strokes,
            );
            if (sent) {
              dispatch({ type: "RETRY_BUDGET_REMAINING" });
            } else {
              dispatch({ type: "RETRY_BUDGET_REMAINING" });
            }
          }, SUBMIT_RETRY_DELAY_MS);
          break;
        case "CLEAR_SUBMIT_RETRY":
          clearSubmitRetryTimer();
          break;
        case "CLEAR_TRANSIENT_STROKES":
          break;
        case "COMMIT_ROUND_DRAWING":
          break;
        case "NAVIGATE_RESULTS":
          callbackRefs.current.onNavigateResults?.();
          break;
        case "NAVIGATE_HOME":
          callbackRefs.current.onNavigateHome?.();
          break;
        case "EMIT_ERROR_UI":
          break;
      }
    },
    [startOpponentTimer, clearOpponentTimer, clearSubmitRetryTimer],
  );

  useEffect(() => {
    const initialModel: TurnFlowModel = {
      ...INITIAL_TURN_FLOW_MODEL,
      playerRole,
    };

    const machine = createMachine<TurnFlowModel, TurnFlowEvent, TurnFlowEffect>(
      "TurnFlow",
      turnFlowStates,
      "waiting_for_turn",
      initialModel,
      effectRunner,
    );

    machineRef.current = machine;

    const unsubscribe = machine.subscribe((s) => {
      if (!mountedRef.current) return;
      setSnapshot({
        stateId: s.stateId as TurnFlowStateId,
        model: s.model,
      });
    });

    return () => {
      unsubscribe();
      machineRef.current = null;
    };
  }, [playerRole, effectRunner]);

  useEffect(() => {
    if (!serverGameState) return;
    const machine = machineRef.current;
    if (!machine) return;

    if (serverGameState.status === "completed") {
      machine.dispatch({ type: "SERVER_GAME_COMPLETED" });
      return;
    }

    const currentState = machine.currentStateId as TurnFlowStateId;

    if (
      currentState === "awaiting_server_ack" ||
      currentState === "submit_retrying" ||
      currentState === "submitting_turn"
    ) {
      machine.dispatch({
        type: "SERVER_GAME_STATE_ACK",
        currentPlayer: serverGameState.currentPlayer,
        currentRound: serverGameState.currentRound,
        totalRounds: serverGameState.totalRounds,
      });
    } else {
      machine.dispatch({
        type: "SERVER_TURN_CHANGED",
        currentPlayer: serverGameState.currentPlayer,
        currentRound: serverGameState.currentRound,
        totalRounds: serverGameState.totalRounds,
      });
    }
  }, [serverGameState]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearOpponentTimer();
      clearSubmitRetryTimer();
    };
  }, [clearOpponentTimer, clearSubmitRetryTimer]);

  const dispatchTurn = useCallback((event: TurnFlowEvent) => {
    machineRef.current?.dispatch(event);
  }, []);

  const submitTurn = useCallback((strokes: unknown[]) => {
    machineRef.current?.dispatch({ type: "USER_SUBMIT", strokes });
  }, []);

  const retrySubmit = useCallback(() => {
    machineRef.current?.dispatch({ type: "USER_RETRY_SUBMIT" });
  }, []);

  const navigateHome = useCallback(() => {
    machineRef.current?.dispatch({ type: "NAVIGATE_HOME" });
  }, []);

  const { stateId, model } = snapshot;

  const isMyTurn = stateId === "drawing_turn";
  const isSubmitting =
    stateId === "submitting_turn" ||
    stateId === "awaiting_server_ack" ||
    stateId === "submit_retrying";

  const currentRound = model.currentRound;
  const currentPlayer = model.currentPlayer;
  const totalRounds = model.totalRounds || TOTAL_ROUNDS;
  const roundDisplay = `Round ${currentRound}/${totalRounds}`;

  let turnDisplay = "Opponent's Turn";
  if (stateId === "game_complete") {
    turnDisplay = "Game Complete!";
  } else if (stateId === "opponent_disconnected") {
    turnDisplay = "Opponent Disconnected";
  } else if (stateId === "sync_error_fatal" || stateId === "submit_failed") {
    turnDisplay = "Error";
  } else if (isMyTurn) {
    turnDisplay = "Your Turn to Draw";
  } else if (isSubmitting) {
    turnDisplay = "Submitting...";
  }

  return {
    turnState: stateId,
    isMyTurn,
    isSubmitting,
    currentRound,
    currentPlayer,
    totalRounds,
    roundDisplay,
    turnDisplay,
    lastError: model.lastError,
    canRetry: stateId === "submit_failed",
    showGetReady,
    getReadyCountdown,
    dispatchTurn,
    submitTurn,
    retrySubmit,
    navigateHome,
  };
}
