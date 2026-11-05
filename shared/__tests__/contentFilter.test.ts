import { describe, expect, it } from "vitest";
import { filterDisplayName } from "../contentFilter";
import { createReportSchema } from "../schema";

describe("content safety input helpers", () => {
  it("masks offensive words in display names without changing safe text", () => {
    expect(filterDisplayName("Kind Artist")).toBe("Kind Artist");
    expect(filterDisplayName("ShIt Artist")).toBe("**** Artist");
  });

  it("accepts supported report reasons and rejects unsupported ones", () => {
    expect(createReportSchema.safeParse({
      reportType: "gallery",
      galleryDrawingId: "drawing-1",
      reason: "hate_speech",
    }).success).toBe(true);
    expect(createReportSchema.safeParse({
      reportType: "gallery",
      galleryDrawingId: "drawing-1",
      reason: "not-a-reason",
    }).success).toBe(false);
  });
});
