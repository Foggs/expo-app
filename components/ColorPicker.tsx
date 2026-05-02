import React from "react";
import {
  View,
  Pressable,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/hooks/useThemeColors";
import { impactLight } from "@/lib/platformFeedback";
import BaseModal from "@/components/BaseModal";

const DRAWING_COLORS = [
  "#000000",
  "#FFFFFF",
  "#FF6B6B",
  "#FF8E53",
  "#FECA57",
  "#48DBFB",
  "#1DD1A1",
  "#5F27CD",
  "#6C5CE7",
  "#FD79A8",
  "#A29BFE",
  "#00CEC9",
];

const COLOR_NAMES: Record<string, string> = {
  "#000000": "Black",
  "#FFFFFF": "White",
  "#FF6B6B": "Red",
  "#FF8E53": "Orange",
  "#FECA57": "Yellow",
  "#48DBFB": "Light Blue",
  "#1DD1A1": "Green",
  "#5F27CD": "Dark Purple",
  "#6C5CE7": "Purple",
  "#FD79A8": "Pink",
  "#A29BFE": "Lavender",
  "#00CEC9": "Teal",
};

interface ColorPickerProps {
  selectedColor: string;
  onColorChange: (color: string) => void;
  visible: boolean;
  onClose: () => void;
}

export default function ColorPicker({
  selectedColor,
  onColorChange,
  visible,
  onClose,
}: ColorPickerProps) {
  const { colors } = useThemeColors();

  const handleColorSelect = (color: string) => {
    impactLight();
    onColorChange(color);
    onClose();
  };

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title="Pick a Color"
      closeLabel="Close color picker"
    >
      <View style={styles.colorsGrid}>
        {DRAWING_COLORS.map((color) => (
          <Pressable
            key={color}
            onPress={() => handleColorSelect(color)}
            style={[
              styles.colorButton,
              {
                backgroundColor: color,
                borderColor:
                  color === "#FFFFFF" ? colors.border : "transparent",
              },
              selectedColor === color && styles.selectedColor,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Select ${COLOR_NAMES[color] || color} color`}
            accessibilityState={{ selected: selectedColor === color }}
          >
            {selectedColor === color && (
              <Ionicons
                name="checkmark"
                size={20}
                color={color === "#FFFFFF" || color === "#FECA57" ? "#000" : "#FFF"}
              />
            )}
          </Pressable>
        ))}
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  colorsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "center",
  },
  colorButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  selectedColor: {
    borderWidth: 3,
    borderColor: "#6C5CE7",
  },
});
