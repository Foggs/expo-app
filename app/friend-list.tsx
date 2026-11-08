import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSocial } from "@/contexts/SocialContext";
import { useScreenPadding } from "@/hooks/useScreenPadding";
import { useThemeColors, type ThemeColors } from "@/hooks/useThemeColors";
import { impactLight } from "@/lib/platformFeedback";
import type { FriendListEntry, FriendPresenceStatus, FriendVisibility } from "@/lib/social/friendsState";

const STATUS_LABEL: Record<FriendPresenceStatus, string> = {
  online: "Online",
  in_game: "In a game",
  busy: "Do Not Disturb",
  offline: "Offline",
};

function statusColor(status: FriendPresenceStatus, colors: ThemeColors): string {
  if (status === "online") return colors.success;
  if (status === "in_game") return colors.warning;
  if (status === "busy") return colors.error;
  return colors.tabIconDefault;
}

const VISIBILITY_OPTIONS: {
  value: FriendVisibility;
  label: string;
  description: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}[] = [
  {
    value: "visible",
    label: "Visible",
    description: "Friends see when you're online or in a game, and can invite you.",
    icon: "eye-outline",
  },
  {
    value: "appear_offline",
    label: "Appear Offline",
    description: "You show as offline and friends can't invite you. You can still invite them.",
    icon: "eye-off-outline",
  },
  {
    value: "do_not_disturb",
    label: "Do Not Disturb",
    description: "Friends see you're busy. Their invites are declined for you with a polite note.",
    icon: "moon-outline",
  },
];

/** Seconds left until `expiresAt`, updated every second. */
function useSecondsLeft(expiresAt: number | null): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (expiresAt === null) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [expiresAt]);
  return expiresAt === null ? 0 : Math.max(0, Math.ceil((expiresAt - now) / 1_000));
}

function openRoomCodeInstead() {
  impactLight();
  router.dismissTo({ pathname: "/", params: { useRoomCode: "1" } });
}

