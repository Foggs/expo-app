import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import type { DrawingCanvasRef, Stroke } from "@/components/DrawingCanvas";
import { useGameWebSocket } from "@/contexts/WebSocketContext";
import type { ThemeColors } from "@/hooks/useThemeColors";
import { useGameTimer } from "@/hooks/useGameTimer";
import { type PlayerId, useTurnFlow } from "@/hooks/useTurnFlow";
import { addRoundDrawing, clearRoundDrawings } from "@/lib/gameStore";
import { getTimerColor, toWireStrokes } from "@/lib/gameUtils";
import { confirmAction, showPlatformAlert } from "@/lib/platformDialogs";
import {
  impactHeavy,
  impactLight,
  impactMedium,
  notifyError,
  notifySuccess,
  notifyWarning,
} from "@/lib/platformFeedback";

const DEFAULT_COLOR = "#6C5CE7";
const DEFAULT_BRUSH_SIZE = 4;

interface UseGameScreenControllerOptions {
  playerRole: PlayerId;
  opponentName: string;
  colors: ThemeColors;
}

export function useGameScreenController({
  playerRole,
  opponentName,
  colors,
}: UseGameScreenControllerOptions) {
  const canvasRef = useRef<DrawingCanvasRef>(null);
  const navigatedRef = useRef(false);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [opponentStrokes, setOpponentStrokes] = useState<Stroke[]>([]);
  const [backgroundStrokes, setBackgroundStrokes] = useState<Stroke[]>([]);
  const [strokeColor, setStrokeColor] = useState(DEFAULT_COLOR);
  const [strokeWidth, setStrokeWidth] = useState(DEFAULT_BRUSH_SIZE);
  const [isEraser, setIsEraser] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBrushPicker, setShowBrushPicker] = useState(false);

  const timerPulse = useSharedValue(1);
  const getReadyScale = useSharedValue(1);
  const prevIsMyTurnRef = useRef<boolean | null>(null);
  const lastStrokeSendRef = useRef<number>(0);
  const opponentDrawingRoundRef = useRef<number>(1);
  const opponentStrokesRef = useRef<Stroke[]>([]);
  const backgroundStrokesRef = useRef<Stroke[]>([]);

  const ws = useGameWebSocket();
  const {
    gameState,
    submitTurn: submitTurnToWs,
    sendStroke,
    sendUndo,
    sendClear,
    setCallbacks,
    disconnect,
  } = ws;

  const handleSubmitTurnRef = useRef<(() => void) | null>(null);

  const timer = useGameTimer({
    onTimeUp: () => handleSubmitTurnRef.current?.(),
    autoStart: false,
  });

  const turnFlow = useTurnFlow({
    playerRole,
    serverGameState: gameState,
    onTimerStart: timer.start,
    onTimerPause: timer.pause,
    onTimerRestart: timer.restart,
    onSubmitStrokes: (_submissionId, flowStrokes) => {
      return submitTurnToWs(
        flowStrokes as {
          points: { x: number; y: number }[];
          color: string;
          width: number;
        }[]
      );
    },
    onNavigateResults: () => {
      if (!navigatedRef.current) {
        navigatedRef.current = true;
        if (opponentStrokesRef.current.length > 0) {
          addRoundDrawing({
            round: opponentDrawingRoundRef.current,
            playerRole: playerRole === "player1" ? "player2" : "player1",
            strokes: [...backgroundStrokesRef.current, ...opponentStrokesRef.current],
          });
        }
        router.push({ pathname: "/results", params: { opponentName } });
      }
    },
    onNavigateHome: () => {
      if (navigatedRef.current) return;
      navigatedRef.current = true;
      disconnect();
      showPlatformAlert(
        "Opponent Disconnected",
        "Your opponent has left the game.",
        () => router.replace("/"),
        "Your opponent has disconnected. Returning to home."
      );
    },
  });

  const {
    isMyTurn,
    isSubmitting,
    currentRound,
    currentPlayer,
    roundDisplay,
    turnDisplay,
    showGetReady,
    getReadyCountdown,
  } = turnFlow;
  const {
    submitTurn,
    dispatchTurn,
    retrySubmit,
    turnState,
    lastError,
  } = turnFlow;

  const handleSubmitTurn = useCallback(() => {
    if (isSubmitting || !isMyTurn) return;

    notifySuccess();

    const wsStrokes = toWireStrokes(strokes);

    addRoundDrawing({
      round: currentRound,
      playerRole,
      strokes: [...backgroundStrokes, ...strokes],
    });
    setBackgroundStrokes((prev) => [...prev, ...strokes]);
    setStrokes([]);

    submitTurn(wsStrokes);

    const sent = submitTurnToWs(wsStrokes);
    if (sent) {
      dispatchTurn({ type: "SUBMIT_SEND_OK" });
      return;
    }

    dispatchTurn({
      type: "SUBMIT_SEND_FAILED",
      error: {
        code: "SEND_FAILED",
        source: "websocket",
        retryable: true,
        fatal: false,
        message: "Failed to send turn data",
        stateVersion: 0,
        occurredAt: Date.now(),
      },
    });
  }, [
    isSubmitting,
    isMyTurn,
    strokes,
    currentRound,
    playerRole,
    backgroundStrokes,
    submitTurn,
    dispatchTurn,
    submitTurnToWs,
  ]);

  handleSubmitTurnRef.current = handleSubmitTurn;

  useEffect(() => {
    clearRoundDrawings();

    setCallbacks({
      onTurnSubmitted: () => {},
      onOpponentStroke: (stroke) => {
        setOpponentStrokes((prev) => {
          const idx = prev.findIndex((s) => s.id === stroke.id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], path: stroke.path };
            return updated;
          }
          return [...prev, stroke];
        });
      },
      onOpponentClear: () => {
        setOpponentStrokes([]);
      },
      onOpponentUndo: () => {
        setOpponentStrokes((prev) => prev.slice(0, -1));
      },
      onOpponentDisconnected: () => {
        dispatchTurn({ type: "SERVER_OPPONENT_DISCONNECTED" });
      },
      onError: (message, code) => {
        console.warn("Game WebSocket error:", message, code);
      },
    });

    return () => {
      setCallbacks({});
    };
  }, [setCallbacks, dispatchTurn]);

  useEffect(() => {
    const wasMyTurn = prevIsMyTurnRef.current;
    prevIsMyTurnRef.current = isMyTurn;

    if (isMyTurn && wasMyTurn !== null && wasMyTurn !== isMyTurn) {
      notifyWarning();
      if (opponentStrokes.length > 0) {
        addRoundDrawing({
          round: opponentDrawingRoundRef.current,
          playerRole: playerRole === "player1" ? "player2" : "player1",
          strokes: [...backgroundStrokes, ...opponentStrokes],
        });
        setBackgroundStrokes((prev) => [...prev, ...opponentStrokes]);
      }
      setStrokes([]);
      setOpponentStrokes([]);
    }

    if (!isMyTurn) {
      opponentDrawingRoundRef.current = currentRound;
    }
  }, [
    isMyTurn,
    currentRound,
    playerRole,
    opponentStrokes,
    backgroundStrokes,
  ]);

  useEffect(() => {
    opponentStrokesRef.current = opponentStrokes;
  }, [opponentStrokes]);

  useEffect(() => {
    backgroundStrokesRef.current = backgroundStrokes;
  }, [backgroundStrokes]);

  useEffect(() => {
    if (timer.timerColor === "critical") {
      timerPulse.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 300, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 300, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      );
      return;
    }

    timerPulse.value = withTiming(1, { duration: 200 });
  }, [timer.timerColor, timerPulse]);

  useEffect(() => {
    if (timer.timerColor === "warning" && timer.timeRemaining === 30) {
      impactMedium();
    } else if (timer.timerColor === "critical" && timer.timeRemaining === 10) {
      notifyError();
    }
  }, [timer.timerColor, timer.timeRemaining]);

  useEffect(() => {
    if (!showGetReady) return;

    impactHeavy();
    getReadyScale.value = withSequence(
      withTiming(1.2, { duration: 200, easing: Easing.out(Easing.ease) }),
      withTiming(1, { duration: 200, easing: Easing.inOut(Easing.ease) })
    );
  }, [showGetReady, getReadyCountdown, getReadyScale]);

  const getReadyAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: getReadyScale.value }],
  }));

  const timerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: timerPulse.value }],
  }));

  const handleStrokesChange = useCallback(
    (newStrokes: Stroke[]) => {
      setStrokes(newStrokes);
      if (newStrokes.length === 0) return;

      const latestStroke = newStrokes[newStrokes.length - 1];
      const now = Date.now();
      if (now - lastStrokeSendRef.current < 50) return;

      lastStrokeSendRef.current = now;
      sendStroke({
        id: latestStroke.id,
        path: latestStroke.path,
        color: latestStroke.color,
        strokeWidth: latestStroke.strokeWidth,
      });
    },
    [sendStroke]
  );

  const handleStrokeComplete = useCallback(
    (stroke: Stroke) => {
      lastStrokeSendRef.current = Date.now();
      sendStroke({
        id: stroke.id,
        path: stroke.path,
        color: stroke.color,
        strokeWidth: stroke.strokeWidth,
      });
    },
    [sendStroke]
  );

  const handleBack = useCallback(() => {
    impactLight();
    timer.pause();

    const doLeave = () => {
      setBackgroundStrokes([]);
      disconnect();
      router.replace("/");
    };

    confirmAction({
      title: "Leave Game?",
      message: "Your progress will be lost if you leave now.",
      webMessage: "Leave Game?\nYour progress will be lost if you leave now.",
      confirmText: "Leave",
      cancelText: "Cancel",
      destructive: true,
      onConfirm: doLeave,
      onCancel: () => {
        if (isMyTurn) timer.start();
      },
    });
  }, [disconnect, isMyTurn, timer]);

  const handleSubmit = useCallback(() => {
    notifySuccess();
    handleSubmitTurn();
  }, [handleSubmitTurn]);

  const handleUndo = useCallback(() => {
    impactLight();
    canvasRef.current?.undo();
    sendUndo();
  }, [sendUndo]);

  const handleClear = useCallback(() => {
    impactMedium();
    if (strokes.length === 0) return;

    confirmAction({
      title: "Clear Canvas?",
      message: "This will remove all your drawing.",
      webMessage: "Clear Canvas?\nThis will remove all your drawing.",
      confirmText: "Clear",
      cancelText: "Cancel",
      destructive: true,
      onConfirm: () => {
        canvasRef.current?.clear();
        sendClear();
      },
    });
  }, [strokes.length, sendClear]);

  const handleColorPress = useCallback(() => {
    impactLight();
    setShowColorPicker(true);
  }, []);

  const handleBrushPress = useCallback(() => {
    impactLight();
    setShowBrushPicker(true);
  }, []);

  const handleEraserToggle = useCallback(() => {
    impactLight();
    setIsEraser((prev) => !prev);
  }, []);

  const handleExitToHome = useCallback(() => {
    disconnect();
    router.replace("/");
  }, [disconnect]);

  const activeColor = isEraser ? "#FFFFFF" : strokeColor;
  const timerColor = getTimerColor(timer.timerColor, colors);

  return {
    canvasRef,
    timer,
    strokes,
    opponentStrokes,
    backgroundStrokes,
    strokeColor,
    strokeWidth,
    isEraser,
    showColorPicker,
    showBrushPicker,
    isMyTurn,
    isSubmitting,
    currentPlayer,
    roundDisplay,
    turnDisplay,
    showGetReady,
    getReadyCountdown,
    getReadyAnimatedStyle,
    timerAnimatedStyle,
    activeColor,
    timerColor,
    turnState,
    lastError,
    retrySubmit,
    setStrokeColor,
    setStrokeWidth,
    setIsEraser,
    setShowColorPicker,
    setShowBrushPicker,
    handleStrokesChange,
    handleStrokeComplete,
    handleBack,
    handleSubmit,
    handleUndo,
    handleClear,
    handleColorPress,
    handleBrushPress,
    handleEraserToggle,
    handleExitToHome,
  };
}
