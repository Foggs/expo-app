import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
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
import MatchmakingModal from "@/components/MatchmakingModal";
import { useGameWebSocket } from "@/contexts/WebSocketContext";
import { useScreenPadding } from "@/hooks/useScreenPadding";
import { useThemeColors } from "@/hooks/useThemeColors";
import { impactLight, impactMedium, notifySuccess } from "@/lib/platformFeedback";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useThemeColors();
  const { topPadding, bottomPadding } = useScreenPadding(insets);

  const buttonScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.4);
  const searchPulse = useSharedValue(0.6);
  const navigatedRef = useRef(false);
  const [isFriendsModalOpen, setIsFriendsModalOpen] = useState(false);
  const [friendRoomInput, setFriendRoomInput] = useState("");

  const {
    setCallbacks,
    matchStatus,
    flowState,
    retryDelayMs,
    connectionStatus,
    joinQueue,
    connect,
    leaveQueue,
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
  } = useGameWebSocket();

  const isSearching = matchStatus === "queueing" || matchStatus === "matched";
  const isFriendFlowActive = friendRoomStatus !== "idle";
  const showFriendsModal = isFriendsModalOpen || isFriendFlowActive;

  useEffect(() => {
    setCallbacks({
      onMatchFound: (info) => {
        if (navigatedRef.current) return;
        navigatedRef.current = true;
        setIsFriendsModalOpen(false);
        setFriendRoomInput("");
        notifySuccess();
        router.push({
          pathname: "/game",
          params: {
            gameId: info.gameId,
            playerRole: info.playerRole,
            opponentName: info.opponentName,
          },
        });
      },
      onError: (message) => {
        console.warn("WebSocket error:", message);
      },
    });

    return () => {
      setCallbacks({});
    };
  }, [setCallbacks]);

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

  const wantToJoinRef = useRef(false);

  const handleFindMatch = useCallback(() => {
    if (isFriendFlowActive || isFriendsModalOpen) {
      return;
    }
    impactMedium();
    navigatedRef.current = false;
    wantToJoinRef.current = true;

    if (connectionStatus === "connected") {
      joinQueue();
    } else {
      connect();
    }
  }, [isFriendFlowActive, isFriendsModalOpen, connectionStatus, joinQueue, connect]);

  useEffect(() => {
    if (
      connectionStatus === "connected" &&
      wantToJoinRef.current &&
      matchStatus === "idle"
    ) {
      wantToJoinRef.current = false;
      joinQueue();
    }
  }, [connectionStatus, matchStatus, joinQueue]);

  const handleCancelSearch = useCallback(() => {
    impactLight();
    wantToJoinRef.current = false;
    leaveQueue();
    if (connectionStatus !== "disconnected") {
      disconnect();
    }
  }, [leaveQueue, connectionStatus, disconnect]);

  const handleOpenFriends = useCallback(() => {
    if (isSearching || isErrorState) return;
    impactLight();
    clearFriendRoomError();
    setIsFriendsModalOpen(true);
  }, [isSearching, isErrorState, clearFriendRoomError]);

  const handleCreateFriendRoom = useCallback(() => {
    impactMedium();
    createFriendRoom();
    setIsFriendsModalOpen(true);
  }, [createFriendRoom]);

  const handleJoinFriendRoom = useCallback(() => {
    impactMedium();
    joinFriendRoom(friendRoomInput);
    setIsFriendsModalOpen(true);
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
        <HomeHero colors={colors} />

        <HomePrimaryActions
          colors={colors}
          isSearching={isSearching}
          isFriendFlowActive={showFriendsModal}
          pulseStyle={pulseStyle}
          buttonAnimatedStyle={buttonAnimatedStyle}
          onOpenGallery={() => {
            impactLight();
            router.push("/gallery");
          }}
          onOpenFriends={handleOpenFriends}
          onFindMatch={handleFindMatch}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        />
      </View>

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
