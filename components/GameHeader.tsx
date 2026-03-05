import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import type { ThemeColors } from "@/hooks/useThemeColors";

export interface GameHeaderProps {
  colors: ThemeColors;
  topPadding: number;
  onBack: () => void;
  timerAnimatedStyle: any;
  timerColor: string;
  formattedTime: string;
  roundDisplay: string;
}

export default function GameHeader({
  colors,
  topPadding,
  onBack,
  timerAnimatedStyle,
  timerColor,
  formattedTime,
  roundDisplay,
}: GameHeaderProps) {
  return (
    <View style={[styles.header, { paddingTop: topPadding + 8 }]}> 
      <Pressable
        onPress={onBack}
        style={[styles.backButton, { backgroundColor: colors.card }]}
        accessibilityRole="button"
        accessibilityLabel="Go back to home"
      >
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </Pressable>

      <View style={styles.timerContainer}>
        <Animated.View
          style={[
            styles.timerBadge,
            { backgroundColor: colors.card },
            timerAnimatedStyle,
          ]}
        >
          <Ionicons name="timer" size={20} color={timerColor} />
          <Text
            style={[styles.timerText, { color: timerColor }]}
            accessibilityLabel={`Time remaining: ${formattedTime}`}
            accessibilityRole="timer"
          >
            {formattedTime}
          </Text>
        </Animated.View>
      </View>

      <View style={styles.roundBadge}>
        <Text
          style={[styles.roundText, { color: colors.textSecondary }]}
          accessibilityLabel={roundDisplay}
        >
          {roundDisplay}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    width: 70,
    alignItems: "flex-end",
  },
  roundText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
});
