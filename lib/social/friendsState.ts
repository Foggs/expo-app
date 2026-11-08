import { z } from "zod";

/** "busy" is a friend with Do Not Disturb on. */
export type FriendPresenceStatus = "online" | "in_game" | "busy" | "offline";
export type InviteClosedReason = "declined" | "expired" | "cancelled" | "unavailable" | "answered_elsewhere" | "busy";

const presenceSchema = z.enum(["online", "in_game", "busy", "offline"]);
export const friendVisibilitySchema = z.enum(["visible", "appear_offline", "do_not_disturb"]);
/** How this player appears to their friends. */
export type FriendVisibility = z.infer<typeof friendVisibilitySchema>;

/** Messages the server sends on the friends connection. Anything else is ignored. */
export const socialServerMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("friends_status"),
    friends: z.array(z.object({ playerId: z.string(), status: presenceSchema })),
  }),
  z.object({ type: z.literal("friend_presence"), playerId: z.string(), status: presenceSchema }),
  z.object({ type: z.literal("friend_removed"), playerId: z.string() }),
  z.object({ type: z.literal("friends_error"), code: z.string(), message: z.string() }),
  z.object({ type: z.literal("invite_sent"), inviteId: z.string(), playerId: z.string(), expiresInMs: z.number() }),
  z.object({ type: z.literal("invite_received"), inviteId: z.string(), playerId: z.string(), expiresInMs: z.number() }),
  z.object({ type: z.literal("invite_accepted"), inviteId: z.string(), roomCode: z.string() }),
  z.object({
    type: z.literal("invite_closed"),
    inviteId: z.string(),
    reason: z.enum(["declined", "expired", "cancelled", "unavailable", "answered_elsewhere", "busy"]),
  }),
  z.object({ type: z.literal("invite_error"), code: z.string(), message: z.string() }),
  z.object({ type: z.literal("visibility_status"), visibility: friendVisibilitySchema }),
]);

export type SocialServerMessage = z.infer<typeof socialServerMessageSchema>;

export type Invite = { inviteId: string; playerId: string; expiresAt: number };

/** A short message about an invite or the friend list, shown to the player. */
export type FriendsNotice =
  | { kind: "invite_closed"; role: "sender" | "receiver"; playerId: string; reason: InviteClosedReason }
  | { kind: "error"; message: string };

export type FriendsState = {
  /** Status for each friend the server lists (has SketchDuel, lists this player or not, not blocked). */
  statuses: Record<string, FriendPresenceStatus>;
  /** True once the server has answered the current friend-list upload. */
  loaded: boolean;
  /** The friend an invite is being sent to, before the server confirms it. */
  sending: string | null;
  outgoing: Invite | null;
  incoming: Invite[];
  /** A match room both players should join, set when an invite is accepted. */
  acceptedRoom: { roomCode: string; playerId: string } | null;
  notice: FriendsNotice | null;
  /** This player's saved visibility, once the server has sent it. */
  visibility: FriendVisibility | null;
  /** A visibility change waiting for the server to confirm it. */
  visibilitySaving: FriendVisibility | null;
};

export const INITIAL_FRIENDS_STATE: FriendsState = {
  statuses: {},
  loaded: false,
  sending: null,
  outgoing: null,
  incoming: [],
  acceptedRoom: null,
  notice: null,
  visibility: null,
  visibilitySaving: null,
};

export type FriendsAction =
  | { type: "server"; message: SocialServerMessage; now: number }
  | { type: "invite_requested"; playerId: string }
  | { type: "visibility_requested"; visibility: FriendVisibility }
  | { type: "accepted_room_consumed" }
  | { type: "notice_cleared" }
  | { type: "connection_lost" }
  | { type: "reset" };

export function friendsReducer(state: FriendsState, action: FriendsAction): FriendsState {
  switch (action.type) {
    case "reset":
      return INITIAL_FRIENDS_STATE;
    case "invite_requested":
      return { ...state, sending: action.playerId, notice: null };
    case "visibility_requested":
      return { ...state, visibilitySaving: action.visibility, notice: null };
    case "accepted_room_consumed":
      return { ...state, acceptedRoom: null };
    case "notice_cleared":
      return { ...state, notice: null };
    case "connection_lost": {
      // The server drops invites with the connection; tell whoever was waiting.
      const notice: FriendsNotice | null = state.outgoing
        ? { kind: "invite_closed", role: "sender", playerId: state.outgoing.playerId, reason: "unavailable" }
        : state.sending
          ? { kind: "error", message: "Lost connection. The invite was not sent." }
          : state.notice;
      return { ...state, loaded: false, sending: null, outgoing: null, incoming: [], notice, visibilitySaving: null };
    }
    case "server":
      return applyServerMessage(state, action.message, action.now);
  }
}

