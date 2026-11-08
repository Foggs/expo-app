import { randomBytes } from "crypto";
import type {
  FriendInviteClosedReason,
  FriendInviteErrorCode,
  FriendPresenceStatus,
  WsServerMessage,
} from "@shared/schema";
import type { FriendAccount, IStorage } from "./storage";

/**
 * Game Center friends: live presence and direct match invites.
 *
 * A player's friend list comes from their device (Game Center IDs only; names
 * stay on the device) and is held on the connection, in memory, for that
 * session only. Two players count as friends only when each one's uploaded
 * list includes the other. Blocked pairs never see each other.
 *
 * Accepting an invite reserves a private friend room for the two accounts;
 * both apps then join it with the existing room flow, which starts the match.
 */

export type FriendHubOptions = {
  /** How long an invite waits for an answer. Defaults to 30 s. */
  inviteTtlMs?: number;
  /** Invites one player may send per minute. Defaults to 5. */
  invitesPerMinute?: number;
  /** Friend-list uploads one connection may send per minute. Defaults to 6. */
  friendListUploadsPerMinute?: number;
};

const DEFAULT_INVITE_TTL_MS = 30_000;
const DEFAULT_INVITES_PER_MINUTE = 5;
const DEFAULT_FRIEND_UPLOADS_PER_MINUTE = 6;
const RATE_WINDOW_MS = 60_000;

/** The connection fields the friend hub reads and maintains. */
export interface SocialConnection {
  id: string;
  /** Account key once authenticated (the Game Center account key for linked players). */
  sessionKey: string;
  playerKeys: string[];
  authState: "none" | "pending" | "done";
  gameCenterPlayerId: string | null;
  gameId: string | null;
  /** Game Center IDs this session uploaded; null until it uploads a list. */
  friendIds: Set<string> | null;
  /** Unblocked friend accounts with SketchDuel, by Game Center ID. */
  visibleFriends: Map<string, Pick<FriendAccount, "playerKey" | "aliasKeys">>;
  /** The status last sent for each visible friend, so unchanged statuses are not resent. */
  sentStatus: Map<string, FriendPresenceStatus>;
  friendListVersion: number;
  friendUploadTimes: number[];
}

type Invite = {
  id: string;
  fromConnId: string;
  fromKey: string;
  fromKeys: string[];
  fromGameCenterId: string;
  toKey: string;
  toKeys: string[];
  toGameCenterId: string;
  timer: ReturnType<typeof setTimeout>;
};

export type FriendHubDeps = {
  connections(): Iterable<SocialConnection>;
  isOpen(conn: SocialConnection): boolean;
  send(conn: SocialConnection, message: WsServerMessage): void;
  /** Reserves a private room only these two accounts can join. Returns its code, or null. */
  createInviteRoom(firstPlayerKey: string, secondPlayerKey: string): string | null;
  storage: Pick<IStorage, "findFriendAccounts" | "findBlockedPlayerKeys" | "arePlayersBlocked">;
};

export type FriendHub = ReturnType<typeof createFriendHub>;