export default function FriendListScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeColors();
  const { topPadding, bottomPadding } = useScreenPadding(insets);
  const social = useSocial();
  const { availability, refreshFriends } = social;
  const [prompting, setPrompting] = useState(false);

  // Coming here is the moment to (re)load friends; this never shows Apple's prompt by itself.
  useEffect(() => {
    void refreshFriends({ prompt: false });
  }, [refreshFriends]);

  const handleBack = () => {
    impactLight();
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const allowAccess = async () => {
    impactLight();
    setPrompting(true);
    try {
      await refreshFriends({ prompt: true });
    } finally {
      setPrompting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 8 }]}>
        <Pressable
          onPress={handleBack}
          style={[styles.backButton, { backgroundColor: colors.card }]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          Friends
        </Text>
        <View style={styles.placeholder} />
      </View>

      {availability === "checking" ? (
        <Centered>
          <ActivityIndicator size="large" color={colors.tint} />
        </Centered>
      ) : availability === "unsupported" ? (
        <Explanation
          icon="logo-apple"
          title="Game Center friends are on iPhone and iPad"
          body="On this device, play with friends using a room code."
        />
      ) : availability === "not_signed_in" ? (
        <Explanation
          icon="person-circle-outline"
          title="Sign in to Game Center"
          body="Sign in to Game Center in the Settings app to see which of your friends play SketchDuel. You can still play friends with a room code."
        />
      ) : availability === "notDetermined" ? (
        <Explanation
          icon="people-outline"
          title="See your Game Center friends"
          body="SketchDuel can show which of your Game Center friends play, whether they're online, and let you invite them to a match. Your friends' names stay on this device."
          action={{ label: prompting ? "Asking…" : "Show My Friends", onPress: allowAccess, disabled: prompting }}
        />
      ) : availability === "denied" ? (
        <Explanation
          icon="lock-closed-outline"
          title="Friend access is turned off"
          body="To see your Game Center friends here, open the Settings app, go to Game Center, and allow SketchDuel to access your friends. Until then, play friends with a room code."
          action={{ label: "Open Settings", onPress: social.openSettings }}
        />
      ) : availability === "restricted" ? (
        <Explanation
          icon="lock-closed-outline"
          title="Friend access is restricted"
          body="Game Center friends aren't available on this device, for example because of Screen Time settings. You can still play friends with a room code."
        />
      ) : availability === "unavailable" ? (
        <Explanation
          icon="cloud-offline-outline"
          title="Couldn't load your friends"
          body="Game Center didn't return your friends list. Check your connection and try again, or use a room code."
          action={{ label: "Try Again", onPress: () => void refreshFriends({ prompt: false }) }}
        />
      ) : !social.connected || !social.loaded ? (
        <Centered>
          <ActivityIndicator size="large" color={colors.tint} />
          <Text style={[styles.hint, { color: colors.textSecondary }]}>Checking who&apos;s online…</Text>
        </Centered>
      ) : (
        <FlatList
          data={social.friends}
          keyExtractor={(item) => item.playerId}
          renderItem={({ item }) => <FriendRow friend={item} />}
          ListHeaderComponent={
            <>
              <VisibilitySetting />
              <OutgoingInvite />
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyList}>
              <Ionicons name="people-outline" size={40} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No friends here yet</Text>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                None of your Game Center friends play SketchDuel yet. Share a room code to play with someone.
              </Text>
            </View>
          }
          ListFooterComponent={
            <Pressable onPress={openRoomCodeInstead} style={styles.footerLink} accessibilityRole="button">
              <Text style={[styles.linkText, { color: colors.tint }]}>Play with a room code instead</Text>
            </Pressable>
          }
          contentContainerStyle={[styles.list, { paddingBottom: bottomPadding + 20 }]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

function Explanation({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  body: string;
  action?: { label: string; onPress: () => void; disabled?: boolean };
}) {
  const { colors } = useThemeColors();
  return (
    <Centered>
      <Ionicons name={icon} size={48} color={colors.border} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>{body}</Text>
      {action && (
        <Pressable
          onPress={action.onPress}
          disabled={action.disabled}
          style={[styles.primaryButton, { backgroundColor: colors.tint, opacity: action.disabled ? 0.6 : 1 }]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !!action.disabled }}
        >
          <Text style={styles.primaryButtonText}>{action.label}</Text>
        </Pressable>
      )}
      <Pressable onPress={openRoomCodeInstead} style={styles.footerLink} accessibilityRole="button">
        <Text style={[styles.linkText, { color: colors.tint }]}>Use a room code</Text>
      </Pressable>
    </Centered>
  );
}

/** How friends see this player. Shown only to players signed in with Game Center. */
function VisibilitySetting() {
  const { colors } = useThemeColors();
  const { visibility, visibilitySaving, setVisibility, connected } = useSocial();
  if (!visibility) return null;
  const selected = visibilitySaving ?? visibility;

  return (
    <View style={[styles.settingCard, { backgroundColor: colors.card }]}>
      <View style={styles.settingHeader}>
        <Text style={[styles.settingTitle, { color: colors.text }]} accessibilityRole="header">
          How friends see you
        </Text>
        {visibilitySaving && <ActivityIndicator size="small" color={colors.tint} accessibilityLabel="Saving" />}
      </View>
      <View accessibilityRole="radiogroup" style={styles.optionList}>
        {VISIBILITY_OPTIONS.map((option) => {
          const isSelected = selected === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => {
                impactLight();
                setVisibility(option.value);
              }}
              disabled={!connected}
              style={[
                styles.option,
                {
                  borderColor: isSelected ? colors.tint : colors.border,
                  backgroundColor: isSelected ? colors.background : "transparent",
                },
              ]}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityHint={option.description}
              accessibilityState={{ checked: isSelected, disabled: !connected }}
            >
              <Ionicons name={option.icon} size={20} color={isSelected ? colors.tint : colors.textSecondary} />
              <View style={styles.optionText}>
                <Text style={[styles.optionLabel, { color: colors.text }]}>{option.label}</Text>
                <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>{option.description}</Text>
              </View>
              <Ionicons
                name={isSelected ? "radio-button-on" : "radio-button-off"}
                size={20}
                color={isSelected ? colors.tint : colors.border}
              />
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.settingFootnote, { color: colors.textSecondary }]}>
        Applies on all your devices signed in to this Game Center account.
      </Text>
    </View>
  );
}

function OutgoingInvite() {
  const { colors } = useThemeColors();
  const { outgoing, nameFor, cancelInvite } = useSocial();
  const secondsLeft = useSecondsLeft(outgoing?.expiresAt ?? null);
  if (!outgoing) return null;
  return (
    <View
      style={[styles.waitingCard, { backgroundColor: colors.card, borderColor: colors.tint }]}
      accessibilityLiveRegion="polite"
    >
      <ActivityIndicator color={colors.tint} />
      <Text style={[styles.waitingText, { color: colors.text }]}>
        Waiting for {nameFor(outgoing.playerId)}… {secondsLeft}s
      </Text>
      <Pressable
        onPress={() => {
          impactLight();
          cancelInvite();
        }}
        style={[styles.secondaryButton, { borderColor: colors.border }]}
        accessibilityRole="button"
        accessibilityLabel="Cancel invite"
      >
        <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Cancel</Text>
      </Pressable>
    </View>
  );
}

function FriendRow({ friend }: { friend: FriendListEntry }) {
  const { colors } = useThemeColors();
  const { outgoing, sending, inviteFriend } = useSocial();
  const isSending = sending === friend.playerId;
  const isInvited = outgoing?.playerId === friend.playerId;
  const busy = !!outgoing || !!sending;
  const dot = statusColor(friend.status, colors);

  return (
    <View
      style={[styles.row, { backgroundColor: colors.card }]}
      accessibilityLabel={`${friend.displayName}, ${STATUS_LABEL[friend.status]}`}
    >
      <View style={[styles.avatar, { backgroundColor: colors.background }]}>
        <Text style={[styles.avatarText, { color: colors.tint }]}>
          {friend.displayName.trim().charAt(0).toUpperCase() || "?"}
        </Text>
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {friend.displayName}
        </Text>
        <View style={styles.statusLine}>
          <View style={[styles.statusDot, { backgroundColor: dot }]} />
          <Text style={[styles.statusText, { color: colors.textSecondary }]}>{STATUS_LABEL[friend.status]}</Text>
        </View>
      </View>
      {(friend.status === "online" || friend.status === "busy") &&
        (isSending || isInvited ? (
          <View style={styles.invitedTag}>
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>
              {isSending ? "Sending…" : "Invited"}
            </Text>
          </View>
        ) : (
          <Pressable
            onPress={() => {
              impactLight();
              inviteFriend(friend.playerId);
            }}
            disabled={busy}
            style={[styles.inviteButton, { backgroundColor: colors.tint, opacity: busy ? 0.5 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel={`Invite ${friend.displayName} to a match`}
            accessibilityState={{ disabled: busy }}
          >
            <Text style={styles.inviteButtonText}>Invite</Text>
          </Pressable>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 20, fontFamily: "Inter_600SemiBold" },
  placeholder: { width: 44 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, paddingHorizontal: 36 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  hint: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  primaryButton: { marginTop: 8, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 14 },
  primaryButtonText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  footerLink: { alignSelf: "center", paddingVertical: 12, paddingHorizontal: 12 },
  linkText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  list: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  emptyList: { alignItems: "center", gap: 10, paddingVertical: 32, paddingHorizontal: 20 },
  settingCard: { padding: 14, borderRadius: 14, gap: 10, marginBottom: 6 },
  settingHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  settingTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  optionList: { gap: 8 },
  option: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  optionText: { flex: 1, gap: 2 },
  optionLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  optionDescription: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  settingFootnote: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16 },
  waitingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 6,
  },
  waitingText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  secondaryButton: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1 },
  secondaryButtonText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 17, fontFamily: "Inter_700Bold" },
  rowText: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  statusLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  invitedTag: { paddingHorizontal: 8 },
  inviteButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10 },
  inviteButtonText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
