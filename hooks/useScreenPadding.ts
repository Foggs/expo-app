import { Platform } from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";

interface ScreenPaddingOptions {
  topWeb?: number;
  bottomWeb?: number;
}

export function useScreenPadding(
  insets: EdgeInsets,
  options: ScreenPaddingOptions = {}
) {
  const { topWeb = 67, bottomWeb = 34 } = options;

  const topPadding = Platform.OS === "web" ? topWeb : insets.top;
  const bottomPadding = Platform.OS === "web" ? bottomWeb : insets.bottom;

  return { topPadding, bottomPadding };
}
