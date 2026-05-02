import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ThemeColors } from "@/hooks/useThemeColors";
import type { PlayerId } from "@/hooks/useTurnFlow";

export interface GameTurnIndicatorProps {
  colors: ThemeColors;
  currentPlayer: PlayerId | null;
  turnDisplay: string;
  isMyTurn: boolean;
  opponentName: string;
}

function GameTurnIndicator({
  colors,
  currentPlayer,
  turnDisplay,
  isMyTurn,
  opponentName,
}: GameTurnIndicatorProps) {
  return (
    <View style={styles.turnIndicator}>
      <View
        style={[
          styles.playerDot,
          {
            backgroundColor:
              currentPlayer === "player1" ? colors.player1 : colors.player2,
          },
        ]}
      />
      <Text
        style={[styles.turnText, { color: colors.text }]}
        accessibilityLabel={turnDisplay}
        accessibilityLiveRegion="assertive"
      >
        {turnDisplay}
      </Text>
      {!isMyTurn && (
        <Text style={[styles.opponentLabel, { color: colors.textSecondary }]}>({opponentName})</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  opponentLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
});

export default React.memo(GameTurnIndicator);
