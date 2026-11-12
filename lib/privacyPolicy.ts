import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { showPlatformAlert } from "@/lib/platformDialogs";

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
    showPlatformAlert("Privacy Policy unavailable", "The privacy policy link isn't set up in this version of SketchDuel.");
    return;
  }
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch (err) {
    console.warn(
      "[privacyPolicy] Failed to open privacy policy:",
      err instanceof Error ? err.message : err,
    );
    showPlatformAlert("Couldn't open Privacy Policy", `Visit ${url} in your browser to read it.`);
  }
}
