import { describe, expect, it } from "vitest";
import {
  buildFriendList,
  describeNotice,
  friendsReducer,
  INITIAL_FRIENDS_STATE,
  socialServerMessageSchema,
  type FriendsState,
  type SocialServerMessage,
} from "@/lib/social/friendsState";

const NOW = 1_000_000;
const ALICE = "T:_alice";
const BOB = "T:_bob";

function apply(state: FriendsState, ...messages: SocialServerMessage[]): FriendsState {
  return messages.reduce((current, message) => friendsReducer(current, { type: "server", message, now: NOW }), state);
}

describe("friends state", () => {
  it("tracks the listed friends and live presence", () => {
    let state = apply(INITIAL_FRIENDS_STATE, {
      type: "friends_status",
      friends: [{ playerId: ALICE, status: "online" }, { playerId: BOB, status: "offline" }],
    });
    expect(state.loaded).toBe(true);
    state = apply(state, { type: "friend_presence", playerId: BOB, status: "in_game" });
    expect(state.statuses).toEqual({ [ALICE]: "online", [BOB]: "in_game" });
    state = apply(state, { type: "friend_removed", playerId: ALICE });
    expect(state.statuses).toEqual({ [BOB]: "in_game" });
  });

  it("follows an outgoing invite to acceptance", () => {
    let state = friendsReducer(INITIAL_FRIENDS_STATE, { type: "invite_requested", playerId: ALICE });
    expect(state.sending).toBe(ALICE);
    state = apply(state, { type: "invite_sent", inviteId: "i1", playerId: ALICE, expiresInMs: 30_000 });
    expect(state.outgoing).toEqual({ inviteId: "i1", playerId: ALICE, expiresAt: NOW + 30_000 });
    expect(state.sending).toBeNull();
    state = apply(state, { type: "invite_accepted", inviteId: "i1", roomCode: "ABC234" });
    expect(state.outgoing).toBeNull();
    expect(state.acceptedRoom).toEqual({ roomCode: "ABC234", playerId: ALICE });
    expect(friendsReducer(state, { type: "accepted_room_consumed" }).acceptedRoom).toBeNull();
  });

  it("tells the sender why an invite closed", () => {
    for (const [reason, text] of [
      ["declined", "Alice declined your invite."],
      ["expired", "Alice didn't answer in time."],
      ["unavailable", "Alice isn't available right now."],
    ] as const) {
      const state = apply(
        INITIAL_FRIENDS_STATE,
        { type: "invite_sent", inviteId: "i1", playerId: ALICE, expiresInMs: 30_000 },
        { type: "invite_closed", inviteId: "i1", reason },
      );
      expect(state.outgoing).toBeNull();
      expect(state.notice && describeNotice(state.notice, "Alice")).toBe(text);
    }
  });

  it("clears an incoming invite and explains expiry or cancellation, but not the player's own decline", () => {
    const received = apply(INITIAL_FRIENDS_STATE, { type: "invite_received", inviteId: "i2", playerId: BOB, expiresInMs: 30_000 });
    expect(received.incoming).toHaveLength(1);
    expect(apply(received, { type: "invite_received", inviteId: "i2", playerId: BOB, expiresInMs: 30_000 }).incoming).toHaveLength(1);

    const cancelled = apply(received, { type: "invite_closed", inviteId: "i2", reason: "cancelled" });
    expect(cancelled.incoming).toEqual([]);
    expect(cancelled.notice && describeNotice(cancelled.notice, "Bob")).toBe("Bob cancelled the invite.");

    const expired = apply(received, { type: "invite_closed", inviteId: "i2", reason: "expired" });
    expect(expired.notice && describeNotice(expired.notice, "Bob")).toBe("The invite from Bob expired.");

    for (const reason of ["declined", "answered_elsewhere"] as const) {
      const closed = apply(received, { type: "invite_closed", inviteId: "i2", reason });
      expect(closed.incoming).toEqual([]);
      expect(closed.notice).toBeNull();
    }
  });

  it("drops invites from a friend who becomes hidden", () => {
    const state = apply(
      INITIAL_FRIENDS_STATE,
      { type: "invite_received", inviteId: "i3", playerId: BOB, expiresInMs: 30_000 },
      { type: "friend_removed", playerId: BOB },
    );
    expect(state.incoming).toEqual([]);
  });

  it("reports a lost connection to a waiting sender", () => {
    const waiting = apply(INITIAL_FRIENDS_STATE, { type: "invite_sent", inviteId: "i4", playerId: ALICE, expiresInMs: 30_000 });
    const lost = friendsReducer(waiting, { type: "connection_lost" });
    expect(lost.outgoing).toBeNull();
    expect(lost.notice).toEqual({ kind: "invite_closed", role: "sender", playerId: ALICE, reason: "unavailable" });
  });

  it("surfaces invite errors and clears the pending send", () => {
    const state = apply(
      friendsReducer(INITIAL_FRIENDS_STATE, { type: "invite_requested", playerId: ALICE }),
      { type: "invite_error", code: "RATE_LIMITED", message: "Slow down." },
    );
    expect(state.sending).toBeNull();
    expect(state.notice).toEqual({ kind: "error", message: "Slow down." });
  });

  it("tracks the player's own visibility and settles a pending change", () => {
    let state = apply(INITIAL_FRIENDS_STATE, { type: "visibility_status", visibility: "visible" });
    expect(state.visibility).toBe("visible");
    state = friendsReducer(state, { type: "visibility_requested", visibility: "do_not_disturb" });
    expect(state.visibilitySaving).toBe("do_not_disturb");
    // Another device's earlier change arrives first: shown, but this device's choice stays pending.
    state = apply(state, { type: "visibility_status", visibility: "appear_offline" });
    expect(state).toMatchObject({ visibility: "appear_offline", visibilitySaving: "do_not_disturb" });
    state = apply(state, { type: "visibility_status", visibility: "do_not_disturb" });
    expect(state).toMatchObject({ visibility: "do_not_disturb", visibilitySaving: null });

    state = friendsReducer(state, { type: "visibility_requested", visibility: "visible" });
    state = apply(state, { type: "friends_error", code: "RATE_LIMITED", message: "Too often." });
    expect(state).toMatchObject({ visibility: "do_not_disturb", visibilitySaving: null });
    expect(state.notice).toEqual({ kind: "error", message: "Too often." });

    state = friendsReducer(state, { type: "visibility_requested", visibility: "visible" });
    state = friendsReducer(state, { type: "connection_lost" });
    expect(state).toMatchObject({ visibility: "do_not_disturb", visibilitySaving: null });
  });

  it("tells the sender politely when a friend has Do Not Disturb on", () => {
    let state = friendsReducer(INITIAL_FRIENDS_STATE, { type: "invite_requested", playerId: ALICE });
    state = apply(state, { type: "invite_error", code: "FRIEND_BUSY", message: "Busy." });
    expect(state.sending).toBeNull();
    expect(state.notice).toEqual({ kind: "invite_closed", role: "sender", playerId: ALICE, reason: "busy" });
    expect(describeNotice(state.notice!, "Alice")).toBe(
      "Alice has Do Not Disturb on, so they're not taking invites right now. Try again later.",
    );

    // A pending invite closed because the friend turned on Do Not Disturb reads the same way.
    state = friendsReducer(state, { type: "invite_requested", playerId: BOB });
    state = apply(
      state,
      { type: "invite_sent", inviteId: "i9", playerId: BOB, expiresInMs: 30_000 },
      { type: "invite_closed", inviteId: "i9", reason: "busy" },
    );
    expect(describeNotice(state.notice!, "Bob")).toMatch(/^Bob has Do Not Disturb on/);
  });

  it("remembers the friend from an invite match for a one-tap rematch", () => {
    let state = friendsReducer(INITIAL_FRIENDS_STATE, { type: "invite_requested", playerId: ALICE });
    state = apply(
      state,
      { type: "invite_sent", inviteId: "r1", playerId: ALICE, expiresInMs: 30_000 },
      { type: "invite_accepted", inviteId: "r1", roomCode: "ABC234" },
    );
    expect(state.rematchFriend).toBe(ALICE);
    // The friend who accepted an incoming invite is remembered too, and survives consuming the room.
    state = friendsReducer(state, { type: "accepted_room_consumed" });
    expect(state.rematchFriend).toBe(ALICE);
    state = apply(
      state,
      { type: "invite_received", inviteId: "r2", playerId: BOB, expiresInMs: 30_000 },
      { type: "invite_accepted", inviteId: "r2", roomCode: "XYZ234" },
    );
    expect(state.rematchFriend).toBe(BOB);
    // A block (friend removed) or a non-invite match forgets them.
    expect(apply(state, { type: "friend_removed", playerId: BOB }).rematchFriend).toBeNull();
    expect(friendsReducer(state, { type: "rematch_cleared" }).rematchFriend).toBeNull();
    expect(apply(state, { type: "friend_removed", playerId: ALICE }).rematchFriend).toBe(BOB);
  });

  it("ignores messages that do not match the schema", () => {
    expect(socialServerMessageSchema.safeParse({ type: "visibility_status", visibility: "hidden" }).success).toBe(false);
    expect(socialServerMessageSchema.safeParse({ type: "friend_presence", playerId: ALICE, status: "busy" }).success).toBe(true);
    expect(socialServerMessageSchema.safeParse({ type: "friend_presence", playerId: ALICE, status: "away" }).success).toBe(false);
    expect(socialServerMessageSchema.safeParse({ type: "match_found" }).success).toBe(false);
  });

  it("lists only friends the server knows, online first, with names from the device", () => {
    const list = buildFriendList(
      [
        { playerId: "T:_zed", displayName: "Zed" },
        { playerId: ALICE, displayName: "Alice" },
        { playerId: BOB, displayName: "Bob" },
        { playerId: "T:_dee", displayName: "Dee" },
        { playerId: "T:_no-app", displayName: "No App" },
      ],
      { [ALICE]: "offline", [BOB]: "in_game", "T:_zed": "online", "T:_dee": "busy" },
    );
    expect(list.map((friend) => [friend.displayName, friend.status])).toEqual([
      ["Zed", "online"],
      ["Bob", "in_game"],
      ["Dee", "busy"],
      ["Alice", "offline"],
    ]);
  });
});
