import type { Stroke } from "@/components/DrawingCanvas";

export interface RoundDrawing {
  round: number;
  playerRole: string;
  strokes: Stroke[];
}

let roundDrawings: RoundDrawing[] = [];

export function addRoundDrawing(drawing: RoundDrawing) {
  roundDrawings.push(drawing);
}

export function getRoundDrawings(): RoundDrawing[] {
  return [...roundDrawings];
}

export function clearRoundDrawings() {
  roundDrawings = [];
}
