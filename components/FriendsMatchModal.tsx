import React, { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { ROOM_CODE_LENGTH } from "@shared/friendRoom";
import BaseModal from "@/components/BaseModal";
import type { FriendRoomStatus } from "@/contexts/WebSocketContext";
import type { ThemeColors } from "@/hooks/useThemeColors";
import {
  createFriendInviteLink,
  createFriendInviteMessage,
} from "@/lib/friendInvite";

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
  /** Game Center friends entry, shown below the invite-code actions where Game Center exists. */
  gameCenter?: { status: string; onPress: () => void };
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
  gameCenter,
}: FriendsMatchModalProps) {
  const isLoading = status === "creating" || status === "joining";
  const isWaiting = status === "waiting_for_friend";
  const inviteLink = roomCode ? createFriendInviteLink(roomCode) : null;
  const inviteMessage =
    roomCode && inviteLink
      ? createFriendInviteMessage(roomCode, inviteLink)
      : null;
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const hasCopied = inviteLink !== null && copiedLink === inviteLink;

  const announce = (message: string) => {
    AccessibilityInfo.announceForAccessibility(message);
  };

  const handleCopyInvite = async () => {
    if (!inviteLink) return;

    try {
      await Clipboard.setStringAsync(inviteLink);
      setCopiedLink(inviteLink);
      announce("Invite link copied");
    } catch {
      setCopiedLink(null);
      announce("Invite link could not be copied");
      Alert.alert(
        "Could not copy invite link",
        "Please use one of the share options instead.",
      );
    }
  };

  const handleShareInvite = async () => {
    if (!inviteMessage) return;

    try {
      const result = await Share.share({
        message: inviteMessage,
        title: "SketchDuel invite",
      });
      if (result.action === Share.sharedAction) {
        announce("Invite shared");
      }
    } catch {
      announce("Invite could not be shared");
      Alert.alert(
        "Sharing unavailable",
        "Please copy the invite link and share it manually.",
      );
    }
  };

  const openExternalInvite = async (url: string, appName: string) => {
    if (Platform.OS === "web") {
      Alert.alert(
        `${appName} is unavailable`,
        "Use the Share button to send this invite.",
      );
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) throw new Error(`${appName} is not installed`);
      await Linking.openURL(url);
      announce(`Invite opened in ${appName}`);
    } catch {
      announce(`${appName} is unavailable`);
      Alert.alert(
        `${appName} unavailable`,
        `Install ${appName} or use the native Share button instead.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Use Share", onPress: handleShareInvite },
        ],
      );
    }
  };

  const handleMessengerShare = () => {
    if (!inviteLink) return;
    void openExternalInvite(
      `fb-messenger://share/?link=${encodeURIComponent(inviteLink)}`,
      "Facebook Messenger",
    );
  };

  const handleMessagesShare = () => {
    if (!inviteMessage) return;
    const prefix = Platform.OS === "ios" ? "sms:&body=" : "sms:?body=";
    void openExternalInvite(
      `${prefix}${encodeURIComponent(inviteMessage)}`,
      "Messages",
    );
  };

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      dismissOnOverlay={false}
      maxWidth={360}
      cardStyle={styles.card}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          Play with Friends
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Share an invite code to play with your friends, or enter the code a friend sent you.
        </Text>

        {isWaiting && roomCode && inviteLink ? (
          <>
            <View style={[styles.roomCodeBox, { borderColor: colors.border }]}>
              <Text style={[styles.roomCodeLabel, { color: colors.textSecondary }]}>
                Share This Code
              </Text>
              <Text
                style={[styles.roomCodeValue, { color: colors.tint }]}
                accessibilityLabel={`Invite code ${roomCode}`}
              >
                {roomCode}
              </Text>
            </View>

            <View style={styles.inviteActions}>
              <Pressable
                onPress={handleCopyInvite}
                style={({ pressed }) => [
                  styles.copyButton,
                  { borderColor: colors.tint, backgroundColor: colors.tint + "15" },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Copy invite link"
                accessibilityHint="Copies the room invite link to your clipboard"
              >
                <Ionicons
                  name={hasCopied ? "checkmark-circle-outline" : "copy-outline"}
                  size={20}
                  color={colors.tint}
                />
                <Text style={[styles.copyText, { color: colors.tint }]}>
                  {hasCopied ? "Copied!" : "Copy Invite Link"}
                </Text>
              </Pressable>

              <View style={styles.shareButtons}>
                <Pressable
                  onPress={handleShareInvite}
                  style={({ pressed }) => [
                    styles.shareButton,
                    { backgroundColor: colors.tint },
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Share invite"
                  accessibilityHint="Opens the native share options"
                >
                  <Ionicons name="share-social-outline" size={20} color="#fff" />
                  <Text style={styles.shareButtonText}>Share…</Text>
                </Pressable>
                <Pressable
                  onPress={handleMessengerShare}
                  style={({ pressed }) => [
                    styles.shareButton,
                    { backgroundColor: "#1877F2" },
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Share invite with Facebook Messenger"
                  accessibilityHint="Opens Facebook Messenger with this invite"
                >
                  <Ionicons name="logo-facebook" size={20} color="#fff" />
                  <Text style={styles.shareButtonText}>Messenger</Text>
                </Pressable>
                <Pressable
                  onPress={handleMessagesShare}
                  style={({ pressed }) => [
                    styles.shareButton,
                    { backgroundColor: colors.accent },
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Share invite with Messages"
                  accessibilityHint="Opens Messages with a prefilled invite"
                >
                  <Ionicons name="chatbubble-outline" size={20} color="#fff" />
                  <Text style={styles.shareButtonText}>Messages</Text>
                </Pressable>
              </View>
            </View>

            <Text style={[styles.waitingText, { color: colors.textSecondary }]}>
              Waiting for your friend to join...
            </Text>
          </>
        ) : !isWaiting ? (
          <>
            <Pressable
              onPress={onCreateRoom}
              disabled={isLoading}
              style={[styles.primaryButton, { backgroundColor: colors.tint }, isLoading && styles.disabled]}
              accessibilityRole="button"
              accessibilityLabel="Create invite code"
            >
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.primaryText}>Create Invite Code</Text>
            </Pressable>

            <View style={styles.joinRow}>
              <TextInput
                value={roomInput}
                onChangeText={onRoomInputChange}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={ROOM_CODE_LENGTH}
                placeholder="Invite Code"
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.input,
                  { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
                ]}
                accessibilityLabel="Enter invite code"
                accessibilityHint={`Enter a ${ROOM_CODE_LENGTH}-character invite code`}
              />
              <Pressable
                onPress={onJoinRoom}
                disabled={isLoading}
                style={[styles.joinButton, { backgroundColor: colors.accent }, isLoading && styles.disabled]}
                accessibilityRole="button"
                accessibilityLabel="Join with invite code"
              >
                <Text style={styles.joinText}>Join</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {isLoading && <ActivityIndicator size="small" color={colors.tint} />}

        {gameCenter && !isWaiting && !isLoading ? (
          <>
            <View style={styles.orRow}>
              <View style={[styles.orLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.orText, { color: colors.textSecondary }]}>or</Text>
              <View style={[styles.orLine, { backgroundColor: colors.border }]} />
            </View>
            <Pressable
              onPress={gameCenter.onPress}
              style={({ pressed }) => [
                styles.gameCenterRow,
                { borderColor: colors.border },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Game Center Friends, ${gameCenter.status}`}
              accessibilityHint="See which Game Center friends are online and invite them"
            >
              <Ionicons name="game-controller-outline" size={22} color={colors.tint} />
              <View style={styles.gameCenterText}>
                <Text style={[styles.gameCenterTitle, { color: colors.text }]}>Game Center Friends</Text>
                <Text style={[styles.gameCenterStatus, { color: colors.textSecondary }]} numberOfLines={1}>
                  {gameCenter.status}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
          </>
        ) : null}

        {roomError ? (
          <Text style={[styles.errorText, { color: colors.error }]} accessibilityRole="alert">
            {roomError}
          </Text>
        ) : null}

        <Pressable
          onPress={onClose}
          style={[styles.closeButton, { borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel={isWaiting ? "Leave friend room" : "Close Play with Friends"}
        >
          <Text style={[styles.closeText, { color: colors.textSecondary }]}>
            {isWaiting ? "Leave Room" : "Close"}
          </Text>
        </Pressable>
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 24,
  },
  content: {
    width: "100%",
    gap: 20,
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
    textAlign: "center",
  },
  inviteActions: {
    width: "100%",
    gap: 20,
  },
  copyButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  copyText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  shareButtons: {
    gap: 20,
  },
  shareButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  shareButtonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    minHeight: 48,
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
    minHeight: 44,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
  joinButton: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
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
    paddingVertical: 10,
    minHeight: 44,
    alignItems: "center",
  },
  closeText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  orLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  orText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  gameCenterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  gameCenterText: {
    flex: 1,
    gap: 2,
  },
  gameCenterTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  gameCenterStatus: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.82,
  },
});
