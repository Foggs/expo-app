import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import DrawingCanvas, {
  type DrawingCanvasRef,
  type Stroke,
} from "@/components/DrawingCanvas";

export interface GameCanvasSectionProps {
  canvasRef: React.RefObject<DrawingCanvasRef | null>;
  isMyTurn: boolean;
  canDraw: boolean;
  isSubmitting: boolean;
  activeColor: string;
  strokeWidth: number;
  strokes: Stroke[];
  opponentStrokes: Stroke[];
  backgroundStrokes: Stroke[];
  onStrokesChange: (newStrokes: Stroke[]) => void;
  onStrokeComplete: (stroke: Stroke) => void;
}

export default function GameCanvasSection({
  canvasRef,
  isMyTurn,
  canDraw,
  isSubmitting,
  activeColor,
  strokeWidth,
  strokes,
  opponentStrokes,
  backgroundStrokes,
  onStrokesChange,
  onStrokeComplete,
}: GameCanvasSectionProps) {
  return (
    <View
      style={styles.canvasContainer}
      accessible={true}
      accessibilityLabel={
        isMyTurn
          ? "Drawing canvas. Touch and drag to draw."
          : "Opponent's drawing canvas. View only."
      }
    >
      <DrawingCanvas
        ref={canvasRef}
        strokeColor={activeColor}
        strokeWidth={strokeWidth}
        strokes={isMyTurn ? strokes : opponentStrokes}
        onStrokesChange={onStrokesChange}
        onStrokeComplete={onStrokeComplete}
        disabled={!canDraw || isSubmitting}
        backgroundStrokes={backgroundStrokes}
      />
      {!isMyTurn && (
        <View style={styles.canvasOverlay}>
          <View
            style={styles.opponentDrawingLabel}
            accessible={true}
            accessibilityLiveRegion="polite"
            accessibilityLabel={
              opponentStrokes.length > 0
                ? "Opponent is currently drawing"
                : "Waiting for opponent to draw"
            }
          >
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
  );
}

const styles = StyleSheet.create({
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
});
