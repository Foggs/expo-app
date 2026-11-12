import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { AppState, Linking, Platform } from "react-native";
import { usePlayerIdentity } from "@/contexts/PlayerIdentityContext";
import { resolveNativeWsUrl } from "@/lib/network/endpoints";
import { getSessionToken } from "@/lib/sessionToken";
import {
  buildFriendList,
  friendsReducer,
  INITIAL_FRIENDS_STATE,
  socialServerMessageSchema,
  type FriendListEntry,
  type FriendsState,
  type FriendVisibility,
} from "@/lib/social/friendsState";
import { resolveFriendsAvailability, type FriendsAvailability } from "@/lib/social/friendsAvailability";
import {
  getGameCenterFriendsAccess,
  loadGameCenterFriends,
  type GameCenterFriend,
  type GameCenterFriendsAccess,
} from "@/modules/game-center";

export type { FriendsAvailability };

type SocialContextValue = FriendsState & {
  availability: FriendsAvailability;
  connected: boolean;
  friends: FriendListEntry[];
  /** The friend's Game Center name from this device. */
  nameFor(playerId: string): string;
  /** Loads friends; with `prompt`, asks for friend-list permission if the player has not decided. */
  refreshFriends(options: { prompt: boolean }): Promise<void>;
  inviteFriend(playerId: string): boolean;
  cancelInvite(): void;
  /** Changes how friends see this player, on every device. */
  setVisibility(visibility: FriendVisibility): void;
  respondToInvite(inviteId: string, accept: boolean): void;
  consumeAcceptedRoom(): void;
  clearNotice(): void;
  /** Forget the friend offered for a rematch (the next match was not an invite match). */
  clearRematchFriend(): void;
  openSettings(): void;
};

const SocialContext = createContext<SocialContextValue | null>(null);

const RECONNECT_DELAYS_MS = [1_000, 3_000, 10_000, 30_000];

function getSocialWsUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) throw new Error("EXPO_PUBLIC_DOMAIN not set");
  return resolveNativeWsUrl(domain);
}

/**
 * Game Center friends with live status, and direct invites. iOS only.
 *
 * While the app is active and signed in to Game Center with friend-list
 * access, a separate connection keeps this player "online" to friends who
 * list them back. Only Game Center player IDs are uploaded; names stay here.
 */
