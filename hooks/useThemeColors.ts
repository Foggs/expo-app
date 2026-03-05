import { useColorScheme } from "react-native";
import Colors from "@/constants/colors";

export type ThemeColors = typeof Colors.light;

export function useThemeColors() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors: ThemeColors = isDark ? Colors.dark : Colors.light;

  return { isDark, colors };
}
