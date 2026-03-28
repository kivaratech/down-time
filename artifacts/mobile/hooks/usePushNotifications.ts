import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

async function sendTokenToServer(pushToken: string, authToken: string): Promise<void> {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/supervisor/push-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token: pushToken }),
    });
    if (!res.ok) {
      console.warn("[notifications] Server rejected push token:", res.status);
    } else {
      console.log("[notifications] Push token saved to server ✓");
    }
  } catch (err) {
    console.warn("[notifications] Failed to send push token to server:", err);
  }
}

function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as Record<string, unknown>).easConfig?.projectId as string | undefined ??
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID
  );
}

export async function registerSupervisorPushToken(authToken: string): Promise<void> {
  if (Platform.OS === "web") return;

  if (!Device.isDevice) {
    console.log("[notifications] Push notifications require a physical device.");
    return;
  }

  let finalStatus: string;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
  } catch (err) {
    console.warn("[notifications] Permission check failed:", err);
    return;
  }

  if (finalStatus !== "granted") {
    console.log("[notifications] Push notification permissions not granted.");
    return;
  }

  const projectId = getProjectId();
  if (!projectId) {
    console.warn(
      "[notifications] No EAS project ID found. " +
      "Set EXPO_PUBLIC_EAS_PROJECT_ID in your environment or add " +
      "extra.eas.projectId to app.json. " +
      "Push notifications require a development build + EAS project."
    );
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    console.log("[notifications] Got push token:", tokenData.data.slice(0, 30) + "…");
    await sendTokenToServer(tokenData.data, authToken);
  } catch (err) {
    console.warn("[notifications] Failed to get Expo push token:", err);
    console.warn(
      "[notifications] To enable push notifications: " +
      "1) Use a development build (not Expo Go on Android/SDK53+), " +
      "2) Run `eas build:configure` to register an EAS project, " +
      "3) Set EXPO_PUBLIC_EAS_PROJECT_ID env var."
    );
  }
}

export function configurePushNotifications(): void {
  if (Platform.OS === "android") {
    Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#0F3460",
    });
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}
