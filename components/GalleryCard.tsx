import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import DrawingThumbnail, { type StrokeLike } from "@/components/DrawingThumbnail";
import type { ThemeColors } from "@/hooks/useThemeColors";

interface GalleryCardDrawing {
  id: string;
  opponentName: string;
  roundCount: number;
  strokes: StrokeLike[];
  createdAt: string;
}

export interface GalleryCardProps {
  drawing: GalleryCardDrawing;
  colors: ThemeColors;
  formattedDate: string;
  onDelete: (id: string) => void;
  isDeleting?: boolean;
}

export default function GalleryCard({
  drawing,
  colors,
  formattedDate,
  onDelete,
  isDeleting = false,
}: GalleryCardProps) {
  return (
    <View
      style={[styles.card, { backgroundColor: colors.card }]}
    >
      <View style={styles.cardContent}>
        <DrawingThumbnail strokes={drawing.strokes} size={160} borderRadius={16} />
        <View style={styles.cardInfo}>
          <Text style={[styles.cardDate, { color: colors.textSecondary }]}>{formattedDate}</Text>
          <View style={styles.cardDetail}>
            <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.cardDetailText, { color: colors.text }]}>vs {drawing.opponentName}</Text>
          </View>
          <View style={styles.cardDetail}>
            <Ionicons name="layers-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.cardDetailText, { color: colors.text }]}>{drawing.roundCount} rounds</Text>
          </View>
          <Pressable
            onPress={() => onDelete(drawing.id)}
            disabled={isDeleting}
            style={({ pressed }) => [
              styles.deleteButton,
              { opacity: isDeleting ? 0.45 : pressed ? 0.7 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Delete this drawing"
            accessibilityHint="Opens a confirmation before removing this drawing"
          >
            <Ionicons name="trash-outline" size={18} color={colors.error} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
  },
  cardContent: {
    flexDirection: "row",
    gap: 16,
  },
  cardInfo: {
    flex: 1,
    justifyContent: "center",
    gap: 8,
  },
  cardDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  cardDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardDetailText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  deleteButton: {
    marginTop: 4,
    alignSelf: "flex-start",
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
});
