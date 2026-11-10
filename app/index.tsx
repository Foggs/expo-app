import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import { Platform, StyleSheet, View } from "react-native";
import { ROOM_CODE_LENGTH } from "@shared/friendRoom";
import {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FriendsMatchModal from "@/components/FriendsMatchModal";
import HomeHero from "@/components/HomeHero";
import HomePrimaryActions from "@/components/HomePrimaryActions";
import InviteMatchModal from "@/components/InviteMatchModal";
import { INVITE_MATCH_TIMEOUT_MS, inviteMatchFailure } from "@/lib/social/inviteMatchGuard";
import MatchmakingModal from "@/components/MatchmakingModal";
import { usePlayerIdentity } from "@/contexts/PlayerIdentityContext";
import { useSocial } from "@/contexts/SocialContext";
import { useGameWebSocket } from "@/contexts/WebSocketContext";
import { useScreenPadding } from "@/hooks/useScreenPadding";
import { useThemeColors } from "@/hooks/useThemeColors";
import { impactLight, impactMedium, notifySuccess } from "@/lib/platformFeedback";
import {
  parseFriendInviteCode,
  parseFriendInviteUrl,
} from "@/lib/friendInvite";

export default function HomeScreen() {
  const { inviteCode, useRoomCode } = useLocalSearchParams<{ inviteCode?: string; useRoomCode?: string }>();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useThemeColors();
  const { topPadding, bottomPadding } = useScreenPadding(insets);

  const buttonScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.4);
  const searchPulse = useSharedValue(0.6);
  const navigatedRef = useRef(false);
  const [isFriendsModalOpen, setIsFriendsModalOpen] = useState(false);
  const [friendRoomInput, setFriendRoomInput] = useState("");
  const playerIdentity = usePlayerIdentity();
  const { acceptedRoom, consumeAcceptedRoom, clearRematchFriend, nameFor } = useSocial();
  /** Set while joining the room reserved by an accepted friend invite. */
  const [inviteMatch, setInviteMatch] = useState<{ friendName: string } | null>(null);
  /** Why joining the invited match stopped, when the server gave no reason. */
  const inviteMatchActiveRef = useRef(false);
  const [inviteMatchFailureMessage, setInviteMatchFailureMessage] = useState<string | null>(null);

  const {
    setCallbacks,
    matchStatus,
    flowState,
    retryDelayMs,
    connect,
    disconnect,
    lastError,
    queuePosition,
    friendRoomStatus,
    friendRoomCode,
    friendRoomError,
    createFriendRoom,
    joinFriendRoom,
    leaveFriendRoom,
    clearFriendRoomError,
    requestGameState,
  } = useGameWebSocket();

  const isSearching = matchStatus === "queueing" || matchStatus === "matched";
  const isFriendFlowActive = friendRoomStatus !== "idle";
  const showFriendsModal = (isFriendsModalOpen || isFriendFlowActive) && !inviteMatch;

  // Registered whenever home is in front; the game screen registers its own
  // while it is open and clears them when it closes.
  useEffect(() => {
    if (!isFocused) return;
    setCallbacks({
      onMatchFound: (info) => {
        if (navigatedRef.current) return;
        navigatedRef.current = true;
        // Only a match started from an invite can be rematched with one tap.
        if (!inviteMatchActiveRef.current) clearRematchFriend();
        inviteMatchActiveRef.current = false;
        setInviteMatch(null);
        setIsFriendsModalOpen(false);
        setFriendRoomInput("");
        if (info.matchType === "friend") {
          requestGameState();
        }
        notifySuccess();
        router.push({
          pathname: "/game",
          params: {
            gameId: info.gameId,
            playerRole: info.playerRole,
            opponentName: info.opponentName,
            opponentPlayerId: info.opponentPlayerId,
          },
        });
      },
      onError: (message) => {
        console.warn("WebSocket error:", message);
      },
    });
  }, [isFocused, requestGameState, setCallbacks, clearRematchFriend]);

  useEffect(() => () => setCallbacks({}), [setCallbacks]);

  // A friend invite was accepted (here or by the friend): join the reserved room.
  useEffect(() => {
    if (!isFocused || !acceptedRoom) return;
    consumeAcceptedRoom();
    navigatedRef.current = false;
    setIsFriendsModalOpen(false);
    setFriendRoomInput("");
    clearFriendRoomError();
    setInviteMatchFailureMessage(null);
    inviteMatchActiveRef.current = true;
    setInviteMatch({ friendName: nameFor(acceptedRoom.playerId) });
    joinFriendRoom(acceptedRoom.roomCode);
  }, [isFocused, acceptedRoom, consumeAcceptedRoom, clearFriendRoomError, joinFriendRoom, nameFor]);

  // Never leave "Starting match" up forever: stop on a failed connection or
  // when the friend does not arrive in time.
  useEffect(() => {
    if (!inviteMatch || inviteMatchFailureMessage || friendRoomError) return;
    const startedAt = Date.now();
    const fail = () => {
      const message = inviteMatchFailure({
        flowState,
        roomError: null,
        elapsedMs: Date.now() - startedAt >= INVITE_MATCH_TIMEOUT_MS ? INVITE_MATCH_TIMEOUT_MS : 0,
      });
      if (!message) return;
      leaveFriendRoom();
      setInviteMatchFailureMessage(message);
    };
    if (inviteMatchFailure({ flowState, roomError: null, elapsedMs: 0 })) {
      fail();
      return;
    }
    const timer = setTimeout(fail, INVITE_MATCH_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [inviteMatch, inviteMatchFailureMessage, friendRoomError, flowState, leaveFriendRoom]);

  const handleCancelInviteMatch = useCallback(() => {
    impactLight();
    setInviteMatchFailureMessage(null);
    leaveFriendRoom();
    clearFriendRoomError();
    inviteMatchActiveRef.current = false;
    setInviteMatch(null);
  }, [leaveFriendRoom, clearFriendRoomError]);

  const isErrorState =
    flowState === "error_recoverable" ||
    flowState === "error_backoff" ||
    flowState === "error_fatal";
  const showSearchModal = isSearching || isErrorState;

  const [backoffCountdown, setBackoffCountdown] = useState(0);

  useEffect(() => {
    if (flowState === "error_backoff" && retryDelayMs > 0) {
      setBackoffCountdown(Math.ceil(retryDelayMs / 1000));
      const interval = setInterval(() => {
        setBackoffCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }

    setBackoffCountdown(0);
  }, [flowState, retryDelayMs]);

  useEffect(() => {
    pulseOpacity.value = withRepeat(
      withSequence(withTiming(0.8, { duration: 1500 }), withTiming(0.4, { duration: 1500 })),
      -1,
      true
    );
  }, [pulseOpacity]);

  useEffect(() => {
    if (isSearching) {
      searchPulse.value = withRepeat(
        withSequence(withTiming(1, { duration: 1000 }), withTiming(0.6, { duration: 1000 })),
        -1,
        true
      );
    }
  }, [isSearching, searchPulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const searchPulseStyle = useAnimatedStyle(() => ({
    opacity: searchPulse.value,
  }));

  const handlePressIn = () => {
    buttonScale.value = withSpring(0.95);
  };

  const handlePressOut = () => {
    buttonScale.value = withSpring(1);
  };

  const handleFindMatch = useCallback(() => {
    impactMedium();
    navigatedRef.current = false;
    setIsFriendsModalOpen(false);
    setFriendRoomInput("");
    clearFriendRoomError();
    connect();
  }, [clearFriendRoomError, connect]);

  const handleCancelSearch = useCallback(() => {
    impactLight();
    disconnect();
  }, [disconnect]);

  const handleOpenFriends = useCallback(() => {
    impactLight();
    if (isSearching || isErrorState) {
      disconnect();
    }
    clearFriendRoomError();
    setIsFriendsModalOpen(true);
  }, [isSearching, isErrorState, disconnect, clearFriendRoomError]);

  const handleCreateFriendRoom = useCallback(() => {
    impactMedium();
    setIsFriendsModalOpen(true);
    const started = createFriendRoom();
    if (!started) {
      return;
    }
  }, [createFriendRoom]);

  const handleJoinFriendRoom = useCallback(() => {
    impactMedium();
    setIsFriendsModalOpen(true);
    const started = joinFriendRoom(friendRoomInput);
    if (!started) {
      return;
    }
  }, [friendRoomInput, joinFriendRoom]);

  const handleCloseFriendsModal = useCallback(() => {
    impactLight();
    leaveFriendRoom();
    clearFriendRoomError();
    setIsFriendsModalOpen(false);
    setFriendRoomInput("");
  }, [leaveFriendRoom, clearFriendRoomError]);

  const handleFriendRoomInput = useCallback(
    (value: string) => {
      const next = value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, ROOM_CODE_LENGTH);
      if (friendRoomError) {
        clearFriendRoomError();
      }
      setFriendRoomInput(next);
    },
    [friendRoomError, clearFriendRoomError],
  );

  const handleIncomingInvite = useCallback(
    (url: string) => {
      const roomCode = parseFriendInviteUrl(url);
      if (!roomCode) return;

      setFriendRoomInput(roomCode);
      clearFriendRoomError();
      setIsFriendsModalOpen(true);
    },
    [clearFriendRoomError],
  );

  const handleIncomingInviteCode = useCallback(
    (rawCode: unknown) => {
      const roomCode = parseFriendInviteCode(rawCode);
      if (!roomCode) return;

      setFriendRoomInput(roomCode);
      clearFriendRoomError();
      setIsFriendsModalOpen(true);
    },
    [clearFriendRoomError],
  );

  useEffect(() => {
    let mounted = true;

    Linking.getInitialURL()
      .then((url) => {
        if (mounted && url) {
          handleIncomingInvite(url);
        }
      })
      .catch(() => {
        // Ignore malformed or unavailable initial deep-link data.
      });

    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleIncomingInvite(url);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [handleIncomingInvite]);

  useEffect(() => {
    handleIncomingInviteCode(inviteCode);
  }, [handleIncomingInviteCode, inviteCode]);

  // The Friends screen's "use a room code" fallback.
  useEffect(() => {
    if (useRoomCode !== "1") return;
    router.setParams({ useRoomCode: undefined });
    clearFriendRoomError();
    setIsFriendsModalOpen(true);
  }, [useRoomCode, clearFriendRoomError]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <LinearGradient
        colors={
          isDark
            ? ["#1a1a2e", "#2d2d4a", "#1a1a2e"]
            : ["#f8f9ff", "#e8e9ff", "#f8f9ff"]
        }
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View
        style={[
          styles.content,
          { paddingTop: topPadding + 40, paddingBottom: bottomPadding + 20 },
        ]}
      >
        <HomeHero colors={colors} playerName={playerIdentity.displayName} />

        <HomePrimaryActions
          colors={colors}
          pulseStyle={pulseStyle}
          buttonAnimatedStyle={buttonAnimatedStyle}
          isSearching={isSearching}
          onOpenGallery={() => {
            impactLight();
            router.push("/gallery");
          }}
          onOpenFriends={handleOpenFriends}
          onOpenFriendList={
            Platform.OS === "ios"
              ? () => {
                  impactLight();
                  router.push("/friend-list");
                }
              : undefined
          }
          onFindMatch={handleFindMatch}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        />
      </View>

      {isFocused && (
        <MatchmakingModal
          visible={showSearchModal}
          colors={colors}
          flowState={flowState}
          lastErrorMessage={lastError?.message}
          backoffCountdown={backoffCountdown}
          queuePosition={queuePosition}
          searchPulseStyle={searchPulseStyle}
          onCancel={handleCancelSearch}
          onRetry={() => {
            disconnect();
            setTimeout(() => handleFindMatch(), 100);
          }}
        />
      )}

      {isFocused && (
        <InviteMatchModal
          visible={inviteMatch !== null}
          colors={colors}
          friendName={inviteMatch?.friendName ?? "your friend"}
          error={inviteMatch ? inviteMatchFailureMessage ?? (friendRoomStatus === "idle" ? friendRoomError : null) : null}
          onCancel={handleCancelInviteMatch}
        />
      )}

      {isFocused && (
        <FriendsMatchModal
          visible={showFriendsModal}
          colors={colors}
          status={friendRoomStatus}
          roomCode={friendRoomCode}
          roomError={friendRoomError}
          roomInput={friendRoomInput}
          onRoomInputChange={handleFriendRoomInput}
          onCreateRoom={handleCreateFriendRoom}
          onJoinRoom={handleJoinFriendRoom}
          onClose={handleCloseFriendsModal}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
});
