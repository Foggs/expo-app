import { describe, expect, it } from "vitest";
import {
  createPlayerBlockSchema,
  createReportSchema,
  insertGalleryDrawingSchema,
  insertUserSchema,
  reviewReportSchema,
  submitTurnSchema,
  wsClientMessageSchema,
} from "../schema";

// These pin the request and WebSocket limits the server relies on, so a
// validation-library upgrade cannot silently loosen or tighten them.

const TOKEN = "a".repeat(64);

function wsStroke(overrides: Record<string, unknown> = {}) {
  return { id: "stroke-1", path: "M0 0 L1 1", color: "#000000", strokeWidth: 4, ...overrides };
}

function turnStroke(pointCount = 2, overrides: Record<string, unknown> = {}) {
  return {
    points: Array.from({ length: pointCount }, (_, i) => ({ x: i, y: i })),
    color: "#ff0000",
    width: 4,
    ...overrides,
  };
}

function galleryStroke(overrides: Record<string, unknown> = {}) {
  return { id: "s1", path: "M0 0", color: "#000", strokeWidth: 3, ...overrides };
}

const accepts = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) =>
  expect(schema.safeParse(value).success).toBe(true);
const rejects = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) =>
  expect(schema.safeParse(value).success).toBe(false);

describe("WebSocket client messages", () => {
  it("accepts every supported control message", () => {
    for (const type of [
      "join_queue",
      "leave_queue",
      "create_room",
      "leave_room",
      "draw_clear",
      "draw_undo",
      "ping",
      "request_game_state",
    ]) {
      accepts(wsClientMessageSchema, { type });
    }
  });

  it("rejects unknown message types, missing types and extra keys", () => {
    rejects(wsClientMessageSchema, { type: "delete_everything" });
    rejects(wsClientMessageSchema, {});
    rejects(wsClientMessageSchema, null);
    rejects(wsClientMessageSchema, "ping");
    rejects(wsClientMessageSchema, { type: "ping", extra: true });
    rejects(wsClientMessageSchema, { type: "draw_stroke", stroke: wsStroke({ extra: 1 }) });
  });

  it("only authenticates with a 64-character hex device token", () => {
    accepts(wsClientMessageSchema, { type: "authenticate", sessionToken: TOKEN });
    accepts(wsClientMessageSchema, { type: "authenticate", sessionToken: "A".repeat(64) });
    rejects(wsClientMessageSchema, { type: "authenticate", sessionToken: "a".repeat(63) });
    rejects(wsClientMessageSchema, { type: "authenticate", sessionToken: "a".repeat(65) });
    rejects(wsClientMessageSchema, { type: "authenticate", sessionToken: "g".repeat(64) });
    rejects(wsClientMessageSchema, { type: "authenticate" });
  });

  it("normalizes room codes before joining and rejects codes that cannot be valid", () => {
    const result = wsClientMessageSchema.safeParse({ type: "join_room", roomCode: " abc-234 " });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ type: "join_room", roomCode: "ABC234" });

    rejects(wsClientMessageSchema, { type: "join_room", roomCode: "ABC" });
    rejects(wsClientMessageSchema, { type: "join_room", roomCode: "" });
    rejects(wsClientMessageSchema, { type: "join_room", roomCode: 123456 });
  });

  it("keeps live stroke size limits", () => {
    accepts(wsClientMessageSchema, { type: "draw_stroke", stroke: wsStroke({ path: "x".repeat(50_000) }) });
    rejects(wsClientMessageSchema, { type: "draw_stroke", stroke: wsStroke({ path: "x".repeat(50_001) }) });
    accepts(wsClientMessageSchema, { type: "draw_stroke", stroke: wsStroke({ id: "i".repeat(50) }) });
    rejects(wsClientMessageSchema, { type: "draw_stroke", stroke: wsStroke({ id: "i".repeat(51) }) });
    accepts(wsClientMessageSchema, { type: "draw_stroke", stroke: wsStroke({ color: "c".repeat(20) }) });
    rejects(wsClientMessageSchema, { type: "draw_stroke", stroke: wsStroke({ color: "c".repeat(21) }) });
    accepts(wsClientMessageSchema, { type: "draw_stroke", stroke: wsStroke({ strokeWidth: 1 }) });
    accepts(wsClientMessageSchema, { type: "draw_stroke", stroke: wsStroke({ strokeWidth: 50 }) });
    rejects(wsClientMessageSchema, { type: "draw_stroke", stroke: wsStroke({ strokeWidth: 0.5 }) });
    rejects(wsClientMessageSchema, { type: "draw_stroke", stroke: wsStroke({ strokeWidth: 51 }) });
    rejects(wsClientMessageSchema, { type: "draw_stroke", stroke: wsStroke({ strokeWidth: "4" }) });
  });

  it("keeps submitted-turn size limits", () => {
    accepts(wsClientMessageSchema, { type: "submit_turn", strokes: [] });
    accepts(wsClientMessageSchema, { type: "submit_turn", strokes: Array.from({ length: 500 }, () => turnStroke()) });
    rejects(wsClientMessageSchema, { type: "submit_turn", strokes: Array.from({ length: 501 }, () => turnStroke()) });
    accepts(wsClientMessageSchema, { type: "submit_turn", strokes: [turnStroke(5_000)] });
    rejects(wsClientMessageSchema, { type: "submit_turn", strokes: [turnStroke(5_001)] });
    rejects(wsClientMessageSchema, { type: "submit_turn", strokes: [turnStroke(2, { width: 0 })] });
    rejects(wsClientMessageSchema, { type: "submit_turn", strokes: [turnStroke(2, { color: "c".repeat(21) })] });
    rejects(wsClientMessageSchema, {
      type: "submit_turn",
      strokes: [{ ...turnStroke(), points: [{ x: 1, y: 2, z: 3 }] }],
    });
    rejects(wsClientMessageSchema, { type: "submit_turn", strokes: [{ ...turnStroke(), points: [{ x: "1", y: 2 }] }] });
  });

  it("rejects an oversized collection quickly instead of validating every item", () => {
    const huge = Array.from({ length: 200_000 }, () => ({}));
    const started = performance.now();
    rejects(wsClientMessageSchema, { type: "submit_turn", strokes: huge });
    expect(performance.now() - started).toBeLessThan(1_000);
  });
});

