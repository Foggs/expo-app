import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import DrawingThumbnail from "@/components/DrawingThumbnail";
import type { ThemeColors } from "@/hooks/useThemeColors";
import type { RoundDrawing } from "@/lib/gameStore";

export interface ResultsRoundGalleryProps {
  colors: ThemeColors;
  roundNumbers: number[];
  drawings: RoundDrawing[];
  playerRole: string;
  opponentName?: string;
}

export default function ResultsRoundGallery({
  colors,
  roundNumbers,
  drawings,
  playerRole,
  opponentName,
}: ResultsRoundGalleryProps) {
  return (
    <View style={styles.gallerySection}>
      <Text
        style={[styles.gallerySectionTitle, { color: colors.text }]}
        accessibilityRole="header"
      >
        Round Gallery
      </Text>
      {roundNumbers.length === 0 ? (
        <Text style={[styles.noDrawingsText, { color: colors.textSecondary }]}>No drawings recorded</Text>
      ) : (
        roundNumbers.map((roundNum) => {
          const roundDrawings = drawings.filter((d) => d.round === roundNum);
          const myDrawing = roundDrawings.find((d) => d.playerRole === playerRole);
          const opponentDrawing = roundDrawings.find((d) => d.playerRole !== playerRole);

          return (
            <View key={roundNum} style={styles.roundBlock}>
              <Text
                style={[styles.roundLabel, { color: colors.textSecondary }]}
                accessibilityRole="header"
              >
                Round {roundNum}
              </Text>
              <View style={styles.roundDrawings}>
                <View style={styles.drawingColumn}>
                  <Text style={[styles.drawingOwner, { color: colors.text }]}>You</Text>
                  {myDrawing && myDrawing.strokes.length > 0 ? (
                    <View accessibilityLabel={`Round ${roundNum} drawing by You`}>
                      <DrawingThumbnail strokes={myDrawing.strokes} />
                    </View>
                  ) : (
                    <View
                      style={[styles.emptyThumbnail, { borderColor: colors.border }]}
                      accessibilityLabel={`Round ${roundNum} drawing by You - empty`}
                    >
                      <Ionicons name="image-outline" size={24} color={colors.border} />
                    </View>
                  )}
                </View>
                <View style={styles.drawingColumn}>
                  <Text style={[styles.drawingOwner, { color: colors.text }]}>{opponentName ?? "Opponent"}</Text>
                  {opponentDrawing && opponentDrawing.strokes.length > 0 ? (
                    <View accessibilityLabel={`Round ${roundNum} drawing by Opponent`}>
                      <DrawingThumbnail strokes={opponentDrawing.strokes} />
                    </View>
                  ) : (
                    <View
                      style={[styles.emptyThumbnail, { borderColor: colors.border }]}
                      accessibilityLabel={`Round ${roundNum} drawing by Opponent - empty`}
                    >
                      <Ionicons name="image-outline" size={24} color={colors.border} />
                    </View>
                  )}
                </View>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  gallerySection: {
    marginTop: 24,
    gap: 16,
  },
  gallerySectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  noDrawingsText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginVertical: 12,
  },
  roundBlock: {
    gap: 8,
  },
  roundLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  roundDrawings: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
  },
  drawingColumn: {
    alignItems: "center",
    gap: 6,
  },
  drawingOwner: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  emptyThumbnail: {
    width: 120,
    height: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
});
