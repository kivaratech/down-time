import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

// Sends the device's Expo push token to the server. The server upserts into
// supervisor_devices keyed on (supervisorId, token) — repeated calls with the
// same tuple are no-ops (just bump lastSeenAt), so we don't need a local
// AsyncStorage cache to deduplicate. The previous local cache caused a
// silent multi-device bug: two devices for the same supervisor would each
// cache locally and skip re-registration, but the server's old single-token
// column meant whichever registered last "won". The new per-device table +
// server-side upsert fixes both the dedupe AND the multi-device fanout.
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
      return;
    }
    console.log("[notifications] Push token saved to server ✓");
  } catch (err) {
    console.warn("[notifications] Failed to send push token to server:", err);
  }
}

function getProjectId(): string | undefined {
  const id =
    (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ||
    ((Constants as Record<string, unknown>).easConfig as { projectId?: string } | undefined)?.projectId ||
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  return id || undefined;
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
      "[notifications] EAS project ID is missing — push token cannot be obtained.\n" +
      "Fix: run `eas build:configure` inside artifacts/mobile, then copy the UUID\n" +
      "into app.json at extra.eas.projectId."
    );
    return;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log("[notifications] Got push token:", tokenData.data.slice(0, 30) + "…");
    await sendTokenToServer(tokenData.data, authToken);
  } catch (err) {
    console.warn("[notifications] Failed to get Expo push token:", err);
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
      // shouldShowAlert was split into shouldShowBanner (transient alert) +
      // shouldShowList (in notification tray) in the SDK 54-era expo-notifications.
      // Keeping the old field triggers a deprecation warning on every received
      // notification.
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}
