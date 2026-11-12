import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

let hapticsEnabled = true;

/** Follows the player's Haptic feedback setting; every helper below respects it. */
export function setHapticsEnabled(enabled: boolean) {
  hapticsEnabled = enabled;
}

function runNative(action: () => void) {
  if (Platform.OS !== "web" && hapticsEnabled) {
    action();
  }
}

export function impactLight() {
  runNative(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  });
}

export function impactMedium() {
  runNative(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  });
}

export function impactHeavy() {
  runNative(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  });
}

export function notifySuccess() {
  runNative(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  });
}

export function notifyWarning() {
  runNative(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  });
}

export function notifyError() {
  runNative(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  });
}
