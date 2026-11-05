import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import BaseModal from "@/components/BaseModal";
import type { ThemeColors } from "@/hooks/useThemeColors";

export const REPORT_REASONS = [
  { value: "harassment", label: "Harassment or bullying" },
  { value: "sexual_content", label: "Sexual content" },
  { value: "violence", label: "Violence" },
  { value: "hate_speech", label: "Hate speech" },
  { value: "spam", label: "Spam" },
  { value: "other", label: "Other" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

interface ReportActionButtonProps {
  colors: ThemeColors;
  label?: string;
  disabled?: boolean;
  onSelectReason: (reason: ReportReason) => void;
}

export default function ReportActionButton({
  colors,
  label = "Report",
  disabled = false,
  onSelectReason,
}: ReportActionButtonProps) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const handlePress = () => setPickerVisible(true);
  const closePicker = () => setPickerVisible(false);

  return (
    <>
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.button,
          { borderColor: colors.border, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Ionicons name="flag-outline" size={16} color={colors.error} />
        <Text style={[styles.label, { color: colors.error }]}>{label}</Text>
      </Pressable>
      <BaseModal
        visible={pickerVisible}
        onClose={closePicker}
        title="Report content"
        closeLabel="Close report options"
      >
        <View style={styles.reasonList}>
          <Text style={[styles.reasonHint, { color: colors.textSecondary }]}>
            Choose the reason that best describes the issue.
          </Text>
          {REPORT_REASONS.map(({ label: reasonLabel, value }) => (
            <Pressable
              key={value}
              onPress={() => {
                closePicker();
                onSelectReason(value);
              }}
              style={[styles.reasonOption, { borderColor: colors.border }]}
              accessibilityRole="button"
            >
              <Text style={[styles.reasonOptionText, { color: colors.text }]}>{reasonLabel}</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={closePicker}
            style={styles.cancelOption}
            accessibilityRole="button"
          >
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
          </Pressable>
        </View>
      </BaseModal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  reasonList: {
    gap: 8,
  },
  reasonHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    marginBottom: 4,
  },
  reasonOption: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  reasonOptionText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  cancelOption: {
    alignItems: "center",
    padding: 8,
    marginTop: 2,
  },
  cancelText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
});
