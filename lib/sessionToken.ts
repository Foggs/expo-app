import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getRandomBytes } from "expo-crypto";
import { Platform } from "react-native";
import type { StoredGameCenterLink } from "@/lib/identity/gameCenterLink";

const SESSION_TOKEN_KEY = "sketchduel_session_token";
const ASYNC_STORAGE_FALLBACK_KEY = "sketchduel_session_token_fallback";
const GAME_CENTER_LINK_KEY = "sketchduel_game_center_link";
const GAME_CENTER_LINK_FALLBACK_KEY = "sketchduel_game_center_link_fallback";

/** Longest that requests wait for the launch-time Game Center check. */
const IDENTITY_CHECK_WAIT_MS = 15_000;

let cachedToken: string | null = null;
let identityCheck: Promise<unknown> | null = null;

function generateToken(): string {
  const bytes = getRandomBytes(32);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function readValue(key: string, fallbackKey: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch (secureErr) {
    console.warn("[sessionToken] SecureStore unavailable, using AsyncStorage fallback:", secureErr);
  }
  try {
    return await AsyncStorage.getItem(fallbackKey);
  } catch (asyncErr) {
    console.warn("[sessionToken] AsyncStorage also unavailable:", asyncErr);
    return null;
  }
}

/** Returns false when nothing could persist the value. */
async function writeValue(key: string, fallbackKey: string, value: string | null): Promise<boolean> {
  if (Platform.OS === "web") {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }
  try {
    if (value === null) await SecureStore.deleteItemAsync(key);
    else await SecureStore.setItemAsync(key, value);
    return true;
  } catch (secureErr) {
    console.warn("[sessionToken] SecureStore unavailable, using AsyncStorage fallback:", secureErr);
  }
  try {
    if (value === null) await AsyncStorage.removeItem(fallbackKey);
    else await AsyncStorage.setItem(fallbackKey, value);
    return true;
  } catch (asyncErr) {
    console.warn("[sessionToken] AsyncStorage also unavailable:", asyncErr);
    return false;
  }
}

/**
 * The device token without waiting for the Game Center check. Only the
 * identity check itself should use this; everything else uses
 * getSessionToken so it never sends a token that is about to be replaced.
 */
export async function getDeviceSessionToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const stored = await readValue(SESSION_TOKEN_KEY, ASYNC_STORAGE_FALLBACK_KEY);
  if (stored) {
    cachedToken = stored;
    return stored;
  }
  const token = generateToken();
  await writeValue(SESSION_TOKEN_KEY, ASYNC_STORAGE_FALLBACK_KEY, token);
  cachedToken = token;
  return token;
}

export async function getSessionToken(): Promise<string> {
  if (identityCheck) {
    await Promise.race([
      identityCheck.catch(() => undefined),
      new Promise((resolveWait) => setTimeout(resolveWait, IDENTITY_CHECK_WAIT_MS)),
    ]);
  }
  return getDeviceSessionToken();
}

/** Makes getSessionToken wait (up to 15 s) until this identity check settles. */
export function holdSessionTokenUntil(check: Promise<unknown>): void {
  identityCheck = check;
  void check.catch(() => undefined).finally(() => {
    if (identityCheck === check) identityCheck = null;
  });
}

/**
 * Replaces the device token with a new random one: a fresh anonymous
 * identity. Throws if the new token cannot be saved, because keeping the old
 * token would let the next person act as the previous player.
 */
export async function rotateSessionToken(): Promise<void> {
  const token = generateToken();
  cachedToken = token;
  const saved = await writeValue(SESSION_TOKEN_KEY, ASYNC_STORAGE_FALLBACK_KEY, token);
  if (!saved) throw new Error("Could not save a new device identity");
}

export async function getStoredGameCenterLink(): Promise<StoredGameCenterLink | null> {
  const raw = await readValue(GAME_CENTER_LINK_KEY, GAME_CENTER_LINK_FALLBACK_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredGameCenterLink>;
    if (typeof parsed.playerId === "string") {
      return { playerId: parsed.playerId, confirmed: parsed.confirmed === true };
    }
  } catch {
    // Fall through: an unreadable record is treated as an unconfirmed link.
  }
  return { playerId: "", confirmed: false };
}

export async function setStoredGameCenterLink(link: StoredGameCenterLink | null): Promise<void> {
  const saved = await writeValue(
    GAME_CENTER_LINK_KEY,
    GAME_CENTER_LINK_FALLBACK_KEY,
    link === null ? null : JSON.stringify(link),
  );
  if (!saved) throw new Error("Could not save the Game Center link state");
}
