import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import type { ThemeColors } from "@/hooks/useThemeColors";

interface HomePrimaryActionsProps {
  colors: ThemeColors;
  pulseStyle: any;
  buttonAnimatedStyle: any;
  isSearching: boolean;
  onOpenGallery: () => void;
  /** Opens the Play with Friends hub (invite codes and Game Center friends). */
  onOpenFriends: () => void;
  onFindMatch: () => void;
  onPressIn: () => void;
  onPressOut: () => void;
}

export default function HomePrimaryActions({
  colors,
  pulseStyle,
  buttonAnimatedStyle,
  isSearching,
  onOpenGallery,
  onOpenFriends,
  onFindMatch,
  onPressIn,
  onPressOut,
}: HomePrimaryActionsProps) {
  return (
    <View style={styles.container}>
      <View style={styles.randomPlay}>
        <Animated.View style={[styles.pulseRing, pulseStyle]} pointerEvents="none">
          <LinearGradient
            colors={[colors.tint, colors.accent]}
            style={styles.pulseGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </Animated.View>

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
            style={{ opacity: isSearching ? 0.6 : 1 }}
          >
            <LinearGradient
              colors={[colors.tint, colors.accent]}
              style={styles.randomPlayButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="shuffle" size={24} color="#fff" />
              <Text style={styles.randomPlayText} numberOfLines={1} maxFontSizeMultiplier={1.4}>
                Random Play
              </Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>

      <Pressable
        onPress={onOpenFriends}
        style={({ pressed }) => [
          styles.friendsButton,
          { borderColor: colors.tint, backgroundColor: colors.card },
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Play with Friends"
        accessibilityHint="Share an invite code to play with your friends"
      >
        <View style={[styles.friendsIcon, { backgroundColor: colors.tint + "1A" }]}>
          <Ionicons name="people" size={22} color={colors.tint} />
        </View>
        <View style={styles.friendsText}>
          <Text style={[styles.friendsTitle, { color: colors.text }]} maxFontSizeMultiplier={1.4}>
            Play with Friends
          </Text>
          <Text style={[styles.friendsSubtitle, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.4}>
            Share an invite code to play with your friends
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </Pressable>

      <Pressable
        onPress={onOpenGallery}
        style={({ pressed }) => [styles.galleryButton, { backgroundColor: colors.card }, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Gallery"
        accessibilityHint="Shows your saved drawings"
      >
        <Ionicons name="images" size={18} color={colors.tint} />
        <Text style={[styles.galleryButtonText, { color: colors.text }]} maxFontSizeMultiplier={1.4}>
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
    gap: 14,
    paddingTop: 16,
  },
  randomPlay: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  fullWidth: {
    width: "100%",
  },
  pulseRing: {
    position: "absolute",
    left: 6,
    right: 6,
    top: 0,
    bottom: 0,
    borderRadius: 34,
    overflow: "hidden",
  },
  pulseGradient: {
    flex: 1,
  },
  randomPlayButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    minHeight: 60,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 28,
  },
  randomPlayText: {
    color: "#fff",
    fontSize: 19,
    fontFamily: "Inter_600SemiBold",
  },
  friendsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  friendsIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  friendsText: {
    flex: 1,
    gap: 2,
  },
  friendsTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  friendsSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  galleryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "center",
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 22,
  },
  galleryButtonText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  pressed: {
    opacity: 0.82,
  },
});
