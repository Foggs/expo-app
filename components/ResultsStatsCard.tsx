import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import type { ThemeColors } from "@/hooks/useThemeColors";

interface ResultsStatsCardProps {
  colors: ThemeColors;
  cardStyle: any;
}

export default function ResultsStatsCard({ colors, cardStyle }: ResultsStatsCardProps) {
  return (
    <Animated.View style={[styles.artworkCard, cardStyle]}>
      <View style={styles.statsRow}>
        <View
          style={styles.statItem}
          accessible={true}
          accessibilityLabel="3 Rounds played"
        >
          <Ionicons name="brush" size={20} color={colors.tint} />
          <Text style={[styles.statValue, { color: colors.text }]}>3</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Rounds</Text>
        </View>

        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

        <View
          style={styles.statItem}
          accessible={true}
          accessibilityLabel="6 minutes total time"
        >
          <Ionicons name="time" size={20} color={colors.accent} />
          <Text style={[styles.statValue, { color: colors.text }]}>6:00</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Time</Text>
        </View>

        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

        <View
          style={styles.statItem}
          accessible={true}
          accessibilityLabel="2 Artists competed"
        >
          <Ionicons name="people" size={20} color={colors.accentSecondary} />
          <Text style={[styles.statValue, { color: colors.text }]}>2</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Artists</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  artworkCard: {
    gap: 16,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  statItem: {
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  statDivider: {
    width: 1,
    height: 40,
  },
});
