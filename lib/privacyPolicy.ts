import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";

/**
 * The privacy policy URL is configured once in app.json (expo.extra) so the
 * in-app link and the App Store Connect listing stay in sync.
 */
export function getPrivacyPolicyUrl(): string | null {
  const value = Constants.expoConfig?.extra?.privacyPolicyUrl;
  if (typeof value !== "string" || !value.startsWith("https://")) {
    return null;
  }
  return value;
}

export async function openPrivacyPolicy(): Promise<void> {
  const url = getPrivacyPolicyUrl();
  if (!url) {
    console.warn("[privacyPolicy] No valid privacy policy URL configured");
    return;
  }
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch (err) {
    console.warn(
      "[privacyPolicy] Failed to open privacy policy:",
      err instanceof Error ? err.message : err,
    );
  }
}
