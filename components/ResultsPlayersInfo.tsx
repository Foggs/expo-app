import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import type { ThemeColors } from "@/hooks/useThemeColors";

interface ResultsPlayersInfoProps {
  colors: ThemeColors;
  opponentName?: string;
}

export default function ResultsPlayersInfo({
  colors,
  opponentName,
}: ResultsPlayersInfoProps) {
  return (
    <View style={styles.playersInfo}>
      <View
        style={styles.playerCard}
        accessible={true}
        accessibilityLabel="Player 1: You"
      >
        <View style={[styles.playerAvatar, { backgroundColor: colors.player1 }]}> 
          <Text style={styles.avatarText}>P1</Text>
        </View>
        <Text style={[styles.playerName, { color: colors.text }]}>You</Text>
      </View>

      <Ionicons name="heart" size={24} color={colors.accentSecondary} />

      <View
        style={styles.playerCard}
        accessible={true}
        accessibilityLabel={"Player 2: " + (opponentName ?? "Opponent")}
      >
        <View style={[styles.playerAvatar, { backgroundColor: colors.player2 }]}> 
          <Text style={styles.avatarText}>P2</Text>
        </View>
        <Text style={[styles.playerName, { color: colors.text }]}>
          {opponentName ?? "Opponent"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  playersInfo: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
    marginTop: 24,
  },
  playerCard: {
    alignItems: "center",
    gap: 8,
  },
  playerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  playerName: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
