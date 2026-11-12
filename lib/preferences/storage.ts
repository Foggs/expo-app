import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_PREFERENCES,
  parsePreferences,
  serializePreferences,
  type AppPreferences,
} from "@/lib/preferences/appPreferences";

const PREFERENCES_KEY = "sketchduel_preferences";

export async function loadPreferences(): Promise<AppPreferences> {
  try {
    return parsePreferences(await AsyncStorage.getItem(PREFERENCES_KEY));
  } catch (error) {
    console.warn("[preferences] Could not read saved settings; using defaults:", error);
    return { ...DEFAULT_PREFERENCES };
  }
}

/** Returns false when the setting could not be saved (it still applies until the app closes). */
export async function savePreferences(preferences: AppPreferences): Promise<boolean> {
  try {
    await AsyncStorage.setItem(PREFERENCES_KEY, serializePreferences(preferences));
    return true;
  } catch (error) {
    console.warn("[preferences] Could not save settings:", error);
    return false;
  }
}
