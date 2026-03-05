import { describe, it, expect } from "vitest";
import { createMatchMachine, collectEffects, makeFlowError } from "./helpers";

describe("MatchFlow", () => {
  describe("Test 1 — Happy path", () => {
    it("idle → connecting → queueing → matched → playing → completed", () => {
      const m = createMatchMachine();
      expect(m.currentStateId).toBe("idle");

      collectEffects(m, { type: "FIND_MATCH_CLICKED" });
      expect(m.currentStateId).toBe("connecting");

      const openResult = collectEffects(m, { type: "WS_OPENED" });
      expect(m.currentStateId).toBe("queueing");
      expect(openResult.effects.some((e) => e.type === "SEND_JOIN_QUEUE")).toBe(true);

      collectEffects(m, {
        type: "MATCH_FOUND",
        gameId: "game-1",
        playerRole: "player1",
        opponentName: "Alice",
      });
      expect(m.currentStateId).toBe("matched");
      expect(m.model.gameId).toBe("game-1");
      expect(m.model.playerRole).toBe("player1");
      expect(m.model.opponentName).toBe("Alice");

      collectEffects(m, {
        type: "GAME_STATE_RECEIVED",
        gameId: "game-1",
        currentRound: 1,
        currentPlayer: "player1",
        totalRounds: 3,
        status: "active",
      });
      expect(m.currentStateId).toBe("playing");

      collectEffects(m, { type: "GAME_COMPLETE_RECEIVED", gameId: "game-1" });
      expect(m.currentStateId).toBe("completed");
    });
  });

  describe("Test 2 — Cancel search", () => {
    it("from queueing dispatches CANCEL_SEARCH → idle with SEND_LEAVE_QUEUE and CLOSE_SOCKET effects", () => {
      const m = createMatchMachine();
      collectEffects(m, { type: "FIND_MATCH_CLICKED" });
      collectEffects(m, { type: "WS_OPENED" });
      expect(m.currentStateId).toBe("queueing");

      const result = collectEffects(m, { type: "CANCEL_SEARCH" });
      expect(m.currentStateId).toBe("idle");

      const effectTypes = result.effects.map((e) => e.type);
      expect(effectTypes).toContain("SEND_LEAVE_QUEUE");
      expect(effectTypes).toContain("CLOSE_SOCKET");
    });
  });

  describe("Test 3 — Reconnect behavior", () => {
    it("WS_CLOSED in playing → error_recoverable → reconnecting; never reconnects after completed", () => {
      const m = createMatchMachine();
      collectEffects(m, { type: "FIND_MATCH_CLICKED" });
      collectEffects(m, { type: "WS_OPENED" });
      collectEffects(m, {
        type: "MATCH_FOUND",
        gameId: "g1",
        playerRole: "player1",
        opponentName: "Bob",
      });
      collectEffects(m, {
        type: "GAME_STATE_RECEIVED",
        gameId: "g1",
        currentRound: 1,
        currentPlayer: "player1",
        totalRounds: 3,
        status: "active",
      });
      expect(m.currentStateId).toBe("playing");

      const recoverResult = collectEffects(m, { type: "WS_CLOSED", code: 1006 });
      expect(m.currentStateId).toBe("error_recoverable");
      expect(recoverResult.effects.some((e) => e.type === "SCHEDULE_RECONNECT")).toBe(true);

      collectEffects(m, { type: "RETRY_TIMER_EXPIRED" });
      expect(m.currentStateId).toBe("reconnecting");

      const m2 = createMatchMachine();
      collectEffects(m2, { type: "FIND_MATCH_CLICKED" });
      collectEffects(m2, { type: "WS_OPENED" });
      collectEffects(m2, {
        type: "MATCH_FOUND",
        gameId: "g2",
        playerRole: "player1",
        opponentName: "Alice",
      });
      collectEffects(m2, {
        type: "GAME_STATE_RECEIVED",
        gameId: "g2",
        currentRound: 1,
        currentPlayer: "player1",
        totalRounds: 3,
        status: "active",
      });
      collectEffects(m2, { type: "GAME_COMPLETE_RECEIVED", gameId: "g2" });
      expect(m2.currentStateId).toBe("completed");

      collectEffects(m2, { type: "WS_CLOSED", code: 1006 });
      expect(m2.currentStateId).toBe("completed");
    });
  });

  describe("Test 4 — Error escalation to fatal", () => {
    it("at reconnectAttempt 8 transitions to error_fatal", () => {
      const m = createMatchMachine({ reconnectAttempt: 7 }, "reconnecting");

      collectEffects(m, { type: "WS_CLOSED", code: 1006 });
      expect(m.currentStateId).toBe("error_fatal");
      expect(m.model.reconnectAttempt).toBe(8);
    });
  });

  describe("Test 5 — Fatal never retries", () => {
    it("ERROR_RAISED(fatal=true) → error_fatal; WS_OPENED is a no-op", () => {
      const m = createMatchMachine();
      collectEffects(m, { type: "FIND_MATCH_CLICKED" });
      collectEffects(m, { type: "WS_OPENED" });
      expect(m.currentStateId).toBe("queueing");

      const fatalError = makeFlowError({ fatal: true, retryable: false, code: "SESSION_EXPIRED" });
      collectEffects(m, { type: "ERROR_RAISED", error: fatalError });
      expect(m.currentStateId).toBe("error_fatal");

      const modelBefore = { ...m.model };
      collectEffects(m, { type: "WS_OPENED" });
      expect(m.currentStateId).toBe("error_fatal");
      expect(m.model.reconnectAttempt).toBe(modelBefore.reconnectAttempt);
    });
  });

  describe("Backoff path", () => {
    it("error_recoverable with reconnectAttempt > 0 schedules backoff timer; RETRY_TIMER_EXPIRED → reconnecting", () => {
      const m = createMatchMachine({ reconnectAttempt: 2 }, "error_recoverable");
      expect(m.currentStateId).toBe("error_recoverable");

      const result = collectEffects(m, { type: "RETRY_TIMER_EXPIRED" });
      expect(m.currentStateId).toBe("reconnecting");
      expect(result.effects.some((e) => e.type === "OPEN_SOCKET")).toBe(true);
      expect(result.effects.some((e) => e.type === "CLEAR_RECONNECT")).toBe(true);
      expect(result.effects.some((e) => e.type === "CLEAR_BACKOFF_TIMER")).toBe(true);
    });
  });

  describe("DISCONNECT_REQUESTED from playing", () => {
    it("transitions to idle from playing", () => {
      const m = createMatchMachine({ gameId: "g1", playerRole: "player1" }, "playing");
      collectEffects(m, { type: "DISCONNECT_REQUESTED" });
      expect(m.currentStateId).toBe("idle");
    });
  });

  describe("WS_CLOSED in connecting", () => {
    it("transitions to error_recoverable", () => {
      const m = createMatchMachine({}, "connecting");
      collectEffects(m, { type: "WS_CLOSED", code: 1006 });
      expect(m.currentStateId).toBe("error_recoverable");
    });
  });

  describe("Invalid event no-op (MatchFlow)", () => {
    it("unhandled events leave state and model unchanged", () => {
      const states = [
        "idle",
        "connecting",
        "queueing",
        "matched",
        "playing",
        "completed",
        "opponent_disconnected",
        "reconnecting",
        "error_recoverable",
        "error_backoff",
        "error_fatal",
      ] as const;

      const irrelevantEvent = { type: "QUEUE_JOINED" as const, position: 5 };

      for (const stateId of states) {
        if (stateId === "queueing") continue;

        const m = createMatchMachine({}, stateId);
        const modelBefore = JSON.stringify(m.model);
        const stateBefore = m.currentStateId;

        m.dispatch(irrelevantEvent);

        expect(m.currentStateId).toBe(stateBefore);
        expect(JSON.stringify(m.model)).toBe(modelBefore);
      }
    });
  });
});
