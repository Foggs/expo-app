import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import type { ThemeColors } from "@/hooks/useThemeColors";

interface HomePrimaryActionsProps {
  colors: ThemeColors;
  isSearching: boolean;
  pulseStyle: any;
  buttonAnimatedStyle: any;
  onOpenGallery: () => void;
  onFindMatch: () => void;
  onPressIn: () => void;
  onPressOut: () => void;
}

export default function HomePrimaryActions({
  colors,
  isSearching,
  pulseStyle,
  buttonAnimatedStyle,
  onOpenGallery,
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
            onPress={onFindMatch}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
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
});
