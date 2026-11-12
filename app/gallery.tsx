import { useMutation, useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GalleryCard from "@/components/GalleryCard";
import type { ReportReason } from "@/components/ReportActionButton";
import type { StrokeLike } from "@/components/DrawingThumbnail";
import { useScreenPadding } from "@/hooks/useScreenPadding";
import { useThemeColors } from "@/hooks/useThemeColors";
import { impactLight, impactMedium } from "@/lib/platformFeedback";
import { confirmAction, showPlatformAlert } from "@/lib/platformDialogs";
import { apiRequest, queryClient } from "@/lib/query-client";
import { getSessionToken } from "@/lib/sessionToken";

interface GalleryDrawing {
  id: string;
  playerName: string;
  opponentName: string;
  strokes: StrokeLike[];
  roundCount: number;
  createdAt: string;
}

export default function GalleryScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeColors();
  const { topPadding, bottomPadding } = useScreenPadding(insets);

  const { data: drawings = [], isLoading, isError, refetch, isFetching } = useQuery<GalleryDrawing[]>({
    queryKey: ["/api/gallery"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getSessionToken();
      await apiRequest("DELETE", `/api/gallery/${id}`, undefined, {
        "x-session-token": token,
      });
    },
    onSuccess: (_, deletedId) => {
      queryClient.setQueryData<GalleryDrawing[]>(
        ["/api/gallery"],
        (currentDrawings) =>
          currentDrawings?.filter((drawing) => drawing.id !== deletedId) ?? [],
      );
      void queryClient.invalidateQueries({ queryKey: ["/api/gallery"] });
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "";
      const message = errorMessage.startsWith("401")
        ? "Your session has expired. Please try again."
        : errorMessage.startsWith("404")
          ? "That drawing is no longer in the gallery."
          : "We couldn't delete this drawing. Check your connection and try again.";

      showPlatformAlert(
        "Couldn't Delete Drawing",
        message,
        undefined,
        message,
      );
    },
  });

  const reportMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: ReportReason }) => {
      const token = await getSessionToken();
      await apiRequest("POST", "/api/reports", {
        reportType: "gallery",
        galleryDrawingId: id,
        reason,
      }, { "x-session-token": token });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/gallery"] });
      showPlatformAlert("Report received", "Thank you. This drawing is hidden while it is reviewed.");
    },
    onError: () => {
      showPlatformAlert("Couldn't send report", "Please check your connection and try again.");
    },
  });

  const handleDelete = (id: string) => {
    if (deleteMutation.isPending) return;

    impactMedium();

    const doDelete = () => deleteMutation.mutate(id);

    confirmAction({
      title: "Delete Drawing",
      message: "Remove this drawing from your gallery?",
      webMessage: "Delete this drawing from your gallery?",
      confirmText: "Delete",
      cancelText: "Cancel",
      destructive: true,
      onConfirm: doDelete,
    });
  };

  const handleBack = () => {
    impactLight();
    router.back();
  };

  const handlePlay = () => {
    impactLight();
    router.dismissTo("/");
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <View style={[styles.header, { paddingTop: topPadding + 8 }]}> 
        <Pressable
          onPress={handleBack}
          style={[styles.backButton, { backgroundColor: colors.card }]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          Gallery
        </Text>
        <View style={styles.placeholder} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.tint} />
          <Text style={[styles.emptyHint, { color: colors.textSecondary }]} accessibilityLiveRegion="polite">
            Loading gallery…
          </Text>
        </View>
      ) : isError ? (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.border} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Couldn&apos;t load gallery</Text>
          <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
            Check your connection and try again.
          </Text>
          <Pressable
            onPress={() => refetch()}
            disabled={isFetching}
            accessibilityRole="button"
            accessibilityState={{ disabled: isFetching }}
            style={styles.retryButton}
          >
            <Text style={[styles.emptyHint, { color: colors.tint }]}>
              {isFetching ? "Trying again…" : "Try Again"}
            </Text>
          </Pressable>
        </View>
      ) : drawings.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="images-outline" size={48} color={colors.border} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No saved drawings yet</Text>
          <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
            Play a game and save your artwork from the results screen
          </Text>
          <Pressable
            onPress={handlePlay}
            style={({ pressed }) => [styles.playButton, { backgroundColor: colors.tint }, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Play"
            accessibilityHint="Returns to the home screen to start a game"
          >
            <Ionicons name="brush" size={18} color="#fff" />
            <Text style={styles.playButtonText}>Play</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={drawings}
          renderItem={({ item }) => (
            <GalleryCard
              drawing={item}
              colors={colors}
              formattedDate={formatDate(item.createdAt)}
              onDelete={handleDelete}
              onReport={(id, reason) => reportMutation.mutate({ id, reason })}
              isDeleting={deleteMutation.isPending}
              isReporting={reportMutation.isPending}
            />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPadding + 20 }]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={drawings.length > 0}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  retryButton: {
    minHeight: 44,
    minWidth: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
  },
  placeholder: {
    width: 44,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  emptyHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  playButton: {
    marginTop: 8,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  playButtonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  pressed: {
    opacity: 0.82,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 16,
  },
});
