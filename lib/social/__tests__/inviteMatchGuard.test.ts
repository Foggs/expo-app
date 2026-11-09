import { describe, expect, it } from "vitest";
import {
  INVITE_MATCH_CONNECTION_MESSAGE,
  INVITE_MATCH_TIMEOUT_MESSAGE,
  INVITE_MATCH_TIMEOUT_MS,
  inviteMatchFailure,
} from "@/lib/social/inviteMatchGuard";

describe("invite match guard", () => {
  it("keeps waiting while the join is progressing", () => {
    for (const flowState of ["idle", "connecting", "playing"]) {
      expect(inviteMatchFailure({ flowState, roomError: null, elapsedMs: 1_000 })).toBeNull();
    }
  });

  it("stops waiting when the friend never arrives", () => {
    expect(inviteMatchFailure({ flowState: "idle", roomError: null, elapsedMs: INVITE_MATCH_TIMEOUT_MS - 1 })).toBeNull();
    expect(inviteMatchFailure({ flowState: "idle", roomError: null, elapsedMs: INVITE_MATCH_TIMEOUT_MS }))
      .toBe(INVITE_MATCH_TIMEOUT_MESSAGE);
  });

  it("stops waiting when the connection fails", () => {
    for (const flowState of ["error_recoverable", "error_backoff", "error_fatal"]) {
      expect(inviteMatchFailure({ flowState, roomError: null, elapsedMs: 0 })).toBe(INVITE_MATCH_CONNECTION_MESSAGE);
    }
  });

  it("defers to a message the server already gave", () => {
    expect(inviteMatchFailure({ flowState: "error_fatal", roomError: "Room not found.", elapsedMs: 99_999 })).toBeNull();
  });
});
