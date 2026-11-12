import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePlayerIdentity } from "@/contexts/PlayerIdentityContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useSocial } from "@/contexts/SocialContext";
import { useScreenPadding } from "@/hooks/useScreenPadding";
import { useThemeColors, type ThemeColors } from "@/hooks/useThemeColors";
import { getAppVersionLabel } from "@/lib/appVersion";
import { impactLight } from "@/lib/platformFeedback";
import type { AppearancePreference } from "@/lib/preferences/appPreferences";
import { openPrivacyPolicy } from "@/lib/privacyPolicy";
import { openRateApp } from "@/lib/rateApp";
import { describeGameCenterStatus } from "@/lib/social/friendsAvailability";
import { openSupportContact } from "@/lib/supportContact";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const APPEARANCE_CHOICES: { value: AppearancePreference; label: string; icon: IconName }[] = [
  { value: "system", label: "System", icon: "phone-portrait-outline" },
  { value: "light", label: "Light", icon: "sunny-outline" },
  { value: "dark", label: "Dark", icon: "moon-outline" },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeColors();
  const { topPadding, bottomPadding } = useScreenPadding(insets);
  const preferences = usePreferences();
  const identity = usePlayerIdentity();
  const { availability } = useSocial();
  const gameCenter = describeGameCenterStatus(availability, identity.displayName);
  const hapticsSupported = Platform.OS !== "web";

  const handleBack = () => {
    impactLight();
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const runAction = (action: () => Promise<void>) => () => {
    impactLight();
    void action();
  };

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
          Settings
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Section title="Appearance" colors={colors}>
          <View style={styles.segmented} accessibilityRole="radiogroup" accessibilityLabel="Appearance">
            {APPEARANCE_CHOICES.map((choice) => {
              const selected = preferences.appearance === choice.value;
              return (
                <Pressable
                  key={choice.value}
                  onPress={() => {
                    impactLight();
                    preferences.setAppearance(choice.value);
                  }}
                  style={[
                    styles.segment,
                    {
                      borderColor: selected ? colors.tint : colors.border,
                      backgroundColor: selected ? colors.tint + "1A" : "transparent",
                    },
                  ]}
                  accessibilityRole="radio"
                  accessibilityLabel={choice.label}
                  accessibilityState={{ checked: selected }}
                >
                  <Ionicons name={choice.icon} size={20} color={selected ? colors.tint : colors.textSecondary} />
                  <Text
                    style={[styles.segmentText, { color: selected ? colors.tint : colors.text }]}
                    numberOfLines={1}
                    maxFontSizeMultiplier={1.4}
                  >
                    {choice.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.footnote, { color: colors.textSecondary }]}>
            System matches your phone&apos;s light or dark setting.
          </Text>
        </Section>

        <Section title="Haptics" colors={colors}>
          <View style={styles.row}>
            <Ionicons name="pulse-outline" size={22} color={colors.tint} />
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Haptic feedback</Text>
              <Text style={[styles.rowDetail, { color: colors.textSecondary }]}>
                {hapticsSupported
                  ? "Gentle vibrations for taps, turns and matches."
                  : "Available in the iPhone app."}
              </Text>
            </View>
            <Switch
              value={preferences.hapticsEnabled}
              onValueChange={(enabled) => {
                preferences.setHapticsEnabled(enabled);
                if (enabled) impactLight();
              }}
              trackColor={{ false: colors.border, true: colors.tint }}
              thumbColor="#ffffff"
              ios_backgroundColor={colors.border}
              accessibilityLabel="Haptic feedback"
            />
          </View>
        </Section>

        <Section title="Support" colors={colors}>
          <LinkRow icon="shield-checkmark-outline" label="Privacy Policy" colors={colors} onPress={runAction(openPrivacyPolicy)} hint="Opens the SketchDuel privacy policy" />
          <Divider colors={colors} />
          <LinkRow icon="mail-outline" label="Send Feedback" colors={colors} onPress={runAction(openSupportContact)} hint="Opens an email to SketchDuel support" />
          <Divider colors={colors} />
          <LinkRow icon="star-outline" label="Rate SketchDuel" colors={colors} onPress={runAction(openRateApp)} hint="Opens the App Store rating page when SketchDuel is available there" />
        </Section>

        <Section title="About" colors={colors}>
          <View style={styles.row} accessible accessibilityLabel={`Game Center: ${gameCenter.label}. ${gameCenter.detail}`}>
            <Ionicons name="game-controller-outline" size={22} color={colors.tint} />
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Game Center</Text>
              <Text style={[styles.rowDetail, { color: colors.textSecondary }]}>{gameCenter.detail}</Text>
            </View>
            <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{gameCenter.label}</Text>
          </View>
          <Divider colors={colors} />
          <View style={styles.row} accessible accessibilityLabel={`Version ${getAppVersionLabel()}`}>
            <Ionicons name="information-circle-outline" size={22} color={colors.tint} />
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Version</Text>
            </View>
            <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{getAppVersionLabel()}</Text>
          </View>
        </Section>

        <Text style={[styles.footnote, styles.centered, { color: colors.textSecondary }]}>
          Appearance and haptics are saved on this device only.
        </Text>
      </ScrollView>
    </View>
  );
}

function Section({ title, colors, children }: { title: string; colors: ThemeColors; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]} accessibilityRole="header">
        {title}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.card }]}>{children}</View>
    </View>
  );
}

function Divider({ colors }: { colors: ThemeColors }) {
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

function LinkRow({
  icon,
  label,
  hint,
  colors,
  onPress,
}: {
  icon: IconName;
  label: string;
  hint: string;
  colors: ThemeColors;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
    >
      <Ionicons name={icon} size={22} color={colors.tint} />
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 20, fontFamily: "Inter_600SemiBold" },
  placeholder: { width: 44 },
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 22, width: "100%", maxWidth: 560, alignSelf: "center" },
  section: { gap: 8 },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    paddingHorizontal: 4,
  },
  card: { borderRadius: 16, padding: 12, gap: 10 },
  segmented: { flexDirection: "row", gap: 8 },
  segment: {
    flex: 1,
    minHeight: 64,
    borderWidth: 1.5,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  segmentText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44, paddingVertical: 4 },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 16, fontFamily: "Inter_500Medium" },
  rowDetail: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  rowValue: { fontSize: 14, fontFamily: "Inter_500Medium", flexShrink: 0, maxWidth: "45%", textAlign: "right" },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 34 },
  footnote: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16, paddingHorizontal: 4 },
  centered: { textAlign: "center" },
  pressed: { opacity: 0.6 },
});
