import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  Alert,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import Colors from "@/constants/colors";
import type { Stroke } from "@/components/DrawingCanvas";
import {
  getRoundDrawings,
  clearRoundDrawings,
  RoundDrawing,
} from "@/lib/gameStore";
import { apiRequest } from "@/lib/query-client";
import { getSessionToken } from "@/lib/sessionToken";
import { calculateStrokeBounds } from "@/lib/strokeBounds";

function DrawingThumbnail({
  strokes,
  size = 120,
}: {
  strokes: Stroke[];
  size?: number;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const viewBox = calculateStrokeBounds(strokes);

  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
      }}
    >
      <Svg width={size} height={size} viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
        {strokes.map((stroke) => (
          <Path
            key={stroke.id}
            d={stroke.path}
            stroke={stroke.color}
            strokeWidth={stroke.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}
      </Svg>
    </View>
  );
}

export default function ResultsScreen() {
  const { opponentName } = useLocalSearchParams<{ opponentName?: string }>();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

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
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    opacity: cardOpacity.value,
  }));

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const handlePlayAgain = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.replace("/");
  };

  const handleHome = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.replace("/");
  };

  const handleSaveToGallery = async () => {
    if (isSaving || isSaved) return;
    setIsSaving(true);

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      const allStrokes = drawings.flatMap((d) => d.strokes);
      if (allStrokes.length === 0) {
        if (Platform.OS === "web") {
          alert("No drawings to save.");
        } else {
          Alert.alert("No Drawings", "There are no drawings to save.");
        }
        setIsSaving(false);
        return;
      }

      const lastDrawing = drawings.reduce((a, b) => (a.round >= b.round ? a : b), drawings[0]);
      const token = await getSessionToken();
      await apiRequest("POST", "/api/gallery", {
        playerName: "You",
        opponentName: opponentName ?? "Opponent",
        strokes: lastDrawing.strokes,
        roundCount: Math.max(...drawings.map((d) => d.round)),
        sessionToken: token,
      });

      setIsSaved(true);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      if (Platform.OS === "web") {
        alert("Failed to save drawing. Please try again.");
      } else {
        Alert.alert("Error", "Failed to save drawing. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const roundNumbers = [...new Set(drawings.map((d) => d.round))].sort(
    (a, b) => a - b
  );

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
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Great match!
          </Text>
        </View>

        <Animated.View style={[styles.artworkCard, cardStyle]}>
          <View style={styles.statsRow}>
            <View
              style={styles.statItem}
              accessible={true}
              accessibilityLabel="3 Rounds played"
            >
              <Ionicons name="brush" size={20} color={colors.tint} />
              <Text style={[styles.statValue, { color: colors.text }]}>3</Text>
              <Text
                style={[styles.statLabel, { color: colors.textSecondary }]}
              >
                Rounds
              </Text>
            </View>

            <View
              style={[styles.statDivider, { backgroundColor: colors.border }]}
            />

            <View
              style={styles.statItem}
              accessible={true}
              accessibilityLabel="6 minutes total time"
            >
              <Ionicons name="time" size={20} color={colors.accent} />
              <Text style={[styles.statValue, { color: colors.text }]}>
                6:00
              </Text>
              <Text
                style={[styles.statLabel, { color: colors.textSecondary }]}
              >
                Total Time
              </Text>
            </View>

            <View
              style={[styles.statDivider, { backgroundColor: colors.border }]}
            />

            <View
              style={styles.statItem}
              accessible={true}
              accessibilityLabel="2 Artists competed"
            >
              <Ionicons
                name="people"
                size={20}
                color={colors.accentSecondary}
              />
              <Text style={[styles.statValue, { color: colors.text }]}>2</Text>
              <Text
                style={[styles.statLabel, { color: colors.textSecondary }]}
              >
                Artists
              </Text>
            </View>
          </View>
        </Animated.View>

        <View style={styles.gallerySection}>
          <Text
            style={[styles.gallerySectionTitle, { color: colors.text }]}
            accessibilityRole="header"
          >
            Round Gallery
          </Text>
          {roundNumbers.length === 0 ? (
            <Text
              style={[
                styles.noDrawingsText,
                { color: colors.textSecondary },
              ]}
            >
              No drawings recorded
            </Text>
          ) : (
            roundNumbers.map((roundNum) => {
              const roundDrawings = drawings.filter(
                (d) => d.round === roundNum
              );
              const myDrawing = roundDrawings.find(
                (d) => d.playerRole === playerRole
              );
              const opponentDrawing = roundDrawings.find(
                (d) => d.playerRole !== playerRole
              );

              return (
                <View key={roundNum} style={styles.roundBlock}>
                  <Text
                    style={[
                      styles.roundLabel,
                      { color: colors.textSecondary },
                    ]}
                    accessibilityRole="header"
                  >
                    Round {roundNum}
                  </Text>
                  <View style={styles.roundDrawings}>
                    <View style={styles.drawingColumn}>
                      <Text
                        style={[
                          styles.drawingOwner,
                          { color: colors.text },
                        ]}
                      >
                        You
                      </Text>
                      {myDrawing && myDrawing.strokes.length > 0 ? (
                        <View
                          accessibilityLabel={`Round ${roundNum} drawing by You`}
                        >
                          <DrawingThumbnail strokes={myDrawing.strokes} />
                        </View>
                      ) : (
                        <View
                          style={[
                            styles.emptyThumbnail,
                            { borderColor: colors.border },
                          ]}
                          accessibilityLabel={`Round ${roundNum} drawing by You - empty`}
                        >
                          <Ionicons
                            name="image-outline"
                            size={24}
                            color={colors.border}
                          />
                        </View>
                      )}
                    </View>
                    <View style={styles.drawingColumn}>
                      <Text
                        style={[
                          styles.drawingOwner,
                          { color: colors.text },
                        ]}
                      >
                        {opponentName ?? "Opponent"}
                      </Text>
                      {opponentDrawing && opponentDrawing.strokes.length > 0 ? (
                        <View
                          accessibilityLabel={`Round ${roundNum} drawing by Opponent`}
                        >
                          <DrawingThumbnail
                            strokes={opponentDrawing.strokes}
                          />
                        </View>
                      ) : (
                        <View
                          style={[
                            styles.emptyThumbnail,
                            { borderColor: colors.border },
                          ]}
                          accessibilityLabel={`Round ${roundNum} drawing by Opponent - empty`}
                        >
                          <Ionicons
                            name="image-outline"
                            size={24}
                            color={colors.border}
                          />
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.playersInfo}>
          <View
            style={styles.playerCard}
            accessible={true}
            accessibilityLabel="Player 1: You"
          >
            <View
              style={[styles.playerAvatar, { backgroundColor: colors.player1 }]}
            >
              <Text style={styles.avatarText}>P1</Text>
            </View>
            <Text style={[styles.playerName, { color: colors.text }]}>You</Text>
          </View>

          <Ionicons name="heart" size={24} color={colors.accentSecondary} />

          <View
            style={styles.playerCard}
            accessible={true}
            accessibilityLabel={
              "Player 2: " + (opponentName ?? "Opponent")
            }
          >
            <View
              style={[styles.playerAvatar, { backgroundColor: colors.player2 }]}
            >
              <Text style={styles.avatarText}>P2</Text>
            </View>
            <Text style={[styles.playerName, { color: colors.text }]}>
              {opponentName ?? "Opponent"}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={handleSaveToGallery}
            disabled={isSaving || isSaved || drawings.length === 0}
            accessibilityRole="button"
            accessibilityLabel={isSaved ? "Drawing saved to gallery" : "Save drawing to gallery"}
          >
            <LinearGradient
              colors={isSaved ? ["#27ae60", "#2ecc71"] : [colors.accentSecondary, colors.accent]}
              style={[styles.primaryButton, (isSaving || isSaved || drawings.length === 0) && styles.buttonDisabledStyle]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name={isSaved ? "checkmark-circle" : "save"} size={22} color="#fff" />
              )}
              <Text style={styles.primaryButtonText}>
                {isSaved ? "Saved" : "Save to Gallery"}
              </Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            onPress={handlePlayAgain}
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
            onPress={handleHome}
            style={[styles.secondaryButton, { borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel="Return to home screen"
          >
            <Ionicons name="home" size={22} color={colors.text} />
            <Text
              style={[styles.secondaryButtonText, { color: colors.text }]}
            >
              Home
            </Text>
          </Pressable>
        </View>
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
