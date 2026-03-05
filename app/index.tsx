import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

  const ws = useGameWebSocket();

  useEffect(() => {
    ws.setCallbacks({
      onMatchFound: (info) => {
        if (navigatedRef.current) return;
        navigatedRef.current = true;
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
      ws.setCallbacks({});
    };
  }, []);

  const isSearching = ws.matchStatus === "queueing" || ws.matchStatus === "matched";
  const isErrorState =
    ws.flowState === "error_recoverable" ||
    ws.flowState === "error_backoff" ||
    ws.flowState === "error_fatal";
  const showSearchModal = isSearching || isErrorState;

  const [backoffCountdown, setBackoffCountdown] = useState(0);

  useEffect(() => {
    if (ws.flowState === "error_backoff" && ws.retryDelayMs > 0) {
      setBackoffCountdown(Math.ceil(ws.retryDelayMs / 1000));
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
  }, [ws.flowState, ws.retryDelayMs]);

  useEffect(() => {
    pulseOpacity.value = withRepeat(
      withSequence(withTiming(0.8, { duration: 1500 }), withTiming(0.4, { duration: 1500 })),
      -1,
      true
    );
  }, []);

  useEffect(() => {
    if (isSearching) {
      searchPulse.value = withRepeat(
        withSequence(withTiming(1, { duration: 1000 }), withTiming(0.6, { duration: 1000 })),
        -1,
        true
      );
    }
  }, [isSearching]);

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
    impactMedium();
    navigatedRef.current = false;
    wantToJoinRef.current = true;

    if (ws.connectionStatus === "connected") {
      ws.joinQueue();
    } else {
      ws.connect();
    }
  }, [ws]);

  useEffect(() => {
    if (
      ws.connectionStatus === "connected" &&
      wantToJoinRef.current &&
      ws.matchStatus === "idle"
    ) {
      wantToJoinRef.current = false;
      ws.joinQueue();
    }
  }, [ws.connectionStatus, ws.matchStatus, ws.joinQueue]);

  const handleCancelSearch = useCallback(() => {
    impactLight();
    wantToJoinRef.current = false;
    ws.leaveQueue();
    if (ws.connectionStatus !== "disconnected") {
      ws.disconnect();
    }
  }, [ws]);

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
          pulseStyle={pulseStyle}
          buttonAnimatedStyle={buttonAnimatedStyle}
          onOpenGallery={() => {
            impactLight();
            router.push("/gallery");
          }}
          onFindMatch={handleFindMatch}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        />
      </View>

      <MatchmakingModal
        visible={showSearchModal}
        colors={colors}
        flowState={ws.flowState}
        lastErrorMessage={ws.lastError?.message}
        backoffCountdown={backoffCountdown}
        queuePosition={ws.queuePosition}
        searchPulseStyle={searchPulseStyle}
        onCancel={handleCancelSearch}
        onRetry={() => {
          ws.disconnect();
          setTimeout(() => handleFindMatch(), 100);
        }}
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
