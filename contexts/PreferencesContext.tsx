import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Appearance, Platform } from "react-native";
import {
  DEFAULT_PREFERENCES,
  type AppearancePreference,
  type AppPreferences,
} from "@/lib/preferences/appPreferences";
import { loadPreferences, savePreferences } from "@/lib/preferences/storage";
import { setHapticsEnabled as applyHapticsSetting } from "@/lib/platformFeedback";

type PreferencesContextValue = AppPreferences & {
  /** False until saved settings have been read, so the first screen uses the right theme. */
  loaded: boolean;
  setAppearance(appearance: AppearancePreference): void;
  setHapticsEnabled(enabled: boolean): void;
};

const PreferencesContext = createContext<PreferencesContextValue>({
  ...DEFAULT_PREFERENCES,
  loaded: true,
  setAppearance: () => undefined,
  setHapticsEnabled: () => undefined,
});

/**
 * Applies a Light/Dark choice to native system UI too (alerts, keyboard,
 * status bar). "unspecified" hands control back to the phone's setting.
 */
function applyNativeAppearance(appearance: AppearancePreference) {
  if (Platform.OS === "web" || typeof Appearance.setColorScheme !== "function") return;
  try {
    Appearance.setColorScheme(appearance === "system" ? "unspecified" : appearance);
  } catch (error) {
    console.warn("[preferences] Could not apply appearance to system UI:", error);
  }
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_PREFERENCES);
  const [loaded, setLoaded] = useState(false);
  // The latest settings, so quick successive changes each build on the last.
  const preferencesRef = useRef<AppPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    let mounted = true;
    void loadPreferences().then((saved) => {
      if (!mounted) return;
      preferencesRef.current = saved;
      setPreferences(saved);
      setLoaded(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    applyHapticsSetting(preferences.hapticsEnabled);
  }, [preferences.hapticsEnabled]);

  useEffect(() => {
    if (loaded) applyNativeAppearance(preferences.appearance);
  }, [loaded, preferences.appearance]);

  const update = useCallback((change: Partial<AppPreferences>) => {
    const next = { ...preferencesRef.current, ...change };
    preferencesRef.current = next;
    setPreferences(next);
    void savePreferences(next);
  }, []);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      ...preferences,
      loaded,
      setAppearance: (appearance) => update({ appearance }),
      setHapticsEnabled: (enabled) => {
        // Apply at once so a confirming tap right after turning haptics on is felt.
        applyHapticsSetting(enabled);
        update({ hapticsEnabled: enabled });
      },
    }),
    [preferences, loaded, update],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  return useContext(PreferencesContext);
}
