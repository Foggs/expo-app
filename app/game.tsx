import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useRef, useState, useCallback } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import DrawingCanvas, {
  DrawingCanvasRef,
  Stroke,
} from "@/components/DrawingCanvas";
import ColorPicker from "@/components/ColorPicker";
import BrushSizePicker from "@/components/BrushSizePicker";

const DEFAULT_COLOR = "#6C5CE7";
const DEFAULT_BRUSH_SIZE = 4;

export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const canvasRef = useRef<DrawingCanvasRef>(null);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [strokeColor, setStrokeColor] = useState(DEFAULT_COLOR);
  const [strokeWidth, setStrokeWidth] = useState(DEFAULT_BRUSH_SIZE);
  const [isEraser, setIsEraser] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBrushPicker, setShowBrushPicker] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const handleBack = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (strokes.length > 0) {
      Alert.alert(
        "Leave Game?",
        "Your drawing will be lost if you leave now.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Leave", style: "destructive", onPress: () => router.back() },
        ]
      );
    } else {
      router.back();
    }
  };

  const handleSubmit = () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    router.push("/results");
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
      Alert.alert("Clear Canvas?", "This will remove all your drawing.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => canvasRef.current?.clear(),
        },
      ]);
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
    if (isEraser) {
      setIsEraser(false);
    } else {
      setIsEraser(true);
    }
  };

  const activeColor = isEraser ? colors.canvasBackground : strokeColor;

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
          <View style={[styles.timerBadge, { backgroundColor: colors.card }]}>
            <Ionicons name="timer" size={20} color={colors.timerActive} />
            <Text style={[styles.timerText, { color: colors.text }]}>2:00</Text>
          </View>
        </View>

        <View style={styles.roundBadge}>
          <Text style={[styles.roundText, { color: colors.textSecondary }]}>
            Round 1/3
          </Text>
        </View>
      </View>

      <View style={styles.turnIndicator}>
        <View style={[styles.playerDot, { backgroundColor: colors.player1 }]} />
        <Text style={[styles.turnText, { color: colors.text }]}>
          Your Turn to Draw
        </Text>
      </View>

      <View style={styles.canvasContainer}>
        <DrawingCanvas
          ref={canvasRef}
          strokeColor={activeColor}
          strokeWidth={strokeWidth}
          strokes={strokes}
          onStrokesChange={setStrokes}
        />
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
            disabled={strokes.length === 0}
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
            disabled={strokes.length === 0}
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
          style={[styles.submitButton, { backgroundColor: colors.tint }]}
          accessibilityRole="button"
          accessibilityLabel="Submit your drawing"
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
    width: 44,
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
  canvasContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
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
});
