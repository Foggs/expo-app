import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import type { ThemeColors } from "@/hooks/useThemeColors";

interface HomeHeroProps {
  colors: ThemeColors;
}

export default function HomeHero({ colors }: HomeHeroProps) {
  return (
    <>
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

        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          SketchDuel
        </Text>
      </View>

      <View style={styles.centerContent}>
        <View style={styles.gameInfo}>
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
    fontSize: 42,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
  },
  gameInfo: {
    gap: 20,
    alignItems: "center",
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
    fontSize: 17,
    fontFamily: "Inter_500Medium",
  },
});
