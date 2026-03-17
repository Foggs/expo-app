import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ResultsActionButtons from "@/components/ResultsActionButtons";
import ResultsPlayersInfo from "@/components/ResultsPlayersInfo";
import ResultsRoundGallery from "@/components/ResultsRoundGallery";
import ResultsStatsCard from "@/components/ResultsStatsCard";
import { useScreenPadding } from "@/hooks/useScreenPadding";
import { useThemeColors } from "@/hooks/useThemeColors";
import {
  clearRoundDrawings,
  getRoundDrawings,
} from "@/lib/gameStore";
import type { RoundDrawing } from "@/lib/gameStore";
import { impactLight, impactMedium, notifySuccess } from "@/lib/platformFeedback";
import { showPlatformAlert } from "@/lib/platformDialogs";
import { apiRequest } from "@/lib/query-client";
import { getSessionToken } from "@/lib/sessionToken";

export default function ResultsScreen() {
  const { opponentName } = useLocalSearchParams<{ opponentName?: string }>();
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useThemeColors();
  const { topPadding, bottomPadding } = useScreenPadding(insets);

  const [drawings, setDrawings] = useState<RoundDrawing[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const cardScale = useSharedValue(0.8);
  const cardOpacity = useSharedValue(0);

  useEffect(() => {
    const saved = getRoundDrawings();
    setDrawings(saved);
    cardScale.value = withDelay(200, withSpring(1, { damping: 12 }));
    cardOpacity.value = withDelay(200, withSpring(1));

    return () => {
      clearRoundDrawings();
    };
  }, [cardScale, cardOpacity]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    opacity: cardOpacity.value,
  }));

  const handlePlayAgain = () => {
    impactMedium();
    router.replace("/");
  };

  const handleHome = () => {
    impactLight();
    router.replace("/");
  };

  const handleSaveToGallery = async () => {
    if (isSaving || isSaved) return;
    setIsSaving(true);
    impactMedium();

    try {
      const allStrokes = drawings.flatMap((d) => d.strokes);
      if (allStrokes.length === 0) {
        showPlatformAlert("No Drawings", "There are no drawings to save.", undefined, "No drawings to save.");
        setIsSaving(false);
        return;
      }

      const token = await getSessionToken();
      await apiRequest("POST", "/api/gallery", {
        playerName: "You",
        opponentName: opponentName ?? "Opponent",
        strokes: allStrokes,
        roundCount: Math.max(...drawings.map((d) => d.round)),
        sessionToken: token,
      });

      setIsSaved(true);
      notifySuccess();
    } catch {
      showPlatformAlert(
        "Error",
        "Failed to save drawing. Please try again.",
        undefined,
        "Failed to save drawing. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const roundNumbers = [...new Set(drawings.map((d) => d.round))].sort((a, b) => a - b);

  const playerRole =
    drawings.find((d) => d.playerRole === "player1" || d.playerRole === "player2")
      ?.playerRole ?? "player1";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <LinearGradient
        colors={
          isDark
            ? ["#1a1a2e", "#2d2d4a", "#1a1a2e"]
            : ["#f8f9ff", "#e8e9ff", "#f8f9ff"]
        }
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: topPadding + 20, paddingBottom: bottomPadding + 20 },
        ]}
      >
        <View style={styles.header}>
          <Text
            style={[styles.title, { color: colors.text }]}
            accessibilityRole="header"
            accessibilityLiveRegion="polite"
          >
            Game Complete!
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Great match!</Text>
        </View>

        <ResultsStatsCard colors={colors} cardStyle={cardStyle} />

        <ResultsRoundGallery
          colors={colors}
          roundNumbers={roundNumbers}
          drawings={drawings}
          playerRole={playerRole}
          opponentName={opponentName}
        />

        <ResultsPlayersInfo colors={colors} opponentName={opponentName} />

        <ResultsActionButtons
          colors={colors}
          drawingsLength={drawings.length}
          isSaving={isSaving}
          isSaved={isSaved}
          onSaveToGallery={handleSaveToGallery}
          onPlayAgain={handlePlayAgain}
          onHome={handleHome}
          onViewGallery={() => router.push("/gallery")}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
  },
  header: {
    alignItems: "center",
    gap: 8,
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
});
