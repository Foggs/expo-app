import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

function runNative(action: () => void) {
  if (Platform.OS !== "web") {
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
