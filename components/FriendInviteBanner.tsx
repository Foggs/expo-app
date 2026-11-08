import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FullWindowOverlay } from "react-native-screens";
import { useSocial } from "@/contexts/SocialContext";
import { useThemeColors } from "@/hooks/useThemeColors";
import { impactLight, impactMedium } from "@/lib/platformFeedback";
import { describeNotice } from "@/lib/social/friendsState";

const NOTICE_VISIBLE_MS = 4_500;

/** On iOS, renders above everything, including open modals. */
function Overlay({ children }: { children: React.ReactNode }) {
  if (Platform.OS === "ios") return <FullWindowOverlay>{children}</FullWindowOverlay>;
  return <>{children}</>;
}

/**
 * Shows incoming friend invites (Accept / Decline) and short invite notices
 * on any screen, and returns to the home screen when an invite is accepted
 * so it can join the reserved room.
 */
export default function FriendInviteBanner() {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeColors();
  const social = useSocial();
  const { incoming, notice, acceptedRoom, nameFor, respondToInvite, clearNotice } = social;
  const invite = incoming[0] ?? null;
  const inviteId = invite?.inviteId ?? null;
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!inviteId) return;
    impactMedium();
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [inviteId]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(clearNotice, NOTICE_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [notice, clearNotice]);

  // An accepted invite: leave any game-over or gallery screen so home can start the match.
  const handledRoomRef = useRef<string | null>(null);
  useEffect(() => {
    if (!acceptedRoom || handledRoomRef.current === acceptedRoom.roomCode) return;
    handledRoomRef.current = acceptedRoom.roomCode;
    if (router.canDismiss()) router.dismissAll();
  }, [acceptedRoom]);

  if (!invite && !notice) return null;

  const answer = (accept: boolean) => {
    if (!invite) return;
    impactLight();
    setAnsweringId(invite.inviteId);
    respondToInvite(invite.inviteId, accept);
  };

  const answering = invite !== null && answeringId === invite.inviteId;
  const secondsLeft = invite ? Math.max(0, Math.ceil((invite.expiresAt - now) / 1_000)) : 0;

  return (
    <Overlay>
      <View pointerEvents="box-none" style={[styles.host, { paddingTop: insets.top + 8 }]}>
        {invite ? (
          <Animated.View
            key={invite.inviteId}
            entering={FadeInUp}
            exiting={FadeOutUp}
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.tint }]}
            accessibilityViewIsModal={false}
            accessibilityLiveRegion="assertive"
          >
            <View style={styles.inviteHeader}>
              <Ionicons name="brush" size={20} color={colors.tint} />
              <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
                {nameFor(invite.playerId)} invited you to a match
              </Text>
            </View>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {answering ? "Joining…" : `Expires in ${secondsLeft}s`}
            </Text>
            <View style={styles.actions}>
              <Pressable
                onPress={() => answer(false)}
                disabled={answering}
                style={[styles.button, styles.secondary, { borderColor: colors.border }]}
                accessibilityRole="button"
                accessibilityLabel="Decline invite"
              >
                <Text style={[styles.buttonText, { color: colors.text }]}>Decline</Text>
              </Pressable>
              <Pressable
                onPress={() => answer(true)}
                disabled={answering}
                style={[styles.button, { backgroundColor: colors.tint, opacity: answering ? 0.6 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel="Accept invite"
              >
                <Text style={[styles.buttonText, styles.primaryText]}>Accept</Text>
              </Pressable>
            </View>
          </Animated.View>
        ) : notice ? (
          <Animated.View entering={FadeInUp} exiting={FadeOutUp}>
            <Pressable
              onPress={clearNotice}
              style={[styles.card, styles.noticeCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              accessibilityRole="alert"
              accessibilityHint="Dismisses this message"
            >
              <Ionicons name="information-circle" size={20} color={colors.tint} />
              <Text style={[styles.noticeText, { color: colors.text }]}>
                {describeNotice(notice, notice.kind === "invite_closed" ? nameFor(notice.playerId) : "")}
              </Text>
            </Pressable>
          </Animated.View>
        ) : null}
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 480,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  inviteHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flex: 1, fontSize: 16, fontFamily: "Inter_600SemiBold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular" },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
  button: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12 },
  secondary: { borderWidth: 1 },
  buttonText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  primaryText: { color: "#fff" },
  noticeCard: { flexDirection: "row", alignItems: "center" },
  noticeText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
});
