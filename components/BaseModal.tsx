import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/hooks/useThemeColors";

interface BaseModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  closeLabel?: string;
  dismissOnOverlay?: boolean;
  maxWidth?: number;
  children: React.ReactNode;
}

export default function BaseModal({
  visible,
  onClose,
  title,
  closeLabel = "Close",
  dismissOnOverlay = true,
  maxWidth = 320,
  children,
}: BaseModalProps) {
  const { colors } = useThemeColors();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.overlay}
        onPress={dismissOnOverlay ? onClose : undefined}
      >
        <Pressable
          style={[styles.card, { backgroundColor: colors.card, maxWidth }]}
          onPress={(e) => e.stopPropagation()}
        >
          {title && (
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>
                {title}
              </Text>
              <Pressable
                onPress={onClose}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel={closeLabel}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
          )}
          {children}
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
  card: {
    width: "100%",
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
});
