import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import BaseModal from "@/components/BaseModal";
import { useThemeColors } from "@/hooks/useThemeColors";

const RULES = [
  {
    title: "Two players. One drawing.",
    description: "Work together on the same image, taking turns adding to what the other player draws.",
    icon: "people-outline" as const,
  },
  {
    title: "One minute per turn.",
    description: "Each player gets a one-minute turn in each of three rounds.",
    icon: "timer-outline" as const,
  },
  {
    title: "Watch it happen live.",
    description: "While you wait for your turn, watch the other player draw in real time.",
    icon: "eye-outline" as const,
  },
  {
    title: "Keep your creation.",
    description: "When the game ends, save your finished artwork to the Gallery.",
    icon: "images-outline" as const,
  },
];

interface HomeHowToPlayModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function HomeHowToPlayModal({ visible, onClose }: HomeHowToPlayModalProps) {
  const { colors } = useThemeColors();
  const { height } = useWindowDimensions();

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title="How to Play"
      closeLabel="Close How to Play"
      maxWidth={440}
      cardStyle={[styles.card, { maxHeight: height * 0.9 }]}
    >
      <ScrollView
        style={[styles.scroll, { maxHeight: height * 0.56 }]}
        contentContainerStyle={styles.rules}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {RULES.map((rule) => (
          <View key={rule.title} style={[styles.rule, { borderBottomColor: colors.border }]}>
            <View style={[styles.iconWrap, { backgroundColor: colors.tint + "1A" }]}>
              <Ionicons name={rule.icon} size={21} color={colors.tint} />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.ruleTitle, { color: colors.text }]} maxFontSizeMultiplier={1.6}>
                {rule.title}
              </Text>
              <Text style={[styles.description, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.6}>
                {rule.description}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
      <Pressable
        onPress={onClose}
        style={({ pressed }) => [
          styles.goButton,
          { backgroundColor: colors.tint },
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Let's Go!"
      >
        <Text style={styles.goText} maxFontSizeMultiplier={1.4}>Let&apos;s Go!</Text>
        <Ionicons name="arrow-forward" size={18} color="#fff" />
      </Pressable>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingBottom: 16,
  },
  rules: {
    paddingBottom: 8,
  },
  scroll: {
    flexShrink: 1,
  },
  rule: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  ruleTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: "Inter_600SemiBold",
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
  },
  goButton: {
    minHeight: 50,
    borderRadius: 16,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 20,
  },
  goText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  pressed: {
    opacity: 0.82,
  },
});
