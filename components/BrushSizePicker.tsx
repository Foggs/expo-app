import React from "react";
import {
  View,
  Pressable,
  StyleSheet,
  useColorScheme,
  Modal,
  Text,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import Colors from "@/constants/colors";

const BRUSH_SIZES = [
  { size: 2, label: "Fine" },
  { size: 4, label: "Small" },
  { size: 8, label: "Medium" },
  { size: 14, label: "Large" },
  { size: 22, label: "Extra Large" },
];

interface BrushSizePickerProps {
  selectedSize: number;
  onSizeChange: (size: number) => void;
  visible: boolean;
  onClose: () => void;
  currentColor: string;
}

export default function BrushSizePicker({
  selectedSize,
  onSizeChange,
  visible,
  onClose,
  currentColor,
}: BrushSizePickerProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const handleSizeSelect = (size: number) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onSizeChange(size);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.container, { backgroundColor: colors.card }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              Brush Size
            </Text>
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close brush size picker"
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.sizesContainer}>
            {BRUSH_SIZES.map(({ size, label }) => (
              <Pressable
                key={size}
                onPress={() => handleSizeSelect(size)}
                style={[
                  styles.sizeRow,
                  { backgroundColor: colors.background },
                  selectedSize === size && {
                    backgroundColor: colors.tint + "20",
                    borderColor: colors.tint,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Select ${label} brush size`}
                accessibilityHint="Double tap to select this brush size"
                accessibilityState={{ selected: selectedSize === size }}
              >
                <View style={styles.previewContainer}>
                  <View
                    style={[
                      styles.sizePreview,
                      {
                        width: size + 10,
                        height: size + 10,
                        backgroundColor: currentColor,
                        borderRadius: (size + 10) / 2,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.sizeLabel,
                    { color: colors.text },
                    selectedSize === size && { color: colors.tint },
                  ]}
                >
                  {label}
                </Text>
                {selectedSize === size && (
                  <Ionicons name="checkmark" size={20} color={colors.tint} />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  container: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 20,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  sizesContainer: {
    gap: 8,
  },
  sizeRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  previewContainer: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  sizePreview: {
    minWidth: 6,
    minHeight: 6,
  },
  sizeLabel: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    marginLeft: 12,
  },
});
