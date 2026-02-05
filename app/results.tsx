import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
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
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";

export default function ResultsScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const cardScale = useSharedValue(0.8);
  const cardOpacity = useSharedValue(0);

  React.useEffect(() => {
    cardScale.value = withDelay(200, withSpring(1, { damping: 12 }));
    cardOpacity.value = withDelay(200, withSpring(1));
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
    router.replace("/game");
  };

  const handleHome = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.replace("/");
  };

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

      <View
        style={[
          styles.content,
          { paddingTop: topPadding + 20, paddingBottom: bottomPadding + 20 },
        ]}
      >
        <View style={styles.header}>
          <Text
            style={[styles.title, { color: colors.text }]}
            accessibilityRole="header"
          >
            Game Complete!
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Here's your collaborative masterpiece
          </Text>
        </View>

        <Animated.View style={[styles.artworkCard, cardStyle]}>
          <View
            style={[
              styles.artwork,
              {
                backgroundColor: colors.canvasBackground,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.artworkPlaceholder}>
              <Ionicons name="image" size={64} color={colors.textSecondary} />
              <Text
                style={[
                  styles.artworkPlaceholderText,
                  { color: colors.textSecondary },
                ]}
              >
                Final artwork will be displayed here
              </Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="brush" size={20} color={colors.tint} />
              <Text style={[styles.statValue, { color: colors.text }]}>3</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Rounds
              </Text>
            </View>

            <View
              style={[styles.statDivider, { backgroundColor: colors.border }]}
            />

            <View style={styles.statItem}>
              <Ionicons name="time" size={20} color={colors.accent} />
              <Text style={[styles.statValue, { color: colors.text }]}>
                6:00
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Total Time
              </Text>
            </View>

            <View
              style={[styles.statDivider, { backgroundColor: colors.border }]}
            />

            <View style={styles.statItem}>
              <Ionicons name="people" size={20} color={colors.accentSecondary} />
              <Text style={[styles.statValue, { color: colors.text }]}>2</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Artists
              </Text>
            </View>
          </View>
        </Animated.View>

        <View style={styles.playersInfo}>
          <View style={styles.playerCard}>
            <View
              style={[styles.playerAvatar, { backgroundColor: colors.player1 }]}
            >
              <Text style={styles.avatarText}>P1</Text>
            </View>
            <Text style={[styles.playerName, { color: colors.text }]}>You</Text>
          </View>

          <Ionicons name="heart" size={24} color={colors.accentSecondary} />

          <View style={styles.playerCard}>
            <View
              style={[styles.playerAvatar, { backgroundColor: colors.player2 }]}
            >
              <Text style={styles.avatarText}>P2</Text>
            </View>
            <Text style={[styles.playerName, { color: colors.text }]}>
              Opponent
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
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
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
              Home
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
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
  artwork: {
    aspectRatio: 4 / 3,
    borderRadius: 20,
    borderWidth: 2,
    overflow: "hidden",
  },
  artworkPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  artworkPlaceholderText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
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
    marginTop: "auto",
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
