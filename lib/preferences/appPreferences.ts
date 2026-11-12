/**
 * Settings saved on this device only. Nothing here is sent to the server or
 * tied to the player's account.
 */
export type AppearancePreference = "system" | "light" | "dark";

export type AppPreferences = {
  appearance: AppearancePreference;
  hapticsEnabled: boolean;
};

export const DEFAULT_PREFERENCES: AppPreferences = {
  appearance: "system",
  hapticsEnabled: true,
};

export const APPEARANCE_OPTIONS: readonly AppearancePreference[] = ["system", "light", "dark"];

function isAppearance(value: unknown): value is AppearancePreference {
  return typeof value === "string" && (APPEARANCE_OPTIONS as readonly string[]).includes(value);
}

/**
 * Reads saved preferences, keeping each valid field and using the default for
 * anything missing or unreadable, so a damaged value never blocks startup.
 */
export function parsePreferences(raw: string | null | undefined): AppPreferences {
  if (!raw) return { ...DEFAULT_PREFERENCES };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
  if (typeof parsed !== "object" || parsed === null) return { ...DEFAULT_PREFERENCES };
  const record = parsed as Record<string, unknown>;
  return {
    appearance: isAppearance(record.appearance) ? record.appearance : DEFAULT_PREFERENCES.appearance,
    hapticsEnabled:
      typeof record.hapticsEnabled === "boolean" ? record.hapticsEnabled : DEFAULT_PREFERENCES.hapticsEnabled,
  };
}

export function serializePreferences(preferences: AppPreferences): string {
  return JSON.stringify({
    appearance: preferences.appearance,
    hapticsEnabled: preferences.hapticsEnabled,
  });
}

/** The color scheme to draw with: the player's choice, or the phone's when following the system. */
export function resolveColorScheme(
  appearance: AppearancePreference,
  systemScheme: string | null | undefined,
): "light" | "dark" {
  if (appearance === "light" || appearance === "dark") return appearance;
  return systemScheme === "dark" ? "dark" : "light";
}
