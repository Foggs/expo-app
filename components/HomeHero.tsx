import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { ThemeColors } from "@/hooks/useThemeColors";

const SPLASH_ICON = require("@/assets/images/splash-icon.png");

interface HomeHeroProps {
  colors: ThemeColors;
  /** Game Center name of the signed-in player, when available. */
  playerName?: string | null;
  /** Opens Settings from the gear at the top. */
  onOpenSettings?: () => void;
}

/** Scales the heading with screen width so it never clips on narrow phones. */
function titleFontSize(screenWidth: number): number {
  return Math.round(Math.max(30, Math.min(48, screenWidth * 0.11)));
}

export default function HomeHero({ colors, playerName, onOpenSettings }: HomeHeroProps) {
  const { width, height } = useWindowDimensions();
  const fontSize = titleFontSize(width);
  // Tighter spacing on short phones keeps both play buttons near the first screen.
  const compact = height < 700;

  return (
    <>
      <View style={styles.topBar}>
        {onOpenSettings ? (
          <Pressable
            onPress={onOpenSettings}
            style={({ pressed }) => [styles.settingsButton, { backgroundColor: colors.card }, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            accessibilityHint="Appearance, haptics, privacy, feedback and app information"
            hitSlop={6}
          >
            <Ionicons name="settings-outline" size={22} color={colors.text} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.header}>
        <Image source={SPLASH_ICON} style={styles.logo} resizeMode="contain" accessibilityLabel="SketchDuel logo" />

        <Text
          style={[styles.title, { color: colors.text, fontSize, lineHeight: Math.round(fontSize * 1.2) }]}
          accessibilityRole="header"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          maxFontSizeMultiplier={1.2}
        >
          SketchDuel
        </Text>

        {playerName ? (
          <View
            style={[styles.playerBadge, { backgroundColor: colors.card }]}
            accessible={true}
            accessibilityLabel={`Signed in to Game Center as ${playerName}`}
          >
            <Ionicons name="game-controller" size={16} color={colors.tint} />
            <Text
              style={[styles.playerName, { color: colors.text }]}
              numberOfLines={1}
            >
              {playerName}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.centerContent, compact && styles.centerContentCompact]} />
    </>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    minHeight: 44,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.7,
  },
  header: {
    alignItems: "center",
    gap: 16,
  },
  logo: {
    width: 80,
    height: 80,
  },
  title: {
    maxWidth: "100%",
    fontFamily: "Inter_700Bold",
    letterSpacing: -1,
    textAlign: "center",
  },
  playerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: 260,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginTop: -4,
  },
  playerName: {
    flexShrink: 1,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  centerContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 24,
  },
  centerContentCompact: {
    paddingVertical: 12,
  },
});
