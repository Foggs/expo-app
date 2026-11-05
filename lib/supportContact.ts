import Constants from "expo-constants";
import { Linking } from "react-native";

export function getSupportEmail(): string {
  const value = Constants.expoConfig?.extra?.supportEmail;
  return typeof value === "string" && value.includes("@")
    ? value
    : "support@sketchduel.app";
}

export async function openSupportContact(): Promise<void> {
  const email = getSupportEmail();
  try {
    await Linking.openURL(`mailto:${email}`);
  } catch (error) {
    console.warn("[supportContact] Unable to open email client:", error);
  }
}
