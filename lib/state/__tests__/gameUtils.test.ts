import { describe, expect, it } from "vitest";
import Colors from "@/constants/colors";
import type { Stroke } from "@/components/DrawingCanvas";
import { getTimerColor, toWireStrokes } from "@/lib/gameUtils";

describe("gameUtils", () => {
  describe("toWireStrokes", () => {
    it("maps canvas strokes to websocket wire format", () => {
      const strokes: Stroke[] = [
        {
          id: "s1",
          path: "M10,20L30,40",
          color: "#ff0000",
          strokeWidth: 6,
        },
      ];

      const result = toWireStrokes(strokes);

      expect(result).toEqual([
        {
          points: [
            { x: 10, y: 20 },
            { x: 30, y: 40 },
          ],
          color: "#ff0000",
          width: 6,
        },
      ]);
    });

    it("falls back invalid numbers to zero", () => {
      const strokes: Stroke[] = [
        {
          id: "s2",
          path: "M10,fooLbar,20",
          color: "#00ff00",
          strokeWidth: 4,
        },
      ];

      const [wire] = toWireStrokes(strokes);

      expect(wire.points).toEqual([
        { x: 10, y: 0 },
        { x: 0, y: 20 },
      ]);
    });
  });

  describe("getTimerColor", () => {
    it("returns active color for active state", () => {
      expect(getTimerColor("active", Colors.light)).toBe(Colors.light.timerActive);
    });

    it("returns warning color for warning state", () => {
      expect(getTimerColor("warning", Colors.light)).toBe(Colors.light.timerWarning);
    });

    it("returns critical color for critical state", () => {
      expect(getTimerColor("critical", Colors.dark)).toBe(Colors.dark.timerCritical);
    });
  });
});