describe("HTTP request bodies", () => {
  it("validates gallery saves and their limits", () => {
    const valid = { playerName: "Ada", opponentName: "Bo", strokes: [galleryStroke()], roundCount: 3, sessionToken: TOKEN };
    accepts(insertGalleryDrawingSchema, valid);
    accepts(insertGalleryDrawingSchema, { strokes: [] });
    accepts(insertGalleryDrawingSchema, { strokes: Array.from({ length: 500 }, () => galleryStroke()) });
    rejects(insertGalleryDrawingSchema, { strokes: Array.from({ length: 501 }, () => galleryStroke()) });
    rejects(insertGalleryDrawingSchema, { ...valid, playerName: "n".repeat(51) });
    rejects(insertGalleryDrawingSchema, { ...valid, roundCount: 0 });
    rejects(insertGalleryDrawingSchema, { ...valid, roundCount: 11 });
    rejects(insertGalleryDrawingSchema, { ...valid, sessionToken: "t".repeat(101) });
    rejects(insertGalleryDrawingSchema, { ...valid, strokes: [galleryStroke({ path: "p".repeat(50_001) })] });
    rejects(insertGalleryDrawingSchema, { ...valid, strokes: [galleryStroke({ extra: true })] });
    rejects(insertGalleryDrawingSchema, { ...valid, id: "forced-id" });
    rejects(insertGalleryDrawingSchema, {});
  });

  it("validates both kinds of content report", () => {
    accepts(createReportSchema, { reportType: "gallery", galleryDrawingId: "d1", reason: "spam" });
    accepts(createReportSchema, { reportType: "match", gameId: "g1", reason: "other" });
    for (const reason of ["harassment", "sexual_content", "violence", "hate_speech", "spam", "other"]) {
      accepts(createReportSchema, { reportType: "match", gameId: "g1", reason });
    }
    rejects(createReportSchema, { reportType: "match", gameId: "g1", reason: "boring" });
    rejects(createReportSchema, { reportType: "gallery", gameId: "g1", reason: "spam" });
    rejects(createReportSchema, { reportType: "gallery", galleryDrawingId: "", reason: "spam" });
    rejects(createReportSchema, { reportType: "gallery", galleryDrawingId: "d".repeat(101), reason: "spam" });
    rejects(createReportSchema, { reportType: "player", gameId: "g1", reason: "spam" });
    rejects(createReportSchema, { reportType: "match", gameId: "g1", reason: "spam", note: "extra" });
  });

  it("only blocks a 64-character lowercase hex player ID", () => {
    accepts(createPlayerBlockSchema, { blockedPlayerId: "b".repeat(64) });
    rejects(createPlayerBlockSchema, { blockedPlayerId: "B".repeat(64) });
    rejects(createPlayerBlockSchema, { blockedPlayerId: "b".repeat(63) });
    rejects(createPlayerBlockSchema, { blockedPlayerId: "b".repeat(64), extra: 1 });
  });

  it("validates moderator review updates", () => {
    for (const status of ["reviewed", "dismissed", "actioned"]) {
      accepts(reviewReportSchema, { status });
    }
    accepts(reviewReportSchema, { status: "actioned", reviewNote: "n".repeat(1_000) });
    rejects(reviewReportSchema, { status: "actioned", reviewNote: "n".repeat(1_001) });
    rejects(reviewReportSchema, { status: "pending" });
    rejects(reviewReportSchema, { status: "dismissed", reportId: "x" });
  });

  it("validates debug turn submissions", () => {
    accepts(submitTurnSchema, { playerRole: "player1", round: 1, strokes: [turnStroke()] });
    accepts(submitTurnSchema, { playerRole: "player2", round: 5, strokes: [] });
    rejects(submitTurnSchema, { playerRole: "player3", round: 1, strokes: [] });
    rejects(submitTurnSchema, { playerRole: "player1", round: 0, strokes: [] });
    rejects(submitTurnSchema, { playerRole: "player1", round: 6, strokes: [] });
  });

  it("builds the user insert schema from the database table", () => {
    const result = insertUserSchema.safeParse({ username: "ada", password: "secret", id: "forced" });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ username: "ada", password: "secret" });
    rejects(insertUserSchema, { username: "ada" });
  });
});
