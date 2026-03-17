import React from "react";
import {
  View,
  Pressable,
  StyleSheet,
  Text,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/hooks/useThemeColors";
import { impactLight } from "@/lib/platformFeedback";
import BaseModal from "@/components/BaseModal";

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
  const { colors } = useThemeColors();

  const handleSizeSelect = (size: number) => {
    impactLight();
    onSizeChange(size);
    onClose();
  };

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title="Brush Size"
      closeLabel="Close brush size picker"
    >
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
    </BaseModal>
  );
}

const styles = StyleSheet.create({
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
