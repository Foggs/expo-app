import React, { useRef, useCallback, useImperativeHandle, forwardRef, useMemo } from "react";
import {
  View,
  StyleSheet,
  useColorScheme,
  LayoutChangeEvent,
  Platform,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { Path } from "react-native-svg";
import Colors from "@/constants/colors";

export interface Stroke {
  id: string;
  path: string;
  color: string;
  strokeWidth: number;
}

export interface DrawingCanvasRef {
  undo: () => void;
  clear: () => void;
  getStrokes: () => Stroke[];
  setStrokes: (strokes: Stroke[]) => void;
}

interface DrawingCanvasProps {
  strokeColor: string;
  strokeWidth: number;
  strokes: Stroke[];
  onStrokesChange: (strokes: Stroke[]) => void;
  onStrokeComplete?: (stroke: Stroke) => void;
  disabled?: boolean;
  backgroundStrokes?: Stroke[];
}

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(
  ({ strokeColor, strokeWidth, strokes, onStrokesChange, onStrokeComplete, disabled = false, backgroundStrokes = [] }, ref) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";
    const colors = isDark ? Colors.dark : Colors.light;

    const currentPathRef = useRef<string>("");
    const currentStrokeIdRef = useRef<string>("");
    const canvasSizeRef = useRef({ width: 0, height: 0 });
    
    const strokeColorRef = useRef(strokeColor);
    const strokeWidthRef = useRef(strokeWidth);
    const strokesRef = useRef(strokes);
    const onStrokesChangeRef = useRef(onStrokesChange);
    const onStrokeCompleteRef = useRef(onStrokeComplete);
    const disabledRef = useRef(disabled);

    strokeColorRef.current = strokeColor;
    strokeWidthRef.current = strokeWidth;
    strokesRef.current = strokes;
    onStrokesChangeRef.current = onStrokesChange;
    onStrokeCompleteRef.current = onStrokeComplete;
    disabledRef.current = disabled;

    const handleLayout = useCallback((event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      canvasSizeRef.current = { width, height };
    }, []);

    const panGesture = useMemo(() => {
      const gesture = Gesture.Pan()
        .minDistance(0)
        .onBegin((event) => {
          if (disabledRef.current) return;
          console.log(`[DEBUG] Pan onBegin: disabled=${disabledRef.current}`);
          const x = Math.max(0, event.x);
          const y = Math.max(0, event.y);
          currentStrokeIdRef.current = generateId();
          currentPathRef.current = `M${x.toFixed(2)},${y.toFixed(2)}`;

          const newStroke: Stroke = {
            id: currentStrokeIdRef.current,
            path: currentPathRef.current,
            color: strokeColorRef.current,
            strokeWidth: strokeWidthRef.current,
          };
          onStrokesChangeRef.current([...strokesRef.current, newStroke]);
        })
        .onUpdate((event) => {
          if (disabledRef.current || !currentStrokeIdRef.current) return;
          const x = Math.max(0, event.x);
          const y = Math.max(0, event.y);
          currentPathRef.current += ` L${x.toFixed(2)},${y.toFixed(2)}`;

          const updatedStrokes = strokesRef.current.map((stroke) =>
            stroke.id === currentStrokeIdRef.current
              ? { ...stroke, path: currentPathRef.current }
              : stroke
          );
          onStrokesChangeRef.current(updatedStrokes);
        })
        .onEnd(() => {
          if (currentStrokeIdRef.current) {
            const completedStroke = strokesRef.current.find(
              (s) => s.id === currentStrokeIdRef.current
            );
            if (completedStroke) {
              onStrokeCompleteRef.current?.(completedStroke);
            }
          }
          currentPathRef.current = "";
          currentStrokeIdRef.current = "";
        })
        .onFinalize(() => {
          if (currentStrokeIdRef.current) {
            const completedStroke = strokesRef.current.find(
              (s) => s.id === currentStrokeIdRef.current
            );
            if (completedStroke) {
              onStrokeCompleteRef.current?.(completedStroke);
            }
          }
          currentPathRef.current = "";
          currentStrokeIdRef.current = "";
        });

      if (Platform.OS !== "web") {
        gesture.shouldCancelWhenOutside(false);
      }

      return gesture;
    }, []);

    useImperativeHandle(ref, () => ({
      undo: () => {
        if (strokesRef.current.length > 0) {
          onStrokesChangeRef.current(strokesRef.current.slice(0, -1));
        }
      },
      clear: () => {
        onStrokesChangeRef.current([]);
      },
      getStrokes: () => strokesRef.current,
      setStrokes: (newStrokes: Stroke[]) => {
        onStrokesChangeRef.current(newStrokes);
      },
    }));

    return (
      <GestureDetector gesture={panGesture}>
        <View
          style={[
            styles.container,
            {
              backgroundColor: "#FFFFFF",
              borderColor: colors.border,
            },
          ]}
          onLayout={handleLayout}
        >
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
            {backgroundStrokes.map((stroke) => (
              <Path
                key={`bg-${stroke.id}`}
                d={stroke.path}
                stroke={stroke.color}
                strokeWidth={stroke.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ))}
            {strokes.map((stroke) => (
              <Path
                key={stroke.id}
                d={stroke.path}
                stroke={stroke.color}
                strokeWidth={stroke.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ))}
          </Svg>
        </View>
      </GestureDetector>
    );
  }
);

DrawingCanvas.displayName = "DrawingCanvas";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 2,
    overflow: "hidden",
  },
});

export default DrawingCanvas;
