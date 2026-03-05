import { Alert, Platform } from "react-native";

interface ConfirmActionOptions {
  title: string;
  message: string;
  webMessage?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

export function showPlatformAlert(
  title: string,
  message: string,
  onAcknowledge?: () => void,
  webMessage?: string
) {
  if (Platform.OS === "web") {
    alert(webMessage ?? message);
    onAcknowledge?.();
    return;
  }

  Alert.alert(title, message, [{ text: "OK", onPress: onAcknowledge }]);
}

export function confirmAction(options: ConfirmActionOptions) {
  const {
    title,
    message,
    webMessage,
    confirmText = "OK",
    cancelText = "Cancel",
    destructive = false,
    onConfirm,
    onCancel,
  } = options;

  if (Platform.OS === "web") {
    if (confirm(webMessage ?? `${title}\n${message}`)) {
      onConfirm();
    } else {
      onCancel?.();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: cancelText, style: "cancel", onPress: onCancel },
    {
      text: confirmText,
      style: destructive ? "destructive" : "default",
      onPress: onConfirm,
    },
  ]);
}