export function SocialProvider({ children }: { children: React.ReactNode }) {
  const identity = usePlayerIdentity();
  const supported = Platform.OS === "ios";
  const signedIn = identity.status === "linked";

  const [state, dispatch] = useReducer(friendsReducer, INITIAL_FRIENDS_STATE);
  const [access, setAccess] = useState<GameCenterFriendsAccess | "checking">("checking");
  const [deviceFriends, setDeviceFriends] = useState<GameCenterFriend[]>([]);
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  const [connected, setConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const friendIdsRef = useRef<string[]>([]);

  const availability = resolveFriendsAvailability({ supported, identityStatus: identity.status, access });

  const refreshFriends = useCallback(async ({ prompt }: { prompt: boolean }) => {
    if (!supported || !signedIn) return;
    try {
      const current = prompt ? null : await getGameCenterFriendsAccess();
      if (current !== null && current !== "authorized") {
        setAccess(current);
        return;
      }
      const result = await loadGameCenterFriends();
      setAccess(result.access);
      setDeviceFriends(result.friends);
    } catch (error) {
      console.warn("[Friends] Could not load Game Center friends:", error instanceof Error ? error.message : error);
      setAccess("unavailable");
    }
  }, [supported, signedIn]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => setAppActive(next === "active"));
    return () => subscription.remove();
  }, []);

  // Re-read friends on launch, sign-in and each return to the foreground
  // (the player may have changed the permission in Settings).
  useEffect(() => {
    if (!signedIn) {
      setAccess("checking");
      setDeviceFriends([]);
      return;
    }
    if (appActive) void refreshFriends({ prompt: false });
  }, [signedIn, appActive, refreshFriends]);

  const friendIds = useMemo(
    () => Array.from(new Set(deviceFriends.map((friend) => friend.playerId))).sort(),
    [deviceFriends],
  );
  friendIdsRef.current = friendIds;

  const send = useCallback((message: Record<string, unknown>): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    try {
      ws.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  }, []);

  const shouldConnect = supported && signedIn && access === "authorized" && appActive;

  // One connection per identity: a new token generation (the player signed
  // out or changed) closes it and opens a fresh one.
  useEffect(() => {
    if (!shouldConnect) return;
    let cancelled = false;
    let attempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const open = async () => {
      let token: string;
      try {
        token = await getSessionToken();
      } catch {
        scheduleReconnect();
        return;
      }
      if (cancelled) return;
      let ws: WebSocket;
      try {
        ws = new WebSocket(getSocialWsUrl());
      } catch {
        scheduleReconnect();
        return;
      }
      wsRef.current = ws;
      ws.onopen = () => {
        if (cancelled) return;
        attempt = 0;
        ws.send(JSON.stringify({ type: "authenticate", sessionToken: token }));
        ws.send(JSON.stringify({ type: "set_friends", friendIds: friendIdsRef.current }));
        setConnected(true);
      };
      ws.onmessage = (event: MessageEvent) => {
        if (cancelled || typeof event.data !== "string") return;
        let parsed: unknown;
        try {
          parsed = JSON.parse(event.data);
        } catch {
          return;
        }
        const result = socialServerMessageSchema.safeParse(parsed);
        if (result.success) dispatch({ type: "server", message: result.data, now: Date.now() });
      };
      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        if (cancelled) return;
        setConnected(false);
        dispatch({ type: "connection_lost" });
        scheduleReconnect();
      };
    };

    const scheduleReconnect = () => {
      if (cancelled) return;
      const delay = RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)];
      attempt += 1;
      reconnectTimer = setTimeout(() => void open(), delay);
    };

    void open();
    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      setConnected(false);
      dispatch({ type: "reset" });
    };
  }, [shouldConnect, identity.tokenGeneration]);

  // Upload a changed friend list on the open connection.
  const uploadedIdsRef = useRef<string | null>(null);
  useEffect(() => {
    if (!connected) {
      uploadedIdsRef.current = null;
      return;
    }
    const key = friendIds.join("\n");
    if (uploadedIdsRef.current === null) {
      // The connection sent this list when it opened.
      uploadedIdsRef.current = key;
      return;
    }
    if (uploadedIdsRef.current === key) return;
    uploadedIdsRef.current = key;
    send({ type: "set_friends", friendIds });
  }, [connected, friendIds, send]);

  const inviteFriend = useCallback((playerId: string): boolean => {
    if (state.outgoing || state.sending) return false;
    const sent = send({ type: "invite_friend", playerId });
    if (sent) dispatch({ type: "invite_requested", playerId });
    return sent;
  }, [send, state.outgoing, state.sending]);

  const cancelInvite = useCallback(() => {
    if (state.outgoing) send({ type: "cancel_invite", inviteId: state.outgoing.inviteId });
  }, [send, state.outgoing]);

  const setVisibility = useCallback((visibility: FriendVisibility) => {
    if (visibility === (state.visibilitySaving ?? state.visibility)) return;
    if (send({ type: "set_visibility", visibility })) {
      dispatch({ type: "visibility_requested", visibility });
    }
  }, [send, state.visibility, state.visibilitySaving]);

  const respondToInvite = useCallback((inviteId: string, accept: boolean) => {
    if (!send({ type: "respond_invite", inviteId, accept })) {
      dispatch({ type: "connection_lost" });
    }
  }, [send]);

  const nameFor = useCallback((playerId: string) => (
    deviceFriends.find((friend) => friend.playerId === playerId)?.displayName ?? "Your friend"
  ), [deviceFriends]);

  const friends = useMemo(() => buildFriendList(deviceFriends, state.statuses), [deviceFriends, state.statuses]);

  const value = useMemo<SocialContextValue>(() => ({
    ...state,
    availability,
    connected,
    friends,
    nameFor,
    refreshFriends,
    inviteFriend,
    cancelInvite,
    setVisibility,
    respondToInvite,
    consumeAcceptedRoom: () => dispatch({ type: "accepted_room_consumed" }),
    clearNotice: () => dispatch({ type: "notice_cleared" }),
    clearRematchFriend: () => dispatch({ type: "rematch_cleared" }),
    openSettings: () => void Linking.openSettings().catch(() => undefined),
  }), [state, availability, connected, friends, nameFor, refreshFriends, inviteFriend, cancelInvite, setVisibility, respondToInvite]);

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

export function useSocial(): SocialContextValue {
  const value = useContext(SocialContext);
  if (!value) throw new Error("useSocial must be used inside SocialProvider");
  return value;
}
