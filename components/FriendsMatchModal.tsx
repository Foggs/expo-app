import React from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ROOM_CODE_LENGTH } from "@shared/friendRoom";
import type { FriendRoomStatus } from "@/contexts/WebSocketContext";
import type { ThemeColors } from "@/hooks/useThemeColors";

export interface FriendsMatchModalProps {
  visible: boolean;
  colors: ThemeColors;
  status: FriendRoomStatus;
  roomCode: string | null;
  roomError: string | null;
  roomInput: string;
  onRoomInputChange: (value: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onClose: () => void;
}

export default function FriendsMatchModal({
  visible,
  colors,
  status,
  roomCode,
  roomError,
  roomInput,
  onRoomInputChange,
  onCreateRoom,
  onJoinRoom,
  onClose,
}: FriendsMatchModalProps) {
  const isLoading = status === "creating" || status === "joining";
  const isWaiting = status === "waiting_for_friend";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.title, { color: colors.text }]}>Friends Match</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Create a room code or join your friend&apos;s room.
          </Text>

          {isWaiting && roomCode && (
            <View style={[styles.roomCodeBox, { borderColor: colors.border }]}>
              <Text style={[styles.roomCodeLabel, { color: colors.textSecondary }]}>
                Share This Code
              </Text>
              <Text
                style={[styles.roomCodeValue, { color: colors.tint }]}
                accessibilityLabel={`Room code ${roomCode}`}
              >
                {roomCode}
              </Text>
              <Text style={[styles.waitingText, { color: colors.textSecondary }]}>
                Waiting for your friend to join...
              </Text>
            </View>
          )}

          {!isWaiting && (
            <>
              <Pressable
                onPress={onCreateRoom}
                disabled={isLoading}
                style={[styles.primaryButton, { backgroundColor: colors.tint }, isLoading && styles.disabled]}
                accessibilityRole="button"
                accessibilityLabel="Create friend room"
              >
                <Ionicons name="add-circle-outline" size={20} color="#fff" />
                <Text style={styles.primaryText}>Create Room</Text>
              </Pressable>

              <View style={styles.joinRow}>
                <TextInput
                  value={roomInput}
                  onChangeText={onRoomInputChange}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={ROOM_CODE_LENGTH}
                  placeholder="Room Code"
                  placeholderTextColor={colors.textSecondary}
                  style={[
                    styles.input,
                    { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
                  ]}
                  accessibilityLabel="Enter room code"
                />
                <Pressable
                  onPress={onJoinRoom}
                  disabled={isLoading}
                  style={[styles.joinButton, { backgroundColor: colors.accent }, isLoading && styles.disabled]}
                  accessibilityRole="button"
                  accessibilityLabel="Join friend room"
                >
                  <Text style={styles.joinText}>Join</Text>
                </Pressable>
              </View>
            </>
          )}

          {isLoading && <ActivityIndicator size="small" color={colors.tint} />}

          {roomError ? (
            <Text style={[styles.errorText, { color: colors.error }]} accessibilityRole="alert">
              {roomError}
            </Text>
          ) : null}

          <Pressable
            onPress={onClose}
            style={[styles.closeButton, { borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={isWaiting ? "Leave friend room" : "Close friends match"}
          >
            <Text style={[styles.closeText, { color: colors.textSecondary }]}>
              {isWaiting ? "Leave Room" : "Close"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    padding: 24,
    gap: 14,
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  roomCodeBox: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 6,
    alignItems: "center",
  },
  roomCodeLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  roomCodeValue: {
    fontSize: 34,
    fontFamily: "Inter_700Bold",
    letterSpacing: 4,
  },
  waitingText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
  },
  primaryText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  joinRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
  joinButton: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  joinText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  closeButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
  },
  closeText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  disabled: {
    opacity: 0.6,
  },
});
