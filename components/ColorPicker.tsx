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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const handleColorSelect = (color: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onColorChange(color);
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
              Pick a Color
            </Text>
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close color picker"
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

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
                accessibilityLabel={`Select color ${color}`}
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
    marginBottom: 20,
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
