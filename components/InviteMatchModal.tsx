import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import BaseModal from "@/components/BaseModal";
import type { ThemeColors } from "@/hooks/useThemeColors";

interface InviteMatchModalProps {
  visible: boolean;
  colors: ThemeColors;
  friendName: string;
  error: string | null;
  onCancel: () => void;
}

/** Shown while both players join the private room an accepted invite reserved. */
export default function InviteMatchModal({ visible, colors, friendName, error, onCancel }: InviteMatchModalProps) {
  return (
    <BaseModal
      visible={visible}
      onClose={onCancel}
      title={error ? "Match didn't start" : "Starting match"}
      closeLabel={error ? "Close" : "Cancel"}
      dismissOnOverlay={false}
    >
      <View style={styles.body} accessibilityLiveRegion="polite">
        {error ? (
          <Text style={[styles.text, { color: colors.error }]}>{error}</Text>
        ) : (
          <>
            <ActivityIndicator size="large" color={colors.tint} />
            <Text style={[styles.text, { color: colors.text }]}>Getting you and {friendName} into a match…</Text>
          </>
        )}
        <Pressable
          onPress={onCancel}
          style={[styles.button, { borderColor: colors.border }]}
          accessibilityRole="button"
        >
          <Text style={[styles.buttonText, { color: colors.text }]}>{error ? "Close" : "Cancel"}</Text>
        </Pressable>
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: "center", gap: 16 },
  text: { fontSize: 15, fontFamily: "Inter_500Medium", textAlign: "center", lineHeight: 21 },
  button: { paddingVertical: 10, paddingHorizontal: 28, borderRadius: 12, borderWidth: 1 },
  buttonText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
