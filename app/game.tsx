import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  Alert,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import DrawingCanvas, {
  DrawingCanvasRef,
  Stroke,
} from "@/components/DrawingCanvas";
import ColorPicker from "@/components/ColorPicker";
import BrushSizePicker from "@/components/BrushSizePicker";
import { useGameTimer } from "@/hooks/useGameTimer";
import { useGameState, PlayerId } from "@/hooks/useGameState";
import { useGameWebSocket } from "@/contexts/WebSocketContext";
import { addRoundDrawing, clearRoundDrawings } from "@/lib/gameStore";

const DEFAULT_COLOR = "#6C5CE7";
const DEFAULT_BRUSH_SIZE = 4;

export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const params = useLocalSearchParams<{
    gameId: string;
    playerRole: string;
    opponentName: string;
  }>();

  const gameId = params.gameId ?? "";
  const playerRole = (params.playerRole as PlayerId) ?? "player1";
  const opponentName = params.opponentName ?? "Opponent";

  const canvasRef = useRef<DrawingCanvasRef>(null);
  const navigatedRef = useRef(false);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [opponentStrokes, setOpponentStrokes] = useState<Stroke[]>([]);
  const [strokeColor, setStrokeColor] = useState(DEFAULT_COLOR);
  const [strokeWidth, setStrokeWidth] = useState(DEFAULT_BRUSH_SIZE);
  const [isEraser, setIsEraser] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBrushPicker, setShowBrushPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const timerPulse = useSharedValue(1);
  const prevIsMyTurnRef = useRef<boolean | null>(null);
  const lastStrokeSendRef = useRef<number>(0);

  const ws = useGameWebSocket();

  const {
    isMyTurn,
    currentRound,
    currentPlayer,
    roundDisplay,
    turnDisplay,
    submitTurn: localSubmitTurn,
    handleServerTurnSubmitted,
    resetGame,
  } = useGameState(playerRole, ws.gameState);

  const timerRestartRef = useRef<(() => void) | null>(null);

  const handleSubmitTurn = useCallback(() => {
    if (isSubmitting || !isMyTurn) return;
    setIsSubmitting(true);

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    localSubmitTurn(strokes);

    const wsStrokes = strokes.map((s) => ({
      points: s.path
        .split(/[ML]/)
        .filter(Boolean)
        .map((p) => {
          const [x, y] = p.trim().split(",").map(Number);
          return { x: x || 0, y: y || 0 };
        }),
      color: s.color,
      width: s.strokeWidth,
    }));

    ws.submitTurn(wsStrokes);
    addRoundDrawing({
      round: currentRound,
      playerRole,
      strokes: [...strokes],
    });
    setStrokes([]);
    timer.pause();
  }, [strokes, isSubmitting, isMyTurn, ws.submitTurn, localSubmitTurn]);

  const timer = useGameTimer({
    onTimeUp: handleSubmitTurn,
    autoStart: false,
  });

  timerRestartRef.current = timer.restart;

  useEffect(() => {
    clearRoundDrawings();

    ws.setCallbacks({
      onTurnSubmitted: (data) => {
        if (data.playerRole !== playerRole) {
          handleServerTurnSubmitted({
            playerRole: data.playerRole as PlayerId,
            round: data.round,
            strokes: data.strokes,
          });
        }
      },
      onGameState: () => {
        setIsSubmitting(false);
      },
      onGameComplete: () => {
        if (!navigatedRef.current) {
          navigatedRef.current = true;
          router.push({ pathname: "/results", params: { opponentName } });
        }
      },
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
      onOpponentDisconnected: () => {
        if (navigatedRef.current) return;
        navigatedRef.current = true;
        timer.pause();
        if (Platform.OS === "web") {
          alert("Your opponent has disconnected. Returning to home.");
          router.replace("/");
        } else {
          Alert.alert(
            "Opponent Disconnected",
            "Your opponent has left the game.",
            [
              {
                text: "OK",
                onPress: () => router.replace("/"),
              },
            ]
          );
        }
      },
      onError: (message) => {
        console.warn("Game WebSocket error:", message);
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
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      if (opponentStrokes.length > 0) {
        addRoundDrawing({
          round: currentRound,
          playerRole: playerRole === "player1" ? "player2" : "player1",
          strokes: [...opponentStrokes],
        });
      }
      setStrokes([]);
      setOpponentStrokes([]);
      canvasRef.current?.clear();
      timerRestartRef.current?.();
    } else if (isMyTurn && wasMyTurn === null) {
      timerRestartRef.current?.();
    }

    if (!isMyTurn) {
      timer.pause();
    }
  }, [isMyTurn]);

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
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } else if (timer.timerColor === "critical" && timer.timeRemaining === 10) {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
  }, [timer.timerColor, timer.timeRemaining]);

  const timerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: timerPulse.value }],
  }));

  const handleStrokesChange = useCallback((newStrokes: Stroke[]) => {
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
  }, [ws.sendStroke]);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const handleBack = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    timer.pause();

    const doLeave = () => {
      resetGame();
      ws.disconnect();
      router.replace("/");
    };

    if (Platform.OS === "web") {
      if (confirm("Leave Game?\nYour progress will be lost if you leave now.")) {
        doLeave();
      } else {
        if (isMyTurn) timer.start();
      }
    } else {
      Alert.alert(
        "Leave Game?",
        "Your progress will be lost if you leave now.",
        [
          { text: "Cancel", style: "cancel", onPress: () => { if (isMyTurn) timer.start(); } },
          {
            text: "Leave",
            style: "destructive",
            onPress: doLeave,
          },
        ]
      );
    }
  };

  const handleSubmit = () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    handleSubmitTurn();
  };

  const handleUndo = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    canvasRef.current?.undo();
  }, []);

  const handleClear = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    if (strokes.length > 0) {
      if (Platform.OS === "web") {
        if (confirm("Clear Canvas?\nThis will remove all your drawing.")) {
          canvasRef.current?.clear();
          ws.sendClear();
        }
      } else {
        Alert.alert("Clear Canvas?", "This will remove all your drawing.", [
          { text: "Cancel", style: "cancel" },
          {
            text: "Clear",
            style: "destructive",
            onPress: () => {
              canvasRef.current?.clear();
              ws.sendClear();
            },
          },
        ]);
      }
    }
  }, [strokes.length]);

  const handleColorPress = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setShowColorPicker(true);
  };

  const handleBrushPress = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setShowBrushPicker(true);
  };

  const handleEraserToggle = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setIsEraser(!isEraser);
  };

  const activeColor = isEraser ? "#FFFFFF" : strokeColor;

  const getTimerColor = () => {
    switch (timer.timerColor) {
      case "critical":
        return colors.timerCritical;
      case "warning":
        return colors.timerWarning;
      default:
        return colors.timerActive;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 8 }]}>
        <Pressable
          onPress={handleBack}
          style={[styles.backButton, { backgroundColor: colors.card }]}
          accessibilityRole="button"
          accessibilityLabel="Go back to home"
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>

        <View style={styles.timerContainer}>
          <Animated.View
            style={[
              styles.timerBadge,
              { backgroundColor: colors.card },
              timerAnimatedStyle,
            ]}
          >
            <Ionicons name="timer" size={20} color={getTimerColor()} />
            <Text
              style={[
                styles.timerText,
                { color: getTimerColor() },
              ]}
              accessibilityLabel={`Time remaining: ${timer.formattedTime}`}
              accessibilityRole="timer"
            >
              {timer.formattedTime}
            </Text>
          </Animated.View>
        </View>

        <View style={styles.roundBadge}>
          <Text
            style={[styles.roundText, { color: colors.textSecondary }]}
            accessibilityLabel={roundDisplay}
          >
            {roundDisplay}
          </Text>
        </View>
      </View>

      <View style={styles.turnIndicator}>
        <View
          style={[
            styles.playerDot,
            {
              backgroundColor:
                currentPlayer === "player1"
                  ? colors.player1
                  : colors.player2,
            },
          ]}
        />
        <Text
          style={[styles.turnText, { color: colors.text }]}
          accessibilityLabel={turnDisplay}
          accessibilityLiveRegion="assertive"
        >
          {turnDisplay}
        </Text>
        {!isMyTurn && (
          <Text style={[styles.opponentLabel, { color: colors.textSecondary }]}>
            ({opponentName})
          </Text>
        )}
      </View>

      <View style={styles.canvasContainer} accessible={true} accessibilityLabel={isMyTurn ? "Drawing canvas. Touch and drag to draw." : "Opponent's drawing canvas. View only."}>
        <DrawingCanvas
          ref={canvasRef}
          strokeColor={activeColor}
          strokeWidth={strokeWidth}
          strokes={isMyTurn ? strokes : opponentStrokes}
          onStrokesChange={handleStrokesChange}
          disabled={!isMyTurn || isSubmitting}
        />
        {!isMyTurn && (
          <View style={styles.canvasOverlay}>
            <View style={styles.opponentDrawingLabel} accessible={true} accessibilityLiveRegion="polite" accessibilityLabel={opponentStrokes.length > 0 ? "Opponent is currently drawing" : "Waiting for opponent to draw"}>
              <Ionicons name="pencil" size={14} color="#fff" />
              <Text style={styles.opponentDrawingText}>
                {opponentStrokes.length > 0
                  ? "Opponent is drawing..."
                  : "Waiting for opponent..."}
              </Text>
            </View>
          </View>
        )}
      </View>

      <View style={[styles.toolbar, { paddingBottom: bottomPadding + 8 }]}>
        <View style={styles.toolGroup}>
          <Pressable
            onPress={handleBrushPress}
            style={[
              styles.toolButton,
              { backgroundColor: colors.card },
              !isEraser && styles.toolButtonActive,
            ]}
            disabled={!isMyTurn}
            accessibilityRole="button"
            accessibilityLabel="Select brush size"
          >
            <Ionicons
              name="brush"
              size={22}
              color={!isEraser ? colors.tint : colors.textSecondary}
            />
          </Pressable>

          <Pressable
            onPress={handleColorPress}
            style={[styles.toolButton, { backgroundColor: colors.card }]}
            disabled={!isMyTurn}
            accessibilityRole="button"
            accessibilityLabel="Select brush color"
          >
            <View
              style={[
                styles.colorSwatch,
                {
                  backgroundColor: strokeColor,
                  borderColor:
                    strokeColor === "#FFFFFF" ? colors.border : "transparent",
                },
              ]}
            />
          </Pressable>

          <Pressable
            onPress={handleEraserToggle}
            style={[
              styles.toolButton,
              { backgroundColor: colors.card },
              isEraser && styles.toolButtonActive,
            ]}
            disabled={!isMyTurn}
            accessibilityRole="button"
            accessibilityLabel={isEraser ? "Switch to brush" : "Switch to eraser"}
            accessibilityState={{ selected: isEraser }}
          >
            <Ionicons
              name="remove-circle-outline"
              size={22}
              color={isEraser ? colors.tint : colors.textSecondary}
            />
          </Pressable>
        </View>

        <View style={styles.toolGroup}>
          <Pressable
            onPress={handleUndo}
            style={[
              styles.toolButton,
              { backgroundColor: colors.card },
              strokes.length === 0 && styles.toolButtonDisabled,
            ]}
            disabled={strokes.length === 0 || !isMyTurn}
            accessibilityRole="button"
            accessibilityLabel="Undo last stroke"
          >
            <Ionicons
              name="arrow-undo"
              size={22}
              color={strokes.length > 0 ? colors.textSecondary : colors.border}
            />
          </Pressable>

          <Pressable
            onPress={handleClear}
            style={[
              styles.toolButton,
              { backgroundColor: colors.card },
              strokes.length === 0 && styles.toolButtonDisabled,
            ]}
            disabled={strokes.length === 0 || !isMyTurn}
            accessibilityRole="button"
            accessibilityLabel="Clear canvas"
          >
            <Ionicons
              name="trash"
              size={22}
              color={strokes.length > 0 ? colors.error : colors.border}
            />
          </Pressable>
        </View>

        <Pressable
          onPress={handleSubmit}
          style={[
            styles.submitButton,
            { backgroundColor: colors.tint },
            (!isMyTurn || isSubmitting) && styles.submitButtonDisabled,
          ]}
          disabled={!isMyTurn || isSubmitting}
          accessibilityRole="button"
          accessibilityLabel="Submit your drawing and end turn"
        >
          <Ionicons name="checkmark" size={24} color="#fff" />
        </Pressable>
      </View>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  timerContainer: {
    flex: 1,
    alignItems: "center",
  },
  timerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  timerText: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
  },
  roundBadge: {
    width: 70,
    alignItems: "flex-end",
  },
  roundText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  turnIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
  },
  playerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  turnText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  opponentLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  canvasContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    position: "relative",
  },
  canvasOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
  },
  opponentDrawingLabel: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 6,
    marginTop: 12,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  opponentDrawingText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  toolGroup: {
    flexDirection: "row",
    gap: 8,
  },
  toolButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  toolButtonActive: {
    borderWidth: 2,
    borderColor: "#6C5CE7",
  },
  toolButtonDisabled: {
    opacity: 0.5,
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
  },
  submitButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
});
