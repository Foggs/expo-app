import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useGameWebSocket } from "@/contexts/WebSocketContext";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const buttonScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.4);
  const searchPulse = useSharedValue(0.6);
  const navigatedRef = useRef(false);

  const ws = useGameWebSocket();
  const [friendMode, setFriendMode] = useState<"none" | "choose" | "join">("none");
  const [joinCode, setJoinCode] = useState("");
  const [roomError, setRoomError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    ws.setCallbacks({
      onMatchFound: (info) => {
        if (navigatedRef.current) return;
        navigatedRef.current = true;
        setFriendMode("none");
        setJoinCode("");
        setRoomError(null);
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
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
        setRoomError(message);
        console.warn("WebSocket error:", message);
      },
    });

    return () => {
      ws.setCallbacks({});
    };
  }, []);

  const isSearching = ws.matchStatus === "searching" || ws.matchStatus === "matched";
  const isHosting = ws.matchStatus === "hosting";

  const handleCreateRoom = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    navigatedRef.current = false;
    setRoomError(null);
    setFriendMode("none");
    setCopied(false);

    if (ws.connectionStatus === "connected") {
      ws.createRoom();
    } else {
      ws.connect();
      wantToCreateRef.current = true;
    }
  }, [ws.connectionStatus, ws.connect, ws.createRoom]);

  const wantToCreateRef = useRef(false);
  const wantToJoinCodeRef = useRef<string | null>(null);

  useEffect(() => {
    if (ws.connectionStatus === "connected" && wantToCreateRef.current && ws.matchStatus === "idle") {
      wantToCreateRef.current = false;
      ws.createRoom();
    }
    if (ws.connectionStatus === "connected" && wantToJoinCodeRef.current && ws.matchStatus === "idle") {
      const code = wantToJoinCodeRef.current;
      wantToJoinCodeRef.current = null;
      ws.joinRoom(code);
    }
  }, [ws.connectionStatus, ws.matchStatus, ws.createRoom, ws.joinRoom]);

  const handleJoinRoom = useCallback(() => {
    if (joinCode.length !== 4) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    navigatedRef.current = false;
    setRoomError(null);

    if (ws.connectionStatus === "connected") {
      ws.joinRoom(joinCode);
    } else {
      wantToJoinCodeRef.current = joinCode;
      ws.connect();
    }
  }, [joinCode, ws.connectionStatus, ws.connect, ws.joinRoom]);

  const handleCancelRoom = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    ws.leaveRoom();
    ws.disconnect();
    setFriendMode("none");
    setJoinCode("");
    setRoomError(null);
    setCopied(false);
  }, [ws.leaveRoom, ws.disconnect]);

  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const handleCopyCode = useCallback(async () => {
    if (!ws.roomCode) return;
    try {
      await Clipboard.setStringAsync(ws.roomCode);
      setCopied(true);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may not be available
    }
  }, [ws.roomCode]);

  React.useEffect(() => {
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 1500 }),
        withTiming(0.4, { duration: 1500 })
      ),
      -1,
      true
    );
  }, []);

  useEffect(() => {
    if (isSearching || isHosting) {
      searchPulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1000 }),
          withTiming(0.6, { duration: 1000 })
        ),
        -1,
        true
      );
    }
  }, [isSearching, isHosting]);

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
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    navigatedRef.current = false;
    wantToJoinRef.current = true;

    if (ws.connectionStatus === "connected") {
      ws.joinQueue();
    } else {
      ws.connect();
    }
  }, [ws.connectionStatus, ws.connect, ws.joinQueue]);

  useEffect(() => {
    if (ws.connectionStatus === "connected" && wantToJoinRef.current && ws.matchStatus === "idle") {
      wantToJoinRef.current = false;
      ws.joinQueue();
    }
  }, [ws.connectionStatus, ws.matchStatus, ws.joinQueue]);

  const handleCancelSearch = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    wantToJoinRef.current = false;
    ws.leaveQueue();
    ws.disconnect();
  }, [ws.leaveQueue, ws.disconnect]);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

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
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View
              style={[styles.brushStroke, { backgroundColor: colors.tint }]}
            />
            <View
              style={[
                styles.brushStroke,
                styles.brushStroke2,
                { backgroundColor: colors.accent },
              ]}
            />
          </View>

          <Text
            style={[styles.title, { color: colors.text }]}
            accessibilityRole="header"
          >
            SketchDuel
          </Text>

        </View>

        <View style={styles.centerContent}>
          <View style={styles.gameInfo}>
            <View style={styles.infoRow} accessible={true} accessibilityLabel="2 Players per game">
              <View
                style={[styles.iconContainer, { backgroundColor: colors.card }]}
              >
                <Ionicons name="people" size={24} color={colors.tint} />
              </View>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                2 Players
              </Text>
            </View>

            <View style={styles.infoRow} accessible={true} accessibilityLabel="1 Minute per Turn">
              <View
                style={[styles.iconContainer, { backgroundColor: colors.card }]}
              >
                <Ionicons name="timer" size={24} color={colors.accent} />
              </View>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                1 Minute per Turn
              </Text>
            </View>

            <View style={styles.infoRow} accessible={true} accessibilityLabel="3 Rounds per game">
              <View
                style={[styles.iconContainer, { backgroundColor: colors.card }]}
              >
                <Ionicons
                  name="repeat"
                  size={24}
                  color={colors.accentSecondary}
                />
              </View>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                3 Rounds
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomButtons}>
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              router.push("/gallery");
            }}
            style={[styles.galleryButton, { backgroundColor: colors.card }]}
            accessibilityRole="button"
            accessibilityLabel="View saved drawings gallery"
          >
            <Ionicons name="images" size={20} color={colors.tint} />
            <Text style={[styles.galleryButtonText, { color: colors.text }]}>
              Gallery
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              setFriendMode("choose");
              setRoomError(null);
            }}
            style={[styles.galleryButton, { backgroundColor: colors.card }]}
            accessibilityRole="button"
            accessibilityLabel="Play with a friend using a room code"
            disabled={isSearching || isHosting}
          >
            <Ionicons name="people" size={20} color={colors.accent} />
            <Text style={[styles.galleryButtonText, { color: colors.text }]}>
              Play with Friend
            </Text>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Animated.View style={[styles.pulseRing, pulseStyle]}>
            <LinearGradient
              colors={[colors.tint, colors.accent]}
              style={styles.pulseGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          </Animated.View>

          <Animated.View style={buttonAnimatedStyle}>
            <Pressable
              onPress={handleFindMatch}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              disabled={isSearching}
              accessibilityRole="button"
              accessibilityLabel="Find a match to play"
              accessibilityHint="Searches for another player to start a drawing game"
            >
              <LinearGradient
                colors={[colors.tint, colors.accent]}
                style={[styles.findMatchButton, isSearching && styles.buttonDisabled]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="search" size={24} color="#fff" />
                <Text style={styles.buttonText}>Find Match</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </View>
      </View>

      <Modal
        visible={isSearching}
        transparent
        animationType="fade"
        onRequestClose={handleCancelSearch}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.searchModal, { backgroundColor: colors.card }]}>
            <Animated.View style={searchPulseStyle}>
              <ActivityIndicator size="large" color={colors.tint} />
            </Animated.View>

            <Text style={[styles.searchTitle, { color: colors.text }]} accessibilityLiveRegion="polite" accessibilityRole="alert">
              Searching for opponent...
            </Text>

            {ws.queuePosition > 0 && (
              <Text style={[styles.queueText, { color: colors.textSecondary }]} accessibilityLiveRegion="polite">
                Queue position: {ws.queuePosition}
              </Text>
            )}

            <Text style={[styles.searchHint, { color: colors.textSecondary }]}>
              This may take a moment
            </Text>

            <Pressable
              onPress={handleCancelSearch}
              style={[styles.cancelButton, { borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel="Cancel search"
            >
              <Ionicons name="close" size={20} color={colors.error} />
              <Text style={[styles.cancelText, { color: colors.error }]}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={friendMode === "choose"}
        transparent
        animationType="fade"
        onRequestClose={() => setFriendMode("none")}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.searchModal, { backgroundColor: colors.card }]}>
            <Ionicons name="people" size={40} color={colors.accent} />
            <Text style={[styles.searchTitle, { color: colors.text }]}>
              Play with Friend
            </Text>

            <Pressable
              onPress={handleCreateRoom}
              style={[styles.friendOptionButton, { backgroundColor: colors.tint }]}
              accessibilityRole="button"
              accessibilityLabel="Create a room and get a code to share"
            >
              <Ionicons name="add-circle" size={22} color="#fff" />
              <Text style={styles.friendOptionText}>Create Room</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setFriendMode("join");
                setJoinCode("");
                setRoomError(null);
              }}
              style={[styles.friendOptionButton, { backgroundColor: colors.accent }]}
              accessibilityRole="button"
              accessibilityLabel="Join a room with a code from a friend"
            >
              <Ionicons name="enter" size={22} color="#fff" />
              <Text style={styles.friendOptionText}>Join Room</Text>
            </Pressable>

            <Pressable
              onPress={() => setFriendMode("none")}
              style={[styles.cancelButton, { borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isHosting}
        transparent
        animationType="fade"
        onRequestClose={handleCancelRoom}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.searchModal, { backgroundColor: colors.card }]}>
            <Text style={[styles.searchTitle, { color: colors.text }]}>
              Your Room Code
            </Text>

            <View style={[styles.roomCodeContainer, { borderColor: colors.tint }]}>
              <Text style={[styles.roomCodeText, { color: colors.tint }]} selectable>
                {ws.roomCode}
              </Text>
            </View>

            <Pressable
              onPress={handleCopyCode}
              style={[styles.copyButton, { backgroundColor: copied ? colors.success : colors.tint }]}
              accessibilityRole="button"
              accessibilityLabel={copied ? "Code copied" : "Copy room code"}
            >
              <Ionicons name={copied ? "checkmark" : "copy"} size={18} color="#fff" />
              <Text style={styles.copyButtonText}>
                {copied ? "Copied!" : "Copy Code"}
              </Text>
            </Pressable>

            <Text style={[styles.searchHint, { color: colors.textSecondary }]}>
              Share this code with your friend
            </Text>

            {roomError && (
              <Text style={[styles.errorText, { color: colors.error }]}>
                {roomError}
              </Text>
            )}

            <Animated.View style={searchPulseStyle}>
              <ActivityIndicator size="small" color={colors.accent} />
            </Animated.View>
            <Text style={[styles.queueText, { color: colors.textSecondary }]}>
              Waiting for friend to join...
            </Text>

            <Pressable
              onPress={handleCancelRoom}
              style={[styles.cancelButton, { borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel="Cancel room"
            >
              <Ionicons name="close" size={20} color={colors.error} />
              <Text style={[styles.cancelText, { color: colors.error }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={friendMode === "join"}
        transparent
        animationType="fade"
        onRequestClose={() => { setFriendMode("none"); setJoinCode(""); setRoomError(null); }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.searchModal, { backgroundColor: colors.card }]}>
            <Text style={[styles.searchTitle, { color: colors.text }]}>
              Enter Room Code
            </Text>

            <TextInput
              style={[styles.codeInput, { color: colors.text, borderColor: roomError ? colors.error : colors.border }]}
              value={joinCode}
              onChangeText={(text) => {
                setJoinCode(text.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4));
                setRoomError(null);
              }}
              placeholder="ABCD"
              placeholderTextColor={colors.textSecondary}
              maxLength={4}
              autoCapitalize="characters"
              autoCorrect={false}
              accessibilityLabel="Room code input"
              accessibilityHint="Enter the 4-letter code your friend shared"
            />

            {roomError && (
              <Text style={[styles.errorText, { color: colors.error }]}>
                {roomError}
              </Text>
            )}

            <Pressable
              onPress={handleJoinRoom}
              disabled={joinCode.length !== 4}
              style={[
                styles.friendOptionButton,
                { backgroundColor: joinCode.length === 4 ? colors.accent : colors.border },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Join room"
            >
              <Ionicons name="enter" size={22} color="#fff" />
              <Text style={styles.friendOptionText}>Join</Text>
            </Pressable>

            <Pressable
              onPress={() => { setFriendMode("none"); setJoinCode(""); setRoomError(null); }}
              style={[styles.cancelButton, { borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  header: {
    alignItems: "center",
    gap: 16,
  },
  logoContainer: {
    width: 80,
    height: 80,
    justifyContent: "center",
    alignItems: "center",
  },
  brushStroke: {
    position: "absolute",
    width: 60,
    height: 12,
    borderRadius: 6,
    transform: [{ rotate: "-45deg" }],
  },
  brushStroke2: {
    transform: [{ rotate: "45deg" }],
  },
  title: {
    fontSize: 42,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
  },
  gameInfo: {
    gap: 20,
    alignItems: "center",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 16,
    width: 220,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  infoText: {
    fontSize: 17,
    fontFamily: "Inter_500Medium",
  },
  bottomButtons: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 8,
  },
  galleryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  galleryButtonText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  footer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  pulseRing: {
    position: "absolute",
    width: 220,
    height: 64,
    borderRadius: 32,
    overflow: "hidden",
  },
  pulseGradient: {
    flex: 1,
  },
  findMatchButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 28,
    minWidth: 200,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  searchModal: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    gap: 16,
  },
  searchTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  queueText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  searchHint: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
  },
  cancelText: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
  friendOptionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: "100%",
  },
  friendOptionText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  roomCodeContainer: {
    borderWidth: 2,
    borderRadius: 16,
    borderStyle: "dashed",
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: "center",
  },
  roomCodeText: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    letterSpacing: 8,
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  copyButtonText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  codeInput: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    letterSpacing: 8,
    textAlign: "center",
    borderWidth: 2,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: "100%",
  },
  errorText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
});
