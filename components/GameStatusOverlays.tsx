import React from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated from "react-native-reanimated";
import BaseModal from "@/components/BaseModal";
import type { ThemeColors } from "@/hooks/useThemeColors";

export interface GameStatusOverlaysProps {
  colors: ThemeColors;
  showGetReady: boolean;
  getReadyCountdown: number;
  getReadyAnimatedStyle: any;
  isRetrying: boolean;
  showSubmitFailed: boolean;
  showSyncFatal: boolean;
  lastErrorMessage?: string;
  onRetrySubmit: () => void;
  onExitGame: () => void;
  onReturnHome: () => void;
}

export default function GameStatusOverlays({
  colors,
  showGetReady,
  getReadyCountdown,
  getReadyAnimatedStyle,
  isRetrying,
  showSubmitFailed,
  showSyncFatal,
  lastErrorMessage,
  onRetrySubmit,
  onExitGame,
  onReturnHome,
}: GameStatusOverlaysProps) {
  return (
    <>
      <Modal
        visible={showGetReady}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.getReadyOverlay}>
          <Animated.View
            style={[styles.getReadyModal, getReadyAnimatedStyle]}
            accessible={true}
            accessibilityRole="alert"
            accessibilityLabel={`Get ready! Your turn starts in ${getReadyCountdown} seconds`}
            accessibilityLiveRegion="assertive"
          >
            <Ionicons name="brush" size={40} color={colors.tint} />
            <Text style={[styles.getReadyTitle, { color: colors.text }]}>Get Ready!</Text>
            <Text style={[styles.getReadySubtitle, { color: colors.textSecondary }]}>Your turn starts in</Text>
            <Animated.Text
              style={[
                styles.getReadyCountdown,
                { color: getReadyCountdown <= 3 ? colors.timerCritical : colors.tint },
              ]}
            >
              {getReadyCountdown}
            </Animated.Text>
          </Animated.View>
        </View>
      </Modal>

      {isRetrying && (
        <View style={styles.retryingBanner} pointerEvents="none">
          <View style={styles.retryingContent}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.retryingText}>Retrying...</Text>
          </View>
        </View>
      )}

      <BaseModal
        visible={showSubmitFailed}
        onClose={onExitGame}
        dismissOnOverlay={false}
        statusBarTranslucent
        cardStyle={styles.errorCard}
      >
        <Ionicons name="alert-circle" size={40} color={colors.error} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>Submission Failed</Text>
        <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
          {lastErrorMessage || "Your drawing could not be sent. Please try again."}
        </Text>
        <View style={styles.errorActions}>
          <Pressable
            onPress={onRetrySubmit}
            style={[styles.errorButton, { backgroundColor: colors.tint }]}
            accessibilityRole="button"
            accessibilityLabel="Retry submission"
          >
            <Ionicons name="refresh" size={18} color="#fff" />
            <Text style={styles.errorButtonText}>Retry</Text>
          </Pressable>
          <Pressable
            onPress={onExitGame}
            style={[styles.errorButtonOutline, { borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel="Exit game"
          >
            <Ionicons name="exit-outline" size={18} color={colors.error} />
            <Text style={[styles.errorButtonOutlineText, { color: colors.error }]}>Exit</Text>
          </Pressable>
        </View>
      </BaseModal>

      <BaseModal
        visible={showSyncFatal}
        onClose={onReturnHome}
        dismissOnOverlay={false}
        statusBarTranslucent
        cardStyle={styles.errorCard}
      >
        <Ionicons name="close-circle" size={40} color={colors.error} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>Connection Lost</Text>
        <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
          {lastErrorMessage || "The game session could not be recovered."}
        </Text>
        <Pressable
          onPress={onReturnHome}
          style={[styles.errorButton, { backgroundColor: colors.error }]}
          accessibilityRole="button"
          accessibilityLabel="Return home"
        >
          <Ionicons name="home" size={18} color="#fff" />
          <Text style={styles.errorButtonText}>Return Home</Text>
        </Pressable>
      </BaseModal>
    </>
  );
}

const styles = StyleSheet.create({
  getReadyOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  getReadyModal: {
    backgroundColor: "#1a1a2e",
    borderRadius: 28,
    padding: 36,
    alignItems: "center",
    gap: 8,
    minWidth: 240,
    borderWidth: 2,
    borderColor: "rgba(108, 92, 231, 0.3)",
  },
  getReadyTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    marginTop: 8,
  },
  getReadySubtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  getReadyCountdown: {
    fontSize: 56,
    fontFamily: "Inter_700Bold",
    marginTop: 4,
  },
  retryingBanner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingTop: 100,
  },
  retryingContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  retryingText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  errorCard: {
    padding: 32,
    alignItems: "center" as const,
    gap: 12,
  },
  errorTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  errorMessage: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  errorActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  errorButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  errorButtonText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  errorButtonOutline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  errorButtonOutlineText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
});
