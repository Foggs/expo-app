import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const SESSION_TOKEN_KEY = "sketchduel_session_token";
const ASYNC_STORAGE_FALLBACK_KEY = "sketchduel_session_token_fallback";

let cachedToken: string | null = null;

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getSessionToken(): Promise<string> {
  if (cachedToken) return cachedToken;

  if (Platform.OS === "web") {
    try {
      const stored = localStorage.getItem(SESSION_TOKEN_KEY);
      if (stored) {
        cachedToken = stored;
        return stored;
      }
      const token = generateToken();
      localStorage.setItem(SESSION_TOKEN_KEY, token);
      cachedToken = token;
      return token;
    } catch {
      const token = generateToken();
      cachedToken = token;
      return token;
    }
  }

  // Native: try SecureStore first, fall back to AsyncStorage.
  try {
    const stored = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    if (stored) {
      cachedToken = stored;
      return stored;
    }
    const token = generateToken();
    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
    cachedToken = token;
    return token;
  } catch (secureErr) {
    console.warn("[sessionToken] SecureStore unavailable, using AsyncStorage fallback:", secureErr);
  }

  try {
    const stored = await AsyncStorage.getItem(ASYNC_STORAGE_FALLBACK_KEY);
    if (stored) {
      cachedToken = stored;
      return stored;
    }
    const token = generateToken();
    await AsyncStorage.setItem(ASYNC_STORAGE_FALLBACK_KEY, token);
    cachedToken = token;
    return token;
  } catch (asyncErr) {
    console.warn("[sessionToken] AsyncStorage also unavailable:", asyncErr);
    const token = generateToken();
    cachedToken = token;
    return token;
  }
}