function applyServerMessage(state: FriendsState, message: SocialServerMessage, now: number): FriendsState {
  switch (message.type) {
    case "friends_status":
      return {
        ...state,
        loaded: true,
        statuses: Object.fromEntries(message.friends.map((friend) => [friend.playerId, friend.status])),
      };
    case "friend_presence":
      return { ...state, statuses: { ...state.statuses, [message.playerId]: message.status } };
    case "friend_removed": {
      const statuses = { ...state.statuses };
      delete statuses[message.playerId];
      return {
        ...state,
        statuses,
        outgoing: state.outgoing?.playerId === message.playerId ? null : state.outgoing,
        incoming: state.incoming.filter((invite) => invite.playerId !== message.playerId),
      };
    }
    case "friends_error":
      return { ...state, visibilitySaving: null, notice: { kind: "error", message: message.message } };
    case "visibility_status":
      return {
        ...state,
        visibility: message.visibility,
        // Another device's change, or this one's confirmation, settles any pending choice.
        visibilitySaving: state.visibilitySaving === message.visibility ? null : state.visibilitySaving,
      };
    case "invite_sent":
      return {
        ...state,
        sending: null,
        outgoing: { inviteId: message.inviteId, playerId: message.playerId, expiresAt: now + message.expiresInMs },
      };
    case "invite_received":
      if (state.incoming.some((invite) => invite.inviteId === message.inviteId)) return state;
      return {
        ...state,
        incoming: [
          ...state.incoming,
          { inviteId: message.inviteId, playerId: message.playerId, expiresAt: now + message.expiresInMs },
        ],
      };
    case "invite_accepted": {
      const invite = state.outgoing?.inviteId === message.inviteId
        ? state.outgoing
        : state.incoming.find((candidate) => candidate.inviteId === message.inviteId);
      if (!invite) return state;
      return {
        ...state,
        outgoing: state.outgoing?.inviteId === message.inviteId ? null : state.outgoing,
        incoming: state.incoming.filter((candidate) => candidate.inviteId !== message.inviteId),
        acceptedRoom: { roomCode: message.roomCode, playerId: invite.playerId },
        notice: null,
      };
    }
    case "invite_closed": {
      if (state.outgoing?.inviteId === message.inviteId) {
        return {
          ...state,
          outgoing: null,
          notice: { kind: "invite_closed", role: "sender", playerId: state.outgoing.playerId, reason: message.reason },
        };
      }
      const invite = state.incoming.find((candidate) => candidate.inviteId === message.inviteId);
      if (!invite) return state;
      // A decline is the player's own choice and another device's answer needs no message.
      const silent = message.reason === "declined" || message.reason === "answered_elsewhere";
      return {
        ...state,
        incoming: state.incoming.filter((candidate) => candidate.inviteId !== message.inviteId),
        notice: silent
          ? state.notice
          : { kind: "invite_closed", role: "receiver", playerId: invite.playerId, reason: message.reason },
      };
    }
    case "invite_error":
      if (message.code === "FRIEND_BUSY" && state.sending) {
        return {
          ...state,
          sending: null,
          notice: { kind: "invite_closed", role: "sender", playerId: state.sending, reason: "busy" },
        };
      }
      return { ...state, sending: null, notice: { kind: "error", message: message.message } };
  }
}

/** The text shown for a notice. `name` is the friend's Game Center name from this device. */
export function describeNotice(notice: FriendsNotice, name: string): string {
  if (notice.kind === "error") return notice.message;
  if (notice.role === "sender") {
    switch (notice.reason) {
      case "declined":
        return `${name} declined your invite.`;
      case "expired":
        return `${name} didn't answer in time.`;
      case "cancelled":
        return "Invite cancelled.";
      case "busy":
        return `${name} has Do Not Disturb on, so they're not taking invites right now. Try again later.`;
      case "unavailable":
      case "answered_elsewhere":
        return `${name} isn't available right now.`;
    }
  }
  switch (notice.reason) {
    case "expired":
      return `The invite from ${name} expired.`;
    case "cancelled":
      return `${name} cancelled the invite.`;
    default:
      return `The invite from ${name} is no longer available.`;
  }
}

export type FriendListEntry = { playerId: string; displayName: string; status: FriendPresenceStatus };

const STATUS_ORDER: Record<FriendPresenceStatus, number> = { online: 0, in_game: 1, busy: 2, offline: 3 };

/**
 * Friends to show: Game Center friends from this device that the server
 * listed. Online first, then in a game, then busy, then offline; alphabetical within.
 */
export function buildFriendList(
  deviceFriends: { playerId: string; displayName: string }[],
  statuses: Record<string, FriendPresenceStatus>,
): FriendListEntry[] {
  const seen = new Set<string>();
  const entries: FriendListEntry[] = [];
  for (const friend of deviceFriends) {
    const status = statuses[friend.playerId];
    if (!status || seen.has(friend.playerId)) continue;
    seen.add(friend.playerId);
    entries.push({ ...friend, status });
  }
  return entries.sort((a, b) =>
    STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.displayName.localeCompare(b.displayName));
}
