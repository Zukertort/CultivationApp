/**
 * React Native's Alert shows no buttons on the web build, so confirmations
 * (lock, delete, repent) couldn't be answered there. On the web only, map
 * Alert.alert to the browser's confirm: OK runs the first non-cancel button.
 * Android and iOS keep the native dialog.
 */
import { Alert, Platform } from "react-native";

if (Platform.OS === "web" && typeof window !== "undefined") {
  Alert.alert = (title, message, buttons) => {
    const text = String(message ? `${title}\n\n${message}` : title);
    const action = buttons?.find((b) => b.style !== "cancel");
    if (!buttons || buttons.length <= 1) {
      window.alert(text);
      action?.onPress?.();
      return;
    }
    if (window.confirm(text)) action?.onPress?.();
    else buttons.find((b) => b.style === "cancel")?.onPress?.();
  };
}