export function createFriendHub(deps: FriendHubDeps, options: FriendHubOptions = {}) {
  const inviteTtlMs = options.inviteTtlMs ?? DEFAULT_INVITE_TTL_MS;
  const invitesPerMinute = options.invitesPerMinute ?? DEFAULT_INVITES_PER_MINUTE;
  const uploadsPerMinute = options.friendListUploadsPerMinute ?? DEFAULT_FRIEND_UPLOADS_PER_MINUTE;

  const invites = new Map<string, Invite>();
  const inviteTimesByAccount = new Map<string, number[]>();

  function withinLimit(times: number[], limit: number): boolean {
    const now = Date.now();
    while (times.length > 0 && now - times[0] >= RATE_WINDOW_MS) times.shift();
    if (times.length >= limit) return false;
    times.push(now);
    return true;
  }

  function isLive(conn: SocialConnection): boolean {
    return conn.authState === "done" && deps.isOpen(conn);
  }

  function socialConnectionsOf(accountKey: string): SocialConnection[] {
    const result: SocialConnection[] = [];
    for (const conn of deps.connections()) {
      if (conn.friendIds && conn.sessionKey === accountKey && isLive(conn)) result.push(conn);
    }
    return result;
  }

  function isInGame(accountKey: string): boolean {
    for (const conn of deps.connections()) {
      if (conn.gameId && conn.sessionKey === accountKey && isLive(conn)) return true;
    }
    return false;
  }

  /** Whether the account's own uploaded list (on any of its open sessions) includes this Game Center ID. */
  function listsFriend(accountKey: string, gameCenterId: string): boolean {
    return socialConnectionsOf(accountKey).some((conn) => conn.friendIds?.has(gameCenterId));
  }

  /**
   * The friend's status as this viewer may see it. The viewer's own list
   * includes the friend (they are in visibleFriends); the friend is shown as
   * active only if their list includes the viewer too.
   */
  function statusFor(viewer: SocialConnection, friendKey: string): FriendPresenceStatus {
    if (!viewer.gameCenterPlayerId || !listsFriend(friendKey, viewer.gameCenterPlayerId)) return "offline";
    return isInGame(friendKey) ? "in_game" : "online";
  }

  function sendToAll(conns: SocialConnection[], message: WsServerMessage): void {
    for (const conn of conns) deps.send(conn, message);
  }

  /** Pushes this account's status to every friend session that can see it and has a stale value. */
  function refreshPresence(accountKey: string): void {
    if (!accountKey) return;
    for (const viewer of deps.connections()) {
      if (!viewer.friendIds || viewer.sessionKey === accountKey || !isLive(viewer)) continue;
      for (const [gameCenterId, friend] of viewer.visibleFriends) {
        if (friend.playerKey !== accountKey) continue;
        const status = statusFor(viewer, accountKey);
        if (viewer.sentStatus.get(gameCenterId) === status) continue;
        viewer.sentStatus.set(gameCenterId, status);
        deps.send(viewer, { type: "friend_presence", playerId: gameCenterId, status });
      }
    }
  }

  function closeInvite(invite: Invite, reasonForSender: FriendInviteClosedReason, reasonForReceiver = reasonForSender): void {
    if (invites.get(invite.id) !== invite) return;
    invites.delete(invite.id);
    clearTimeout(invite.timer);
    const sender = findConnection(invite.fromConnId);
    if (sender) deps.send(sender, { type: "invite_closed", inviteId: invite.id, reason: reasonForSender });
    sendToAll(socialConnectionsOf(invite.toKey), { type: "invite_closed", inviteId: invite.id, reason: reasonForReceiver });
  }

  function findConnection(connId: string): SocialConnection | null {
    for (const conn of deps.connections()) {
      if (conn.id === connId && isLive(conn)) return conn;
    }
    return null;
  }

  /** Closes invites that can no longer be answered because a player is busy or gone. */
  function closeUnavailableInvites(): void {
    for (const invite of Array.from(invites.values())) {
      const senderGone = !findConnection(invite.fromConnId);
      const receiverGone = socialConnectionsOf(invite.toKey).length === 0;
      if (senderGone || receiverGone || isInGame(invite.fromKey) || isInGame(invite.toKey)) {
        closeInvite(invite, "unavailable");
      }
    }
  }

  function inviteError(conn: SocialConnection, code: FriendInviteErrorCode, message: string): void {
    deps.send(conn, { type: "invite_error", code, message });
  }

  async function setFriends(conn: SocialConnection, friendIds: string[]): Promise<void> {
    if (!conn.gameCenterPlayerId) {
      deps.send(conn, { type: "friends_error", code: "NOT_LINKED", message: "Sign in to Game Center to see your friends." });
      return;
    }
    if (!withinLimit(conn.friendUploadTimes, uploadsPerMinute)) {
      deps.send(conn, { type: "friends_error", code: "RATE_LIMITED", message: "Friends are refreshing too often. Try again in a minute." });
      return;
    }

    const ids = Array.from(new Set(friendIds)).filter((id) => id !== conn.gameCenterPlayerId);
    const version = ++conn.friendListVersion;
    conn.friendIds = new Set(ids);

    let visible: FriendAccount[];
    try {
      const accounts = (await deps.storage.findFriendAccounts(ids))
        .filter((account) => account.playerKey !== conn.sessionKey);
      const blocked = await deps.storage.findBlockedPlayerKeys(conn.playerKeys, accounts);
      visible = accounts.filter((account) => !blocked.has(account.playerKey));
    } catch (error) {
      console.error("Could not load friend accounts:", error instanceof Error ? error.message : error);
      if (conn.friendListVersion === version) {
        deps.send(conn, { type: "friends_error", code: "FAILED", message: "Friends could not be loaded. Try again." });
      }
      return;
    }
    if (conn.friendListVersion !== version || !isLive(conn)) return;

    conn.visibleFriends = new Map(visible.map((account) => [
      account.gameCenterPlayerId,
      { playerKey: account.playerKey, aliasKeys: account.aliasKeys },
    ]));
    conn.sentStatus = new Map();
    const friends = visible.map((account) => {
      const status = statusFor(conn, account.playerKey);
      conn.sentStatus.set(account.gameCenterPlayerId, status);
      return { playerId: account.gameCenterPlayerId, status };
    });
    deps.send(conn, { type: "friends_status", friends });

    // Friends whose sessions list this player but loaded their lists before
    // this account existed (or was visible) learn about it now. Blocks were
    // checked above and apply in both directions.
    const self = { playerKey: conn.sessionKey, aliasKeys: conn.playerKeys };
    for (const account of visible) {
      for (const friendConn of socialConnectionsOf(account.playerKey)) {
        if (friendConn.friendIds?.has(conn.gameCenterPlayerId) && !friendConn.visibleFriends.has(conn.gameCenterPlayerId)) {
          friendConn.visibleFriends.set(conn.gameCenterPlayerId, self);
        }
      }
    }
    refreshPresence(conn.sessionKey);
  }

  async function inviteFriend(conn: SocialConnection, friendGameCenterId: string): Promise<void> {
    if (!conn.gameCenterPlayerId || !conn.friendIds) {
      inviteError(conn, "NOT_LINKED", "Load your Game Center friends before inviting.");
      return;
    }
    const times = inviteTimesByAccount.get(conn.sessionKey) ?? [];
    inviteTimesByAccount.set(conn.sessionKey, times);
    if (!withinLimit(times, invitesPerMinute)) {
      inviteError(conn, "RATE_LIMITED", "You're sending invites too quickly. Wait a moment and try again.");
      return;
    }
    for (const invite of invites.values()) {
      if (invite.fromKey === conn.sessionKey) {
        inviteError(conn, "ALREADY_INVITING", "You already have an invite waiting for an answer.");
        return;
      }
    }
    if (isInGame(conn.sessionKey)) {
      inviteError(conn, "IN_GAME", "Finish your current game before inviting a friend.");
      return;
    }
    const friend = conn.visibleFriends.get(friendGameCenterId);
    const busy = friend && Array.from(invites.values()).some((invite) =>
      invite.toKey === friend.playerKey || invite.fromKey === friend.playerKey);
    if (!friend || busy || statusFor(conn, friend.playerKey) !== "online") {
      inviteError(conn, "FRIEND_UNAVAILABLE", "This friend can't take an invite right now.");
      return;
    }

    const invite: Invite = {
      id: randomBytes(16).toString("hex"),
      fromConnId: conn.id,
      fromKey: conn.sessionKey,
      fromKeys: conn.playerKeys,
      fromGameCenterId: conn.gameCenterPlayerId,
      toKey: friend.playerKey,
      toKeys: friend.aliasKeys,
      toGameCenterId: friendGameCenterId,
      timer: setTimeout(() => closeInvite(invite, "expired"), inviteTtlMs),
    };
    (invite.timer as unknown as { unref?: () => void }).unref?.();
    // Registered before the block check so a second invite cannot slip in meanwhile.
    invites.set(invite.id, invite);

    let blocked: boolean;
    try {
      blocked = await deps.storage.arePlayersBlocked(invite.fromKeys, invite.toKeys);
    } catch (error) {
      console.error("Could not check blocks for an invite:", error instanceof Error ? error.message : error);
      blocked = true;
    }
    if (invites.get(invite.id) !== invite) return;
    if (blocked) {
      invites.delete(invite.id);
      clearTimeout(invite.timer);
      inviteError(conn, "FRIEND_UNAVAILABLE", "This friend can't take an invite right now.");
      return;
    }

    deps.send(conn, { type: "invite_sent", inviteId: invite.id, playerId: friendGameCenterId, expiresInMs: inviteTtlMs });
    sendToAll(socialConnectionsOf(invite.toKey), {
      type: "invite_received",
      inviteId: invite.id,
      playerId: invite.fromGameCenterId,
      expiresInMs: inviteTtlMs,
    });
  }

  async function respondToInvite(conn: SocialConnection, inviteId: string, accept: boolean): Promise<void> {
    const invite = invites.get(inviteId);
    if (!invite || invite.toKey !== conn.sessionKey || !conn.friendIds) {
      inviteError(conn, "INVITE_NOT_FOUND", "This invite is no longer available.");
      return;
    }
    // Removed synchronously: of two simultaneous answers, only the first gets here.
    invites.delete(invite.id);
    clearTimeout(invite.timer);
    for (const other of socialConnectionsOf(invite.toKey)) {
      if (other.id !== conn.id) {
        deps.send(other, { type: "invite_closed", inviteId: invite.id, reason: "answered_elsewhere" });
      }
    }
    const sender = findConnection(invite.fromConnId);

    const close = (reason: FriendInviteClosedReason) => {
      if (sender) deps.send(sender, { type: "invite_closed", inviteId: invite.id, reason });
      deps.send(conn, { type: "invite_closed", inviteId: invite.id, reason });
    };

    if (!accept) {
      close("declined");
      return;
    }
    if (!sender || isInGame(invite.fromKey) || isInGame(invite.toKey)) {
      close("unavailable");
      return;
    }
    let blocked: boolean;
    try {
      blocked = await deps.storage.arePlayersBlocked(invite.fromKeys, invite.toKeys);
    } catch (error) {
      console.error("Could not check blocks for an invite:", error instanceof Error ? error.message : error);
      blocked = true;
    }
    const roomCode = blocked ? null : deps.createInviteRoom(invite.fromKey, invite.toKey);
    if (!roomCode || !isLive(sender) || !isLive(conn)) {
      close("unavailable");
      return;
    }
    const accepted: WsServerMessage = { type: "invite_accepted", inviteId: invite.id, roomCode };
    deps.send(sender, accepted);
    deps.send(conn, accepted);
  }

  function cancelInvite(conn: SocialConnection, inviteId: string): void {
    const invite = invites.get(inviteId);
    if (!invite || invite.fromConnId !== conn.id) {
      inviteError(conn, "INVITE_NOT_FOUND", "This invite is no longer available.");
      return;
    }
    closeInvite(invite, "cancelled");
  }

  /** Hides each player from the other's friend list and closes invites between them. */
  function applyBlock(firstKeys: string[], secondKeys: string[]): void {
    const hide = (viewerKeys: string[], hiddenKeys: string[]) => {
      for (const viewer of deps.connections()) {
        if (!viewer.friendIds || !viewerKeys.includes(viewer.sessionKey)) continue;
        for (const [gameCenterId, friend] of Array.from(viewer.visibleFriends)) {
          if (!friend.aliasKeys.some((key) => hiddenKeys.includes(key))) continue;
          viewer.visibleFriends.delete(gameCenterId);
          viewer.sentStatus.delete(gameCenterId);
          deps.send(viewer, { type: "friend_removed", playerId: gameCenterId });
        }
      }
    };
    hide(firstKeys, secondKeys);
    hide(secondKeys, firstKeys);
    for (const invite of Array.from(invites.values())) {
      const between =
        (firstKeys.includes(invite.fromKey) && secondKeys.includes(invite.toKey)) ||
        (secondKeys.includes(invite.fromKey) && firstKeys.includes(invite.toKey));
      if (between) closeInvite(invite, "unavailable");
    }
  }

  /** Call after a connection closes or a player's game starts or ends. */
  function playersChanged(accountKeys: string[]): void {
    closeUnavailableInvites();
    for (const key of new Set(accountKeys)) refreshPresence(key);
  }

  function closeAll(): void {
    for (const invite of invites.values()) clearTimeout(invite.timer);
    invites.clear();
    inviteTimesByAccount.clear();
  }

  return {
    setFriends,
    inviteFriend,
    respondToInvite,
    cancelInvite,
    applyBlock,
    playersChanged,
    closeAll,
  };
}

/** Initial friend fields for a new connection. */
export function initialSocialState(): Pick<
  SocialConnection,
  "gameCenterPlayerId" | "friendIds" | "visibleFriends" | "sentStatus" | "friendListVersion" | "friendUploadTimes"
> {
  return {
    gameCenterPlayerId: null,
    friendIds: null,
    visibleFriends: new Map(),
    sentStatus: new Map(),
    friendListVersion: 0,
    friendUploadTimes: [],
  };
}
