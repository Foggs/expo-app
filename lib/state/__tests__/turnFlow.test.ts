import { describe, it, expect } from "vitest";
import { createTurnMachine, collectEffects, makeFlowError } from "./helpers";

describe("TurnFlow", () => {
  describe("Test 6 — Submit happy path", () => {
    it("drawing_turn → submitting_turn → awaiting_server_ack → waiting_for_turn", () => {
      const m = createTurnMachine({ playerRole: "player1", currentPlayer: "player1" }, "drawing_turn");

      const submitResult = collectEffects(m, { type: "USER_SUBMIT", strokes: [{ id: "s1" }] });
      expect(m.currentStateId).toBe("submitting_turn");
      expect(m.model.submissionId).toBeTruthy();
      expect(m.model.pendingStrokes).toEqual([{ id: "s1" }]);
      expect(submitResult.effects.some((e) => e.type === "PAUSE_PLAYER_TIMER")).toBe(true);
      expect(submitResult.effects.some((e) => e.type === "COMMIT_ROUND_DRAWING")).toBe(true);

      collectEffects(m, { type: "SUBMIT_SEND_OK" });
      expect(m.currentStateId).toBe("awaiting_server_ack");

      collectEffects(m, {
        type: "SERVER_GAME_STATE_ACK",
        currentPlayer: "player2",
        currentRound: 1,
        totalRounds: 3,
      });
      expect(m.currentStateId).toBe("waiting_for_turn");
      expect(m.model.submissionId).toBeNull();
      expect(m.model.pendingStrokes).toBeNull();
    });
  });

  describe("Test 7 — Submit retry reuses submissionId", () => {
    it("submit_retrying + RETRY_BUDGET_REMAINING → awaiting_server_ack with same submissionId", () => {
      const m = createTurnMachine(
        {
          playerRole: "player1",
          currentPlayer: "player1",
          submissionId: "sub-123",
          pendingStrokes: [{ id: "s1" }],
          retryCount: 0,
        },
        "submit_retrying",
      );

      collectEffects(m, { type: "RETRY_BUDGET_REMAINING" });
      expect(m.currentStateId).toBe("awaiting_server_ack");
      expect(m.model.submissionId).toBe("sub-123");
      expect(m.model.retryCount).toBe(1);
    });
  });

  describe("Test 8 — Submit budget exhaustion", () => {
    it("at retry cap, RETRY_BUDGET_REMAINING → submit_failed", () => {
      const m = createTurnMachine(
        {
          playerRole: "player1",
          currentPlayer: "player1",
          submissionId: "sub-456",
          pendingStrokes: [{ id: "s1" }],
          retryCount: 4,
        },
        "submit_retrying",
      );

      collectEffects(m, { type: "RETRY_BUDGET_REMAINING" });
      expect(m.currentStateId).toBe("submit_failed");
      expect(m.model.retryCount).toBe(5);
    });

    it("RETRY_BUDGET_EXHAUSTED also → submit_failed", () => {
      const m = createTurnMachine(
        {
          playerRole: "player1",
          submissionId: "sub-789",
          pendingStrokes: [{ id: "s1" }],
          retryCount: 2,
        },
        "submit_retrying",
      );

      collectEffects(m, { type: "RETRY_BUDGET_EXHAUSTED" });
      expect(m.currentStateId).toBe("submit_failed");
    });
  });

  describe("TIMER_EXPIRED submission", () => {
    it("TIMER_EXPIRED in drawing_turn → submitting_turn with pendingStrokes", () => {
      const m = createTurnMachine({ playerRole: "player1", currentPlayer: "player1" }, "drawing_turn");
      collectEffects(m, { type: "TIMER_EXPIRED", strokes: [{ id: "t1" }] });
      expect(m.currentStateId).toBe("submitting_turn");
      expect(m.model.pendingStrokes).toEqual([{ id: "t1" }]);
      expect(m.model.submissionId).toBeTruthy();
    });
  });

  describe("SUBMIT_SEND_FAILED non-fatal", () => {
    it("non-fatal SUBMIT_SEND_FAILED → submit_retrying", () => {
      const m = createTurnMachine(
        { playerRole: "player1", submissionId: "sub-1", pendingStrokes: [{ id: "s1" }] },
        "submitting_turn",
      );
      const err = makeFlowError({ fatal: false, retryable: true });
      collectEffects(m, { type: "SUBMIT_SEND_FAILED", error: err });
      expect(m.currentStateId).toBe("submit_retrying");
    });

    it("fatal SUBMIT_SEND_FAILED → sync_error_fatal", () => {
      const m = createTurnMachine(
        { playerRole: "player1", submissionId: "sub-1", pendingStrokes: [{ id: "s1" }] },
        "submitting_turn",
      );
      const err = makeFlowError({ fatal: true, retryable: false });
      collectEffects(m, { type: "SUBMIT_SEND_FAILED", error: err });
      expect(m.currentStateId).toBe("sync_error_fatal");
    });
  });

  describe("submit_failed recovery", () => {
    it("USER_RETRY_SUBMIT → submitting_turn", () => {
      const m = createTurnMachine(
        { playerRole: "player1", submissionId: "sub-1", pendingStrokes: [{ id: "s1" }], retryCount: 3 },
        "submit_failed",
      );
      collectEffects(m, { type: "USER_RETRY_SUBMIT" });
      expect(m.currentStateId).toBe("submitting_turn");
      expect(m.model.retryCount).toBe(0);
    });

    it("SERVER_STATE_RESYNC → waiting_for_turn or drawing_turn", () => {
      const m = createTurnMachine(
        { playerRole: "player1", submissionId: "sub-1", pendingStrokes: [{ id: "s1" }] },
        "submit_failed",
      );
      collectEffects(m, { type: "SERVER_STATE_RESYNC", currentPlayer: "player2", currentRound: 2, totalRounds: 3 });
      expect(m.currentStateId).toBe("waiting_for_turn");
      expect(m.model.submissionId).toBeNull();
    });
  });

  describe("Test 9 — sync_error_fatal", () => {
    it("ERROR_RAISED(fatal=true) in awaiting_server_ack → sync_error_fatal; only NAVIGATE_HOME exits", () => {
      const m = createTurnMachine(
        { playerRole: "player1", currentPlayer: "player1", submissionId: "sub-1" },
        "awaiting_server_ack",
      );

      const fatalError = makeFlowError({ fatal: true, retryable: false, code: "SESSION_EXPIRED" });
      const result = collectEffects(m, { type: "ERROR_RAISED", error: fatalError });
      expect(m.currentStateId).toBe("sync_error_fatal");
      expect(m.model.lastError?.code).toBe("SESSION_EXPIRED");
      expect(result.effects.some((e) => e.type === "PAUSE_PLAYER_TIMER")).toBe(true);
      expect(result.effects.some((e) => e.type === "STOP_OPPONENT_COUNTDOWN")).toBe(true);
      expect(result.effects.some((e) => e.type === "CLEAR_SUBMIT_RETRY")).toBe(true);

      collectEffects(m, { type: "SERVER_GAME_STATE_ACK", currentPlayer: "player1", currentRound: 1, totalRounds: 3 });
      expect(m.currentStateId).toBe("sync_error_fatal");

      const navResult = collectEffects(m, { type: "NAVIGATE_HOME" });
      expect(m.currentStateId).toBe("sync_error_fatal");
      expect(navResult.effects.some((e) => e.type === "NAVIGATE_HOME")).toBe(true);
    });
  });

  describe("Test 10 — Leak tests", () => {
    it("leaving submit_retrying emits CLEAR_SUBMIT_RETRY", () => {
      const m = createTurnMachine(
        {
          playerRole: "player1",
          submissionId: "sub-1",
          pendingStrokes: [{ id: "s1" }],
          retryCount: 0,
        },
        "submit_retrying",
      );

      const result = collectEffects(m, { type: "RETRY_BUDGET_REMAINING" });
      expect(m.currentStateId).toBe("awaiting_server_ack");
      expect(result.effects.some((e) => e.type === "CLEAR_SUBMIT_RETRY")).toBe(true);
    });

    it("leaving submit_retrying via game_complete emits CLEAR_SUBMIT_RETRY", () => {
      const m = createTurnMachine(
        {
          playerRole: "player1",
          submissionId: "sub-1",
          pendingStrokes: [{ id: "s1" }],
          retryCount: 0,
        },
        "submit_retrying",
      );

      const result = collectEffects(m, { type: "SERVER_GAME_COMPLETED" });
      expect(m.currentStateId).toBe("game_complete");
      expect(result.effects.some((e) => e.type === "CLEAR_SUBMIT_RETRY")).toBe(true);
    });
  });

  describe("Test 11 — FIFO race test", () => {
    it("two events dispatched in same tick are processed in order via FIFO queue", () => {
      const m = createTurnMachine({ playerRole: "player1", currentPlayer: "player1" }, "drawing_turn");
      const transitions: string[] = [];
      m.subscribe((snapshot) => {
        transitions.push(snapshot.stateId);
      });

      m.dispatch({ type: "USER_SUBMIT", strokes: [{ id: "s1" }] });
      m.dispatch({ type: "SUBMIT_SEND_OK" });

      expect(transitions).toEqual(["submitting_turn", "awaiting_server_ack"]);
      expect(m.currentStateId).toBe("awaiting_server_ack");
    });
  });

  describe("Test 12 — Invalid event no-op", () => {
    it("unhandled events leave state and model unchanged", () => {
      const states = [
        "waiting_for_turn",
        "drawing_turn",
        "submitting_turn",
        "awaiting_server_ack",
        "game_complete",
        "opponent_disconnected",
        "submit_retrying",
        "submit_failed",
        "sync_error_fatal",
      ] as const;

      const irrelevantEvent = { type: "SUBMIT_SEND_OK" as const };

      for (const stateId of states) {
        if (stateId === "submitting_turn") continue;

        const m = createTurnMachine(
          { playerRole: "player1", submissionId: "sub-1", pendingStrokes: [{ id: "s1" }] },
          stateId,
        );
        const modelBefore = JSON.stringify(m.model);
        const stateBefore = m.currentStateId;

        m.dispatch(irrelevantEvent);

        expect(m.currentStateId).toBe(stateBefore);
        expect(JSON.stringify(m.model)).toBe(modelBefore);
      }
    });
  });
});
