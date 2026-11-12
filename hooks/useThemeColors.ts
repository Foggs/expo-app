import { useColorScheme } from "react-native";
import Colors from "@/constants/colors";
import { usePreferences } from "@/contexts/PreferencesContext";
import { resolveColorScheme } from "@/lib/preferences/appPreferences";

export type ThemeColors = typeof Colors.light;

/** Colors for the player's Appearance setting (System follows the phone). */
export function useThemeColors() {
  const systemScheme = useColorScheme();
  const { appearance } = usePreferences();
  const isDark = resolveColorScheme(appearance, systemScheme) === "dark";
  const colors: ThemeColors = isDark ? Colors.dark : Colors.light;

  return { isDark, colors };
}
