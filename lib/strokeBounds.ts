import { Stroke } from "@/components/DrawingCanvas";

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const COORD_REGEX = /[ML]\s*([\d.]+)[,\s]([\d.]+)/g;

export function calculateStrokeBounds(strokes: Stroke[]): string {
  if (!strokes || strokes.length === 0) {
    return "0 0 400 400";
  }

  const bounds: Bounds = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  };

  let hasCoords = false;

  for (const stroke of strokes) {
    let match: RegExpExecArray | null;
    COORD_REGEX.lastIndex = 0;
    while ((match = COORD_REGEX.exec(stroke.path)) !== null) {
      const x = parseFloat(match[1]);
      const y = parseFloat(match[2]);
      if (!isNaN(x) && !isNaN(y)) {
        hasCoords = true;
        const halfWidth = (stroke.strokeWidth || 3) / 2;
        bounds.minX = Math.min(bounds.minX, x - halfWidth);
        bounds.minY = Math.min(bounds.minY, y - halfWidth);
        bounds.maxX = Math.max(bounds.maxX, x + halfWidth);
        bounds.maxY = Math.max(bounds.maxY, y + halfWidth);
      }
    }
  }

  if (!hasCoords) {
    return "0 0 400 400";
  }

  const padding = 10;
  const x = Math.max(0, bounds.minX - padding);
  const y = Math.max(0, bounds.minY - padding);
  const w = bounds.maxX - bounds.minX + padding * 2;
  const h = bounds.maxY - bounds.minY + padding * 2;

  return `${x} ${y} ${w} ${h}`;
}
