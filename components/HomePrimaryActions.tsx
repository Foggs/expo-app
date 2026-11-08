import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import type { ThemeColors } from "@/hooks/useThemeColors";
import { openPrivacyPolicy } from "@/lib/privacyPolicy";
import { openSupportContact } from "@/lib/supportContact";

interface HomePrimaryActionsProps {
  colors: ThemeColors;
  pulseStyle: any;
  buttonAnimatedStyle: any;
  isSearching: boolean;
  onOpenGallery: () => void;
  onOpenFriends: () => void;
  /** Opens the Game Center friends list. Omitted where Game Center is not available. */
  onOpenFriendList?: () => void;
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
  onOpenFriendList,
  onFindMatch,
  onPressIn,
  onPressOut,
}: HomePrimaryActionsProps) {
  return (
    <>
      <Pressable
        onPress={onOpenGallery}
        style={[styles.galleryButton, { backgroundColor: colors.card }]}
        accessibilityRole="button"
        accessibilityLabel="View saved drawings gallery"
      >
        <Ionicons name="images" size={20} color={colors.tint} />
        <Text style={[styles.galleryButtonText, { color: colors.text }]}>Gallery</Text>
      </Pressable>

      <Pressable
        onPress={onOpenFriends}
        style={[
          styles.friendButton,
          { borderColor: colors.tint, backgroundColor: colors.card },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Start a friends match"
        accessibilityHint="Create or join a private room with a friend"
      >
        <Ionicons name="people" size={20} color={colors.tint} />
        <Text style={[styles.friendButtonText, { color: colors.text }]}>Friends Match</Text>
      </Pressable>

      {onOpenFriendList && (
        <Pressable
          onPress={onOpenFriendList}
          style={[styles.galleryButton, { backgroundColor: colors.card }]}
          accessibilityRole="button"
          accessibilityLabel="Game Center friends"
          accessibilityHint="See which friends are online and invite them to a match"
        >
          <Ionicons name="person-add" size={20} color={colors.tint} />
          <Text style={[styles.galleryButtonText, { color: colors.text }]}>Game Center Friends</Text>
        </Pressable>
      )}

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
            onPress={isSearching ? undefined : onFindMatch}
            onPressIn={isSearching ? undefined : onPressIn}
            onPressOut={isSearching ? undefined : onPressOut}
            disabled={isSearching}
            accessibilityRole="button"
            accessibilityLabel="Find a match to play"
            accessibilityHint="Searches for another player to start a drawing game"
            accessibilityState={{ disabled: isSearching }}
            style={{ opacity: isSearching ? 0.6 : 1 }}
          >
            <LinearGradient
              colors={[colors.tint, colors.accent]}
              style={styles.findMatchButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="search" size={24} color="#fff" />
              <Text style={styles.buttonText}>Find Match</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>

      <Pressable
        onPress={openPrivacyPolicy}
        style={styles.privacyLink}
        accessibilityRole="link"
        accessibilityLabel="Privacy Policy"
        accessibilityHint="Opens the SketchDuel privacy policy"
        hitSlop={8}
      >
        <Text style={[styles.privacyLinkText, { color: colors.textSecondary }]}>
          Privacy Policy
        </Text>
      </Pressable>
      <Pressable
        onPress={openSupportContact}
        style={styles.privacyLink}
        accessibilityRole="link"
        accessibilityLabel="Contact Support"
        accessibilityHint="Opens an email to SketchDuel support"
        hitSlop={8}
      >
        <Text style={[styles.privacyLinkText, { color: colors.textSecondary }]}>
          Contact Support
        </Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  galleryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginBottom: 8,
  },
  galleryButtonText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  friendButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "center",
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginBottom: 8,
  },
  friendButtonText: {
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
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  privacyLink: {
    alignSelf: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  privacyLinkText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textDecorationLine: "underline",
  },
});
