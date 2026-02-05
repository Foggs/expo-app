import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";

export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const handleEndGame = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push("/results");
  };

  const handleBack = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 8 }]}>
        <Pressable
          onPress={handleBack}
          style={[styles.backButton, { backgroundColor: colors.card }]}
          accessibilityRole="button"
          accessibilityLabel="Go back to home"
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>

        <View style={styles.timerContainer}>
          <View style={[styles.timerBadge, { backgroundColor: colors.card }]}>
            <Ionicons name="timer" size={20} color={colors.timerActive} />
            <Text style={[styles.timerText, { color: colors.text }]}>2:00</Text>
          </View>
        </View>

        <View style={styles.roundBadge}>
          <Text style={[styles.roundText, { color: colors.textSecondary }]}>
            Round 1/3
          </Text>
        </View>
      </View>

      <View style={styles.turnIndicator}>
        <View style={[styles.playerDot, { backgroundColor: colors.player1 }]} />
        <Text style={[styles.turnText, { color: colors.text }]}>
          Your Turn to Draw
        </Text>
      </View>

      <View style={styles.canvasContainer}>
        <View
          style={[
            styles.canvas,
            {
              backgroundColor: colors.canvasBackground,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.canvasPlaceholder}>
            <Ionicons name="brush" size={48} color={colors.textSecondary} />
            <Text
              style={[styles.placeholderText, { color: colors.textSecondary }]}
            >
              Drawing canvas will be here
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.toolbar, { paddingBottom: bottomPadding + 8 }]}>
        <View style={styles.toolGroup}>
          <View style={[styles.toolButton, { backgroundColor: colors.card }]}>
            <Ionicons name="brush" size={22} color={colors.tint} />
          </View>
          <View style={[styles.toolButton, { backgroundColor: colors.card }]}>
            <View
              style={[styles.colorSwatch, { backgroundColor: colors.tint }]}
            />
          </View>
          <View style={[styles.toolButton, { backgroundColor: colors.card }]}>
            <Ionicons name="remove" size={22} color={colors.textSecondary} />
          </View>
        </View>

        <View style={styles.toolGroup}>
          <View style={[styles.toolButton, { backgroundColor: colors.card }]}>
            <Ionicons
              name="arrow-undo"
              size={22}
              color={colors.textSecondary}
            />
          </View>
          <View style={[styles.toolButton, { backgroundColor: colors.card }]}>
            <Ionicons name="trash" size={22} color={colors.error} />
          </View>
        </View>

        <Pressable
          onPress={handleEndGame}
          style={[styles.submitButton, { backgroundColor: colors.tint }]}
          accessibilityRole="button"
          accessibilityLabel="Submit your drawing"
        >
          <Ionicons name="checkmark" size={24} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  timerContainer: {
    flex: 1,
    alignItems: "center",
  },
  timerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  timerText: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
  },
  roundBadge: {
    width: 44,
    alignItems: "flex-end",
  },
  roundText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  turnIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
  },
  playerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  turnText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  canvasContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  canvas: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 2,
    overflow: "hidden",
  },
  canvasPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  placeholderText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  toolGroup: {
    flexDirection: "row",
    gap: 8,
  },
  toolButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  submitButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
});
