import Constants from "expo-constants";
import { Linking, Platform } from "react-native";
import { showPlatformAlert } from "@/lib/platformDialogs";
import { isAppStoreListingPublic } from "@/lib/appStoreListing";

const LOOKUP_TIMEOUT_MS = 8_000;

/** The existing App Store Connect app record's numeric Apple ID, from app.json. */
export function getAppStoreId(): string | null {
  const value = Constants.expoConfig?.extra?.appStoreId;
  return typeof value === "string" && /^\d+$/.test(value) ? value : null;
}

async function lookUpListing(appStoreId: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetch(`https://itunes.apple.com/lookup?id=${appStoreId}`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`App Store lookup returned ${response.status}`);
    return isAppStoreListingPublic(await response.json(), appStoreId);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Opens the App Store's review page, only once SketchDuel's listing is public.
 * Before release (TestFlight) it explains that ratings are not open yet rather
 * than opening a broken page. It never claims a rating was submitted.
 */
export async function openRateApp(): Promise<void> {
  const appStoreId = getAppStoreId();
  if (!appStoreId) {
    showPlatformAlert("Rating unavailable", "Ratings aren't set up in this version of SketchDuel.");
    return;
  }

  let isPublic: boolean;
  try {
    isPublic = await lookUpListing(appStoreId);
  } catch (error) {
    console.warn("[rateApp] Could not check the App Store listing:", error);
    showPlatformAlert("Couldn't reach the App Store", "Check your connection and try again.");
    return;
  }

  if (!isPublic) {
    showPlatformAlert(
      "Ratings open at launch",
      "SketchDuel isn't on the App Store yet, so it can't be rated. Thanks for testing! Use Send Feedback to tell us what you think.",
    );
    return;
  }

  const webUrl = `https://apps.apple.com/app/id${appStoreId}?action=write-review`;
  const url = Platform.OS === "ios" ? `itms-apps://apps.apple.com/app/id${appStoreId}?action=write-review` : webUrl;
  try {
    await Linking.openURL(url);
  } catch (error) {
    console.warn("[rateApp] Could not open the App Store:", error);
    if (url !== webUrl) {
      try {
        await Linking.openURL(webUrl);
        return;
      } catch {
        // Fall through to the explanation below.
      }
    }
    showPlatformAlert("Couldn't open the App Store", "Search for SketchDuel in the App Store to leave a rating.");
  }
}
