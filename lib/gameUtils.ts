import type { Stroke } from "@/components/DrawingCanvas";
import type { ThemeColors } from "@/hooks/useThemeColors";

export interface WireStroke {
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

export function toWireStrokes(strokes: Stroke[]): WireStroke[] {
  return strokes.map((stroke) => ({
    points: stroke.path
      .split(/[ML]/)
      .filter(Boolean)
      .map((point) => {
        const [x, y] = point.trim().split(",").map(Number);
        return { x: x || 0, y: y || 0 };
      }),
    color: stroke.color,
    width: stroke.strokeWidth,
  }));
}

export function getTimerColor(
  timerColor: "active" | "warning" | "critical",
  colors: ThemeColors
) {
  switch (timerColor) {
    case "critical":
      return colors.timerCritical;
    case "warning":
      return colors.timerWarning;
    default:
      return colors.timerActive;
  }
}
