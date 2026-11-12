import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREFERENCES,
  parsePreferences,
  resolveColorScheme,
  serializePreferences,
} from "@/lib/preferences/appPreferences";

describe("parsePreferences", () => {
  it("defaults to following the system with haptics on", () => {
    expect(DEFAULT_PREFERENCES).toEqual({ appearance: "system", hapticsEnabled: true });
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences("")).toEqual(DEFAULT_PREFERENCES);
  });

  it("round-trips saved choices", () => {
    const saved = { appearance: "dark", hapticsEnabled: false } as const;
    expect(parsePreferences(serializePreferences(saved))).toEqual(saved);
  });

  it("falls back to defaults for damaged or unexpected data", () => {
    expect(parsePreferences("{not json")).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences("42")).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences("null")).toEqual(DEFAULT_PREFERENCES);
  });

  it("keeps valid fields and replaces only invalid ones", () => {
    expect(parsePreferences(JSON.stringify({ appearance: "purple", hapticsEnabled: false }))).toEqual({
      appearance: "system",
      hapticsEnabled: false,
    });
    expect(parsePreferences(JSON.stringify({ appearance: "light", hapticsEnabled: "no" }))).toEqual({
      appearance: "light",
      hapticsEnabled: true,
    });
  });

  it("does not return a shared default object that callers could mutate", () => {
    const parsed = parsePreferences(null);
    parsed.hapticsEnabled = false;
    expect(DEFAULT_PREFERENCES.hapticsEnabled).toBe(true);
  });
});

describe("resolveColorScheme", () => {
  it("follows the phone when set to System", () => {
    expect(resolveColorScheme("system", "dark")).toBe("dark");
    expect(resolveColorScheme("system", "light")).toBe("light");
    expect(resolveColorScheme("system", null)).toBe("light");
    expect(resolveColorScheme("system", undefined)).toBe("light");
  });

  it("overrides the phone when set to Light or Dark", () => {
    expect(resolveColorScheme("light", "dark")).toBe("light");
    expect(resolveColorScheme("dark", "light")).toBe("dark");
    expect(resolveColorScheme("dark", null)).toBe("dark");
  });
});
