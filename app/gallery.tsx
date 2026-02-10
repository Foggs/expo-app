import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useQuery, useMutation } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";
import { queryClient } from "@/lib/query-client";
import { getSessionToken } from "@/lib/sessionToken";
import { calculateStrokeBounds } from "@/lib/strokeBounds";

interface GalleryStroke {
  id: string;
  path: string;
  color: string;
  strokeWidth: number;
}

interface GalleryDrawing {
  id: string;
  playerName: string;
  opponentName: string;
  strokes: GalleryStroke[];
  roundCount: number;
  createdAt: string;
}

function GalleryThumbnail({ strokes, size = 160 }: { strokes: GalleryStroke[]; size?: number }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const viewBox = calculateStrokeBounds(strokes as any);

  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
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

export default function GalleryScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: drawings = [], isLoading, refetch } = useQuery<GalleryDrawing[]>({
    queryKey: ["/api/gallery"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getSessionToken();
      await apiRequest("DELETE", `/api/gallery/${id}`, undefined, {
        "x-session-token": token,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gallery"] });
    },
  });

  const handleDelete = (id: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const doDelete = () => deleteMutation.mutate(id);

    if (Platform.OS === "web") {
      if (confirm("Delete this drawing from your gallery?")) {
        doDelete();
      }
    } else {
      Alert.alert(
        "Delete Drawing",
        "Remove this drawing from your gallery?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: doDelete },
        ]
      );
    }
  };

  const handleBack = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.back();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const renderItem = ({ item }: { item: GalleryDrawing }) => (
    <View
      style={[styles.card, { backgroundColor: colors.card }]}
      accessible={true}
      accessibilityLabel={`Drawing from ${formatDate(item.createdAt)}, played with ${item.opponentName}`}
    >
      <View style={styles.cardContent}>
        <GalleryThumbnail strokes={item.strokes} />
        <View style={styles.cardInfo}>
          <Text style={[styles.cardDate, { color: colors.textSecondary }]}>
            {formatDate(item.createdAt)}
          </Text>
          <View style={styles.cardDetail}>
            <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.cardDetailText, { color: colors.text }]}>
              vs {item.opponentName}
            </Text>
          </View>
          <View style={styles.cardDetail}>
            <Ionicons name="layers-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.cardDetailText, { color: colors.text }]}>
              {item.roundCount} rounds
            </Text>
          </View>
          <Pressable
            onPress={() => handleDelete(item.id)}
            style={styles.deleteButton}
            accessibilityRole="button"
            accessibilityLabel="Delete this drawing"
          >
            <Ionicons name="trash-outline" size={18} color={colors.error} />
          </Pressable>
        </View>
      </View>
    </View>
  );

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
        </View>
      ) : drawings.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="images-outline" size={48} color={colors.border} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No saved drawings yet
          </Text>
          <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
            Play a game and save your artwork from the results screen
          </Text>
        </View>
      ) : (
        <FlatList
          data={drawings}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: bottomPadding + 20 },
          ]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={drawings.length > 0}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 16,
  },
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
    padding: 4,
  },
});
