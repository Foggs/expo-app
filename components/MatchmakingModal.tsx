import React from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated from "react-native-reanimated";
import BaseModal from "@/components/BaseModal";
import type { MatchFlowStateId } from "@/lib/state/matchFlow";
import type { ThemeColors } from "@/hooks/useThemeColors";

export interface MatchmakingModalProps {
  visible: boolean;
  colors: ThemeColors;
  flowState: MatchFlowStateId;
  lastErrorMessage?: string;
  backoffCountdown: number;
  queuePosition: number;
  searchPulseStyle: any;
  onCancel: () => void;
  onRetry: () => void;
}

export default function MatchmakingModal({
  visible,
  colors,
  flowState,
  lastErrorMessage,
  backoffCountdown,
  queuePosition,
  searchPulseStyle,
  onCancel,
  onRetry,
}: MatchmakingModalProps) {
  return (
    <BaseModal
      visible={visible}
      onClose={onCancel}
      dismissOnOverlay={false}
      cardStyle={styles.card}
    >
      {flowState === "error_fatal" ? (
        <>
          <Ionicons name="close-circle" size={48} color={colors.error} />
          <Text style={[styles.searchTitle, { color: colors.text }]} accessibilityRole="alert">
            Connection Failed
          </Text>
          <Text style={[styles.searchHint, { color: colors.textSecondary }]}>
            {lastErrorMessage || "Unable to connect to the server."}
          </Text>
          <Pressable
            onPress={onRetry}
            style={[styles.retryButton, { backgroundColor: colors.tint }]}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
          <Pressable
            onPress={onCancel}
            style={[styles.cancelButton, { borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Ionicons name="close" size={20} color={colors.error} />
            <Text style={[styles.cancelText, { color: colors.error }]}>Cancel</Text>
          </Pressable>
        </>
      ) : flowState === "error_backoff" ? (
        <>
          <Ionicons name="time-outline" size={48} color={colors.accent} />
          <Text
            style={[styles.searchTitle, { color: colors.text }]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            Reconnecting in {backoffCountdown}s...
          </Text>
          <Text style={[styles.searchHint, { color: colors.textSecondary }]}>Waiting before retrying connection</Text>
          <Pressable
            onPress={onCancel}
            style={[styles.cancelButton, { borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Ionicons name="close" size={20} color={colors.error} />
            <Text style={[styles.cancelText, { color: colors.error }]}>Cancel</Text>
          </Pressable>
        </>
      ) : flowState === "error_recoverable" ? (
        <>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text
            style={[styles.searchTitle, { color: colors.text }]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            Reconnecting...
          </Text>
          <Text style={[styles.searchHint, { color: colors.textSecondary }]}>Attempting to restore connection</Text>
          <Pressable
            onPress={onCancel}
            style={[styles.cancelButton, { borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Ionicons name="close" size={20} color={colors.error} />
            <Text style={[styles.cancelText, { color: colors.error }]}>Cancel</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Animated.View style={searchPulseStyle}>
            <ActivityIndicator size="large" color={colors.tint} />
          </Animated.View>

          <Text
            style={[styles.searchTitle, { color: colors.text }]}
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
          >
            Searching for opponent...
          </Text>

          {queuePosition > 0 && (
            <Text style={[styles.queueText, { color: colors.textSecondary }]} accessibilityLiveRegion="polite">
              Queue position: {queuePosition}
            </Text>
          )}

          <Text style={[styles.searchHint, { color: colors.textSecondary }]}>This may take a moment</Text>

          <Pressable
            onPress={onCancel}
            style={[styles.cancelButton, { borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel="Cancel search"
          >
            <Ionicons name="close" size={20} color={colors.error} />
            <Text style={[styles.cancelText, { color: colors.error }]}>Cancel</Text>
          </Pressable>
        </>
      )}
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 32,
    alignItems: "center" as const,
    gap: 16,
  },
  searchTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  queueText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  searchHint: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
  },
  cancelText: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 16,
    marginTop: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
