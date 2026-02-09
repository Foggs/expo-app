import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const SESSION_TOKEN_KEY = "sketchduel_session_token";

let cachedToken: string | null = null;

function generateToken(): string {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).substr(2, 9) +
    Math.random().toString(36).substr(2, 9)
  );
}

export async function getSessionToken(): Promise<string> {
  if (cachedToken) return cachedToken;

  try {
    if (Platform.OS === "web") {
      const stored = localStorage.getItem(SESSION_TOKEN_KEY);
      if (stored) {
        cachedToken = stored;
        return stored;
      }
      const token = generateToken();
      localStorage.setItem(SESSION_TOKEN_KEY, token);
      cachedToken = token;
      return token;
    }

    const stored = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    if (stored) {
      cachedToken = stored;
      return stored;
    }
    const token = generateToken();
    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
    cachedToken = token;
    return token;
  } catch {
    const token = generateToken();
    cachedToken = token;
    return token;
  }
}
