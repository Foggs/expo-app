import Constants from "expo-constants";
import { Linking } from "react-native";
import { getAppVersionLabel } from "@/lib/appVersion";
import { showPlatformAlert } from "@/lib/platformDialogs";

export function getSupportEmail(): string {
  const value = Constants.expoConfig?.extra?.supportEmail;
  return typeof value === "string" && value.includes("@")
    ? value
    : "support@sketchduel.app";
}

/** Opens an email to SketchDuel support, or explains how to reach it when no email app can open. */
export async function openSupportContact(): Promise<void> {
  const email = getSupportEmail();
  const subject = encodeURIComponent("SketchDuel Feedback");
  const body = encodeURIComponent(`\n\n—\nSketchDuel ${getAppVersionLabel()}`);
  try {
    await Linking.openURL(`mailto:${email}?subject=${subject}&body=${body}`);
  } catch (error) {
    console.warn("[supportContact] Unable to open email client:", error);
    showPlatformAlert(
      "No email app available",
      `Send your feedback to ${email} from any email app.`,
    );
  }
}
