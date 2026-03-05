import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BrushSizePicker from "@/components/BrushSizePicker";
import ColorPicker from "@/components/ColorPicker";
import type { DrawingCanvasRef, Stroke } from "@/components/DrawingCanvas";
import GameCanvasSection from "@/components/GameCanvasSection";
import GameHeader from "@/components/GameHeader";
import GameStatusOverlays from "@/components/GameStatusOverlays";
import GameToolbar from "@/components/GameToolbar";
import GameTurnIndicator from "@/components/GameTurnIndicator";
import { useGameWebSocket } from "@/contexts/WebSocketContext";
import { useGameTimer } from "@/hooks/useGameTimer";
import { useScreenPadding } from "@/hooks/useScreenPadding";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useTurnFlow, type PlayerId } from "@/hooks/useTurnFlow";
import { addRoundDrawing, clearRoundDrawings } from "@/lib/gameStore";
import { getTimerColor, toWireStrokes } from "@/lib/gameUtils";
import {
  impactHeavy,
  impactLight,
  impactMedium,
  notifyError,
  notifySuccess,
  notifyWarning,
} from "@/lib/platformFeedback";
import { confirmAction, showPlatformAlert } from "@/lib/platformDialogs";

const DEFAULT_COLOR = "#6C5CE7";
const DEFAULT_BRUSH_SIZE = 4;

