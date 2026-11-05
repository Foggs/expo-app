import React, { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ThemeColors } from "@/hooks/useThemeColors";
import { confirmAction, showPlatformAlert } from "@/lib/platformDialogs";
import { apiRequest } from "@/lib/query-client";
import { getSessionToken } from "@/lib/sessionToken";
import ReportActionButton, { type ReportReason } from "@/components/ReportActionButton";

interface ContentSafetyActionsProps {
  colors: ThemeColors;
  gameId?: string;
  opponentPlayerId?: string;
}

export default function ContentSafetyActions({
  colors,
  gameId,
  opponentPlayerId,
}: ContentSafetyActionsProps) {
  const [isReporting, setIsReporting] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [playerBlocked, setPlayerBlocked] = useState(false);

  const reportOpponent = async (reason: ReportReason) => {
    if (!gameId || isReporting || reportSent) return;
    setIsReporting(true);
    try {
      const token = await getSessionToken();
      await apiRequest("POST", "/api/reports", {
        reportType: "match",
        gameId,
        reason,
      }, { "x-session-token": token });
      setReportSent(true);
      showPlatformAlert("Report received", "Thank you. The opponent's drawings were sent for review.");
    } catch {
      showPlatformAlert("Couldn't send report", "Please check your connection and try again.");
    } finally {
      setIsReporting(false);
    }
  };

  const blockOpponent = async () => {
    if (!opponentPlayerId || isBlocking || playerBlocked) return;
    setIsBlocking(true);
    try {
      const token = await getSessionToken();
      await apiRequest("POST", "/api/blocks", {
        blockedPlayerId: opponentPlayerId,
      }, { "x-session-token": token });
      setPlayerBlocked(true);
      showPlatformAlert("Player blocked", "You won't be matched with this player again on this device.");
    } catch {
      showPlatformAlert("Couldn't block player", "Please check your connection and try again.");
    } finally {
      setIsBlocking(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>Keep SketchDuel safe</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        Report inappropriate drawings or block this player from future random matches.
      </Text>
      <View style={styles.actions}>
        <ReportActionButton
          colors={colors}
          label={reportSent ? "Reported" : "Report opponent drawing"}
          disabled={!gameId || isReporting || reportSent}
          onSelectReason={reportOpponent}
        />
        <Pressable
          onPress={() => confirmAction({
            title: "Block Player",
            message: "You won't be matched with this player again on this device.",
            webMessage: "Block this player from future random matches?",
            confirmText: "Block",
            cancelText: "Cancel",
            destructive: true,
            onConfirm: () => void blockOpponent(),
          })}
          disabled={!opponentPlayerId || isBlocking || playerBlocked}
          style={({ pressed }) => [
            styles.blockButton,
            {
              borderColor: colors.border,
              opacity: !opponentPlayerId || isBlocking || playerBlocked ? 0.5 : pressed ? 0.7 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={playerBlocked ? "Player blocked" : "Block opponent"}
        >
          <Ionicons name="person-remove-outline" size={16} color={colors.text} />
          <Text style={[styles.blockLabel, { color: colors.text }]}>
            {playerBlocked ? "Blocked" : "Block opponent"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  blockButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  blockLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
});
