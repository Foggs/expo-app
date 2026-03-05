import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { ThemeColors } from "@/hooks/useThemeColors";

interface ResultsActionButtonsProps {
  colors: ThemeColors;
  drawingsLength: number;
  isSaving: boolean;
  isSaved: boolean;
  onSaveToGallery: () => void;
  onPlayAgain: () => void;
  onHome: () => void;
  onViewGallery: () => void;
}

export default function ResultsActionButtons({
  colors,
  drawingsLength,
  isSaving,
  isSaved,
  onSaveToGallery,
  onPlayAgain,
  onHome,
  onViewGallery,
}: ResultsActionButtonsProps) {
  return (
    <View style={styles.actions}>
      <Pressable
        onPress={onSaveToGallery}
        disabled={isSaving || isSaved || drawingsLength === 0}
        accessibilityRole="button"
        accessibilityLabel={isSaved ? "Drawing saved to gallery" : "Save drawing to gallery"}
      >
        <LinearGradient
          colors={isSaved ? ["#27ae60", "#2ecc71"] : [colors.accentSecondary, colors.accent]}
          style={[
            styles.primaryButton,
            (isSaving || isSaved || drawingsLength === 0) && styles.buttonDisabledStyle,
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name={isSaved ? "checkmark-circle" : "save"} size={22} color="#fff" />
          )}
          <Text style={styles.primaryButtonText}>{isSaved ? "Saved" : "Save to Gallery"}</Text>
        </LinearGradient>
      </Pressable>

      <Pressable
        onPress={onPlayAgain}
        accessibilityRole="button"
        accessibilityLabel="Play another match"
      >
        <LinearGradient
          colors={[colors.tint, colors.accent]}
          style={styles.primaryButton}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="refresh" size={22} color="#fff" />
          <Text style={styles.primaryButtonText}>Play Again</Text>
        </LinearGradient>
      </Pressable>

      <Pressable
        onPress={onHome}
        style={[styles.secondaryButton, { borderColor: colors.border }]}
        accessibilityRole="button"
        accessibilityLabel="Return to home screen"
      >
        <Ionicons name="home" size={22} color={colors.text} />
        <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Home</Text>
      </Pressable>

      <Pressable
        onPress={onViewGallery}
        style={[styles.secondaryButton, { borderColor: colors.border, marginTop: 4 }]}
        accessibilityRole="button"
        accessibilityLabel="View gallery"
      >
        <Ionicons name="images" size={22} color={colors.text} />
        <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Gallery</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    marginTop: 32,
    gap: 12,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  buttonDisabledStyle: {
    opacity: 0.7,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
  },
  secondaryButtonText: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
});
