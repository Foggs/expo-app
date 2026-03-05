import React, {
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useEffect,
  useMemo,
} from "react";
import {
  View,
  StyleSheet,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
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
    const prevDisabledRef = useRef<boolean | null>(null);

    strokeColorRef.current = strokeColor;
    strokeWidthRef.current = strokeWidth;
    strokesRef.current = strokes;
    onStrokesChangeRef.current = onStrokesChange;
    onStrokeCompleteRef.current = onStrokeComplete;
    disabledRef.current = disabled;

    useEffect(() => {
      if (!__DEV__) return;
      if (prevDisabledRef.current === disabled) return;
      prevDisabledRef.current = disabled;
      console.log(`[DrawingCanvas] disabled=${disabled}`);
    }, [disabled]);

    const handleLayout = useCallback((event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      canvasSizeRef.current = { width, height };
    }, []);

    const getPoint = useCallback(
      (event: GestureResponderEvent) => {
        const { locationX, locationY } = event.nativeEvent;
        return {
          x: Math.max(0, locationX),
          y: Math.max(0, locationY),
        };
      },
      []
    );

    const beginStrokeAtPoint = useCallback((x: number, y: number) => {
      if (disabledRef.current) return;
      currentStrokeIdRef.current = generateId();
      currentPathRef.current = `M${Math.max(0, x).toFixed(2)},${Math.max(0, y).toFixed(2)}`;

      const newStroke: Stroke = {
        id: currentStrokeIdRef.current,
        path: currentPathRef.current,
        color: strokeColorRef.current,
        strokeWidth: strokeWidthRef.current,
      };
      onStrokesChangeRef.current([...strokesRef.current, newStroke]);
    }, []);

    const appendStrokeAtPoint = useCallback((x: number, y: number) => {
      if (disabledRef.current || !currentStrokeIdRef.current) return;
      currentPathRef.current += ` L${Math.max(0, x).toFixed(2)},${Math.max(0, y).toFixed(2)}`;

      const updatedStrokes = strokesRef.current.map((stroke) =>
        stroke.id === currentStrokeIdRef.current
          ? { ...stroke, path: currentPathRef.current }
          : stroke
      );
      onStrokesChangeRef.current(updatedStrokes);
    }, []);

    const finalizeStroke = useCallback(() => {
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
    }, []);

    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabledRef.current,
        onStartShouldSetPanResponderCapture: () => !disabledRef.current,
        onMoveShouldSetPanResponder: () => !disabledRef.current,
        onMoveShouldSetPanResponderCapture: () => !disabledRef.current,
        onPanResponderGrant: (event: GestureResponderEvent) => {
          if (__DEV__) {
            console.log("[DrawingCanvas] pan responder granted");
          }
          const point = getPoint(event);
          beginStrokeAtPoint(point.x, point.y);
        },
        onPanResponderMove: (
          event: GestureResponderEvent,
          _gestureState: PanResponderGestureState
        ) => {
          const point = getPoint(event);
          appendStrokeAtPoint(point.x, point.y);
        },
        onPanResponderRelease: finalizeStroke,
        onPanResponderTerminate: finalizeStroke,
      })
    ).current;

    const panGesture = useMemo(() => {
      return Gesture.Pan()
        .runOnJS(true)
        .minDistance(0)
        .enabled(!disabled)
        .onBegin((event) => {
          if (__DEV__) {
            console.log("[DrawingCanvas] gesture pan begin");
          }
          beginStrokeAtPoint(event.x, event.y);
        })
        .onUpdate((event) => {
          appendStrokeAtPoint(event.x, event.y);
        })
        .onEnd(() => {
          finalizeStroke();
        })
        .onFinalize(() => {
          finalizeStroke();
        });
    }, [appendStrokeAtPoint, beginStrokeAtPoint, disabled, finalizeStroke]);

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

    const canvasContent = (
      <View
        style={[
          styles.container,
          {
            backgroundColor: "#FFFFFF",
            borderColor: colors.border,
          },
        ]}
        onLayout={handleLayout}
        {...panResponder.panHandlers}
      >
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Svg width="100%" height="100%">
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
      </View>
    );

    if (Platform.OS !== "web") {
      return <GestureDetector gesture={panGesture}>{canvasContent}</GestureDetector>;
    }

    return canvasContent;
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
