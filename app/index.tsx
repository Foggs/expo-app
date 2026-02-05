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
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const buttonScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.4);

  React.useEffect(() => {
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 1500 }),
        withTiming(0.4, { duration: 1500 })
      ),
      -1,
      true
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handlePressIn = () => {
    buttonScale.value = withSpring(0.95);
  };

  const handlePressOut = () => {
    buttonScale.value = withSpring(1);
  };

  const handleFindMatch = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push("/game");
  };

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

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
          { paddingTop: topPadding + 40, paddingBottom: bottomPadding + 20 },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View
              style={[styles.brushStroke, { backgroundColor: colors.tint }]}
            />
            <View
              style={[
                styles.brushStroke,
                styles.brushStroke2,
                { backgroundColor: colors.accent },
              ]}
            />
          </View>

          <Text
            style={[styles.title, { color: colors.text }]}
            accessibilityRole="header"
          >
            SketchDuel
          </Text>

          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Draw. Compete. Create Together.
          </Text>
        </View>

        <View style={styles.centerContent}>
          <View style={styles.gameInfo}>
            <View style={styles.infoRow}>
              <View
                style={[styles.iconContainer, { backgroundColor: colors.card }]}
              >
                <Ionicons name="people" size={24} color={colors.tint} />
              </View>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                2 Players
              </Text>
            </View>

            <View style={styles.infoRow}>
              <View
                style={[styles.iconContainer, { backgroundColor: colors.card }]}
              >
                <Ionicons name="timer" size={24} color={colors.accent} />
              </View>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                2 Minutes per Turn
              </Text>
            </View>

            <View style={styles.infoRow}>
              <View
                style={[styles.iconContainer, { backgroundColor: colors.card }]}
              >
                <Ionicons
                  name="repeat"
                  size={24}
                  color={colors.accentSecondary}
                />
              </View>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                3 Rounds
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Animated.View style={[styles.pulseRing, pulseStyle]}>
            <LinearGradient
              colors={[colors.tint, colors.accent]}
              style={styles.pulseGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          </Animated.View>

          <Animated.View style={buttonAnimatedStyle}>
            <Pressable
              onPress={handleFindMatch}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              accessibilityRole="button"
              accessibilityLabel="Find a match to play"
              accessibilityHint="Searches for another player to start a drawing game"
            >
              <LinearGradient
                colors={[colors.tint, colors.accent]}
                style={styles.findMatchButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="search" size={24} color="#fff" />
                <Text style={styles.buttonText}>Find Match</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
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
  subtitle: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
  },
  gameInfo: {
    gap: 20,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
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
  footer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  pulseRing: {
    position: "absolute",
    width: 220,
    height: 64,
    borderRadius: 32,
    overflow: "hidden",
  },
  pulseGradient: {
    flex: 1,
  },
  findMatchButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 28,
    minWidth: 200,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
});
