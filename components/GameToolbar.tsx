import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";
import type { ThemeColors } from "@/hooks/useThemeColors";

export interface GameToolbarProps {
  colors: ThemeColors;
  bottomPadding: number;
  canDraw: boolean;
  isSubmitting: boolean;
  isEraser: boolean;
  strokeColor: string;
  strokeCount: number;
  onBrushPress: () => void;
  onColorPress: () => void;
  onEraserToggle: () => void;
  onUndo: () => void;
  onClear: () => void;
  onSubmit: () => void;
}

function GameToolbar({
  colors,
  bottomPadding,
  canDraw,
  isSubmitting,
  isEraser,
  strokeColor,
  strokeCount,
  onBrushPress,
  onColorPress,
  onEraserToggle,
  onUndo,
  onClear,
  onSubmit,
}: GameToolbarProps) {
  return (
    <View style={[styles.toolbar, { paddingBottom: bottomPadding + 8 }]}> 
      <View style={styles.toolGroup}>
        <Pressable
          onPress={onBrushPress}
          style={[
            styles.toolButton,
            { backgroundColor: colors.card },
            !isEraser && styles.toolButtonActive,
          ]}
          disabled={!canDraw}
          accessibilityRole="button"
          accessibilityLabel="Select brush size"
        >
          <Ionicons
            name="brush"
            size={22}
            color={!isEraser ? colors.tint : colors.textSecondary}
          />
        </Pressable>

        <Pressable
          onPress={onColorPress}
          style={[styles.toolButton, { backgroundColor: colors.card }]}
          disabled={!canDraw}
          accessibilityRole="button"
          accessibilityLabel="Select brush color"
        >
          <View
            style={[
              styles.colorSwatch,
              {
                backgroundColor: strokeColor,
                borderColor:
                  strokeColor === "#FFFFFF" ? colors.border : "transparent",
              },
            ]}
          />
        </Pressable>

        <Pressable
          onPress={onEraserToggle}
          style={[
            styles.toolButton,
            { backgroundColor: colors.card },
            isEraser && styles.toolButtonActive,
          ]}
          disabled={!canDraw}
          accessibilityRole="button"
          accessibilityLabel={isEraser ? "Switch to brush" : "Switch to eraser"}
          accessibilityState={{ selected: isEraser }}
        >
          <Ionicons
            name="remove-circle-outline"
            size={22}
            color={isEraser ? colors.tint : colors.textSecondary}
          />
        </Pressable>
      </View>

      <View style={styles.toolGroup}>
        <Pressable
          onPress={onUndo}
          style={[
            styles.toolButton,
            { backgroundColor: colors.card },
            strokeCount === 0 && styles.toolButtonDisabled,
          ]}
          disabled={strokeCount === 0 || !canDraw}
          accessibilityRole="button"
          accessibilityLabel="Undo last stroke"
        >
          <Ionicons
            name="arrow-undo"
            size={22}
            color={strokeCount > 0 ? colors.textSecondary : colors.border}
          />
        </Pressable>

        <Pressable
          onPress={onClear}
          style={[
            styles.toolButton,
            { backgroundColor: colors.card },
            strokeCount === 0 && styles.toolButtonDisabled,
          ]}
          disabled={strokeCount === 0 || !canDraw}
          accessibilityRole="button"
          accessibilityLabel="Clear canvas"
        >
          <Ionicons
            name="trash"
            size={22}
            color={strokeCount > 0 ? colors.error : colors.border}
          />
        </Pressable>
      </View>

      <Pressable
        onPress={onSubmit}
        style={[
          styles.submitButton,
          { backgroundColor: colors.tint },
          (!canDraw || isSubmitting) && styles.submitButtonDisabled,
        ]}
        disabled={!canDraw || isSubmitting}
        accessibilityRole="button"
        accessibilityLabel="Submit your drawing and end turn"
      >
        <Ionicons name="checkmark" size={24} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  toolGroup: {
    flexDirection: "row",
    gap: 8,
  },
  toolButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  toolButtonActive: {
    borderWidth: 2,
    borderColor: "#6C5CE7",
  },
  toolButtonDisabled: {
    opacity: 0.5,
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
  },
  submitButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
});

export default React.memo(GameToolbar);
