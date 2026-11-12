import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { ThemeColors } from "@/hooks/useThemeColors";

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
        <View style={styles.logoContainer}>
          <View style={[styles.brushStroke, { backgroundColor: colors.tint }]} />
          <View
            style={[
              styles.brushStroke,
              styles.brushStroke2,
              { backgroundColor: colors.accent },
            ]}
          />
        </View>

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

      <View style={[styles.centerContent, compact && styles.centerContentCompact]}>
        <View style={[styles.gameInfo, compact && styles.gameInfoCompact]}>
          <View style={styles.infoRow} accessible={true} accessibilityLabel="2 Players per game">
            <View style={[styles.iconContainer, { backgroundColor: colors.card }]}> 
              <Ionicons name="people" size={24} color={colors.tint} />
            </View>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>2 Players</Text>
          </View>

          <View style={styles.infoRow} accessible={true} accessibilityLabel="1 Minute per Turn">
            <View style={[styles.iconContainer, { backgroundColor: colors.card }]}> 
              <Ionicons name="timer" size={24} color={colors.accent} />
            </View>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>1 Minute per Turn</Text>
          </View>

          <View style={styles.infoRow} accessible={true} accessibilityLabel="3 Rounds per game">
            <View style={[styles.iconContainer, { backgroundColor: colors.card }]}> 
              <Ionicons name="repeat" size={24} color={colors.accentSecondary} />
            </View>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>3 Rounds</Text>
          </View>
        </View>
      </View>
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
  gameInfo: {
    gap: 20,
    alignItems: "center",
  },
  gameInfoCompact: {
    gap: 10,
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
    flexShrink: 1,
    fontSize: 17,
    fontFamily: "Inter_500Medium",
  },
});
