import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

// Cache the most recent (authToken, pushToken) pair we registered with the
// server, keyed under one AsyncStorage key. Skipping a redundant send when
// neither value has changed avoids chatty re-registration when /auth/me +
// loadSession + loginSupervisor all fire in quick succession. Cleared on
// logout by clearPushTokenCache() below so a different user logging in on
// the same device gets a fresh registration under their supervisor row.
const LAST_REGISTERED_KEY = "downtime_last_push_token_registration";

async function sendTokenToServer(pushToken: string, authToken: string): Promise<void> {
  const cacheValue = `${authToken}|${pushToken}`;
  try {
    const cached = await AsyncStorage.getItem(LAST_REGISTERED_KEY);
    if (cached === cacheValue) {
      console.log("[notifications] Push token already registered for this session, skipping");
      return;
    }
  } catch {
    // Cache read failures are non-fatal — fall through and send.
  }

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
    try {
      await AsyncStorage.setItem(LAST_REGISTERED_KEY, cacheValue);
    } catch {
      // Cache write failures are non-fatal — token is on the server, just
      // means the next call won't get the skip optimisation.
    }
  } catch (err) {
    console.warn("[notifications] Failed to send push token to server:", err);
  }
}

// Called by AuthContext on logout / auth-failure for hygiene — strips the
// previous (authToken, pushToken) tuple from local storage. Correctness
// doesn't strictly need this (a new login produces a different authToken
// so the cache would miss anyway and re-register), but leaving stale
// bearer tokens in AsyncStorage indefinitely is bad form even if the
// server has already invalidated them.
export async function clearPushTokenCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LAST_REGISTERED_KEY);
  } catch {
    // Non-fatal.
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
