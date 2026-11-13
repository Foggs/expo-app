import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated from "react-native-reanimated";
import type { ThemeColors } from "@/hooks/useThemeColors";

interface HomePrimaryActionsProps {
  colors: ThemeColors;
  randomShineStyle: any;
  friendsShineStyle: any;
  buttonAnimatedStyle: any;
  isSearching: boolean;
  onOpenGallery: () => void;
  onOpenHowToPlay: () => void;
  /** Opens the Play with Friends hub (invite codes and Game Center friends). */
  onOpenFriends: () => void;
  onFindMatch: () => void;
  onPressIn: () => void;
  onPressOut: () => void;
}

function ButtonShine({ animatedStyle, colors }: { animatedStyle: any; colors: ThemeColors }) {
  return (
    <View pointerEvents="none" style={styles.shineMask}>
      <Animated.View style={[styles.shine, animatedStyle]}>
        <LinearGradient
          colors={[colors.tint + "00", colors.tint + "60", colors.accent + "70", colors.accent + "00"]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        />
      </Animated.View>
    </View>
  );
}

export default function HomePrimaryActions({
  ...props
}: HomePrimaryActionsProps) {
  return (
    <View style={styles.container}>
      <HomePlayActions {...props} />
      <HomeSecondaryActions {...props} />
    </View>
  );
}

type HomePlayActionsProps = Pick<
  HomePrimaryActionsProps,
  | "colors"
  | "randomShineStyle"
  | "friendsShineStyle"
  | "buttonAnimatedStyle"
  | "isSearching"
  | "onOpenHowToPlay"
  | "onOpenFriends"
  | "onFindMatch"
  | "onPressIn"
  | "onPressOut"
>;

export function HomePlayActions({
  colors,
  randomShineStyle,
  friendsShineStyle,
  buttonAnimatedStyle,
  isSearching,
  onOpenHowToPlay,
  onOpenFriends,
  onFindMatch,
  onPressIn,
  onPressOut,
}: HomePlayActionsProps) {
  const { height } = useWindowDimensions();
  const compact = height < 650;

  return (
    <View style={[styles.playActions, compact && styles.playActionsCompact]}>
      <Animated.View style={[styles.fullWidth, buttonAnimatedStyle]}>
        <Pressable
          onPress={isSearching ? undefined : onFindMatch}
          onPressIn={isSearching ? undefined : onPressIn}
          onPressOut={isSearching ? undefined : onPressOut}
          disabled={isSearching}
          accessibilityRole="button"
          accessibilityLabel="Random Play"
          accessibilityHint="Matches you with another player for a drawing game"
          accessibilityState={{ disabled: isSearching }}
          style={({ pressed }) => [
            styles.actionButton,
            compact && styles.actionButtonCompact,
            { borderColor: colors.tint, backgroundColor: colors.card },
            isSearching && styles.disabled,
            pressed && !isSearching && styles.pressed,
          ]}
        >
          <ButtonShine animatedStyle={randomShineStyle} colors={colors} />
          <View style={[styles.actionIcon, { backgroundColor: colors.tint + "1A" }]}>
            <Ionicons name="shuffle" size={22} color={colors.tint} />
          </View>
          <View style={styles.actionText}>
            <Text style={[styles.actionTitle, { color: colors.text }]} maxFontSizeMultiplier={1.4}>
              Random Play
            </Text>
            <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.4}>
              Find a player for a live drawing game
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </Pressable>
      </Animated.View>

      <Pressable
        onPress={onOpenFriends}
        style={({ pressed }) => [
          styles.actionButton,
          compact && styles.actionButtonCompact,
          { borderColor: colors.tint, backgroundColor: colors.card },
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Play with Friends"
        accessibilityHint="Share an invite code to play with your friends"
      >
        <ButtonShine animatedStyle={friendsShineStyle} colors={colors} />
        <View style={[styles.actionIcon, { backgroundColor: colors.tint + "1A" }]}>
          <Ionicons name="people" size={22} color={colors.tint} />
        </View>
        <View style={styles.actionText}>
          <Text style={[styles.actionTitle, { color: colors.text }]} maxFontSizeMultiplier={1.4}>
            Play with Friends
          </Text>
          <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.4}>
            Share an invite code to play with your friends
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </Pressable>
      <HowToPlayButton colors={colors} onPress={onOpenHowToPlay} compact={compact} />
    </View>
  );
}

function HowToPlayButton({
  colors,
  onPress,
  compact,
}: {
  colors: ThemeColors;
  onPress: () => void;
  compact: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        styles.howToPlayButton,
        compact && styles.secondaryButtonCompact,
        { backgroundColor: colors.card },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel="How to Play"
      accessibilityHint="Shows the quick game rules"
    >
      <Ionicons name="book-outline" size={18} color={colors.tint} />
      <Text style={[styles.secondaryText, { color: colors.text }]} maxFontSizeMultiplier={1.4}>
        How to Play
      </Text>
    </Pressable>
  );
}

type HomeSecondaryActionsProps = Pick<
  HomePrimaryActionsProps,
  "colors" | "onOpenGallery"
>;

export function HomeSecondaryActions({
  colors,
  onOpenGallery,
}: HomeSecondaryActionsProps) {
  const { height } = useWindowDimensions();
  const compact = height < 650;

  return (
      <View style={[styles.secondaryActions, compact && styles.secondaryActionsCompact]}>
        <Pressable
          onPress={onOpenGallery}
          style={({ pressed }) => [
            styles.secondaryButton,
            compact && styles.secondaryButtonCompact,
            { backgroundColor: colors.card },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Gallery"
          accessibilityHint="Shows your saved drawings"
        >
          <Ionicons name="images" size={18} color={colors.tint} />
          <Text style={[styles.secondaryText, { color: colors.text }]} maxFontSizeMultiplier={1.4}>
            Gallery
          </Text>
        </Pressable>
      </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    maxWidth: 380,
    alignSelf: "center",
    gap: 20,
  },
  playActions: {
    width: "100%",
    gap: 14,
  },
  playActionsCompact: {
    gap: 10,
  },
  fullWidth: {
    width: "100%",
  },
  actionButton: {
    position: "relative",
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 84,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  actionButtonCompact: {
    minHeight: 72,
    paddingVertical: 8,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  actionSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  shineMask: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
    borderRadius: 18,
  },
  shine: {
    position: "absolute",
    top: -16,
    bottom: -16,
    width: 48,
    transform: [{ rotate: "22deg" }],
  },
  secondaryActions: {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  secondaryActionsCompact: {
    gap: 6,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "center",
    width: 136,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 22,
  },
  howToPlayButton: {
    marginTop: 6,
  },
  secondaryButtonCompact: {
    minHeight: 40,
    paddingVertical: 8,
  },
  secondaryText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.82,
  },
});