export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeColors();
  const { topPadding, bottomPadding } = useScreenPadding(insets);

  const params = useLocalSearchParams<{
    gameId: string;
    playerRole: string;
    opponentName: string;
  }>();

  const playerRole = (params.playerRole as PlayerId) ?? "player1";
  const opponentName = params.opponentName ?? "Opponent";

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

  const handleSubmitTurnRef = useRef<(() => void) | null>(null);

  const timer = useGameTimer({
    onTimeUp: () => handleSubmitTurnRef.current?.(),
    autoStart: false,
  });

  const turnFlow = useTurnFlow({
    playerRole,
    serverGameState: ws.gameState,
    onTimerStart: timer.start,
    onTimerPause: timer.pause,
    onTimerRestart: timer.restart,
    onSubmitStrokes: (_submissionId, flowStrokes) => {
      return ws.submitTurn(
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
      ws.disconnect();
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

    turnFlow.submitTurn(wsStrokes);

    const sent = ws.submitTurn(wsStrokes);
    if (sent) {
      turnFlow.dispatchTurn({ type: "SUBMIT_SEND_OK" });
    } else {
      turnFlow.dispatchTurn({
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
    }
  }, [
    strokes,
    currentRound,
    playerRole,
    backgroundStrokes,
    isSubmitting,
    isMyTurn,
    turnFlow,
    ws,
  ]);

  handleSubmitTurnRef.current = handleSubmitTurn;

  useEffect(() => {
    clearRoundDrawings();

    ws.setCallbacks({
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
        turnFlow.dispatchTurn({ type: "SERVER_OPPONENT_DISCONNECTED" });
      },
      onError: (message, code) => {
        console.warn("Game WebSocket error:", message, code);
      },
    });

    return () => {
      ws.setCallbacks({});
    };
  }, []);

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
  }, [isMyTurn]);

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
    } else {
      timerPulse.value = withTiming(1, { duration: 200 });
    }
  }, [timer.timerColor]);

  useEffect(() => {
    if (timer.timerColor === "warning" && timer.timeRemaining === 30) {
      impactMedium();
    } else if (timer.timerColor === "critical" && timer.timeRemaining === 10) {
      notifyError();
    }
  }, [timer.timerColor, timer.timeRemaining]);

  useEffect(() => {
    if (showGetReady) {
      impactHeavy();
      getReadyScale.value = withSequence(
        withTiming(1.2, { duration: 200, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 200, easing: Easing.inOut(Easing.ease) })
      );
    }
  }, [getReadyCountdown]);

  const getReadyAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: getReadyScale.value }],
  }));

  const timerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: timerPulse.value }],
  }));

  const handleStrokesChange = useCallback(
    (newStrokes: Stroke[]) => {
      setStrokes(newStrokes);
      if (newStrokes.length > 0) {
        const latestStroke = newStrokes[newStrokes.length - 1];
        const now = Date.now();
        if (now - lastStrokeSendRef.current >= 50) {
          lastStrokeSendRef.current = now;
          ws.sendStroke({
            id: latestStroke.id,
            path: latestStroke.path,
            color: latestStroke.color,
            strokeWidth: latestStroke.strokeWidth,
          });
        }
      }
    },
    [ws]
  );

  const handleStrokeComplete = useCallback(
    (stroke: Stroke) => {
      lastStrokeSendRef.current = Date.now();
      ws.sendStroke({
        id: stroke.id,
        path: stroke.path,
        color: stroke.color,
        strokeWidth: stroke.strokeWidth,
      });
    },
    [ws]
  );

  const handleBack = () => {
    impactLight();
    timer.pause();

    const doLeave = () => {
      setBackgroundStrokes([]);
      ws.disconnect();
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
  };

  const handleSubmit = () => {
    notifySuccess();
    handleSubmitTurn();
  };

  const handleUndo = useCallback(() => {
    impactLight();
    canvasRef.current?.undo();
    ws.sendUndo();
  }, [ws]);

  const handleClear = useCallback(() => {
    impactMedium();
    if (strokes.length > 0) {
      confirmAction({
        title: "Clear Canvas?",
        message: "This will remove all your drawing.",
        webMessage: "Clear Canvas?\nThis will remove all your drawing.",
        confirmText: "Clear",
        cancelText: "Cancel",
        destructive: true,
        onConfirm: () => {
          canvasRef.current?.clear();
          ws.sendClear();
        },
      });
    }
  }, [strokes.length, ws]);

  const handleColorPress = () => {
    impactLight();
    setShowColorPicker(true);
  };

  const handleBrushPress = () => {
    impactLight();
    setShowBrushPicker(true);
  };

  const handleEraserToggle = () => {
    impactLight();
    setIsEraser((prev) => !prev);
  };

  const activeColor = isEraser ? "#FFFFFF" : strokeColor;
  const timerColor = getTimerColor(timer.timerColor, colors);

  const handleExitToHome = () => {
    ws.disconnect();
    router.replace("/");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <GameHeader
        colors={colors}
        topPadding={topPadding}
        onBack={handleBack}
        timerAnimatedStyle={timerAnimatedStyle}
        timerColor={timerColor}
        formattedTime={timer.formattedTime}
        roundDisplay={roundDisplay}
      />

      <GameTurnIndicator
        colors={colors}
        currentPlayer={currentPlayer}
        turnDisplay={turnDisplay}
        isMyTurn={isMyTurn}
        opponentName={opponentName}
      />

      <GameCanvasSection
        canvasRef={canvasRef}
        isMyTurn={isMyTurn}
        isSubmitting={isSubmitting}
        activeColor={activeColor}
        strokeWidth={strokeWidth}
        strokes={strokes}
        opponentStrokes={opponentStrokes}
        backgroundStrokes={backgroundStrokes}
        onStrokesChange={handleStrokesChange}
        onStrokeComplete={handleStrokeComplete}
      />

      <GameToolbar
        colors={colors}
        bottomPadding={bottomPadding}
        isMyTurn={isMyTurn}
        isSubmitting={isSubmitting}
        isEraser={isEraser}
        strokeColor={strokeColor}
        strokeCount={strokes.length}
        onBrushPress={handleBrushPress}
        onColorPress={handleColorPress}
        onEraserToggle={handleEraserToggle}
        onUndo={handleUndo}
        onClear={handleClear}
        onSubmit={handleSubmit}
      />

      <ColorPicker
        selectedColor={strokeColor}
        onColorChange={(color) => {
          setStrokeColor(color);
          setIsEraser(false);
        }}
        visible={showColorPicker}
        onClose={() => setShowColorPicker(false)}
      />

      <BrushSizePicker
        selectedSize={strokeWidth}
        onSizeChange={setStrokeWidth}
        visible={showBrushPicker}
        onClose={() => setShowBrushPicker(false)}
        currentColor={strokeColor}
      />

      <GameStatusOverlays
        colors={colors}
        showGetReady={showGetReady}
        getReadyCountdown={getReadyCountdown}
        getReadyAnimatedStyle={getReadyAnimatedStyle}
        isRetrying={turnFlow.turnState === "submit_retrying"}
        showSubmitFailed={turnFlow.turnState === "submit_failed"}
        showSyncFatal={turnFlow.turnState === "sync_error_fatal"}
        lastErrorMessage={turnFlow.lastError?.message}
        onRetrySubmit={turnFlow.retrySubmit}
        onExitGame={handleExitToHome}
        onReturnHome={handleExitToHome}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
