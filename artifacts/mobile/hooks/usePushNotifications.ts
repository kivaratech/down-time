import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { router } from "expo-router";
import { getIssue, getGetIssueQueryKey } from "@workspace/api-client-react";
import { useEffect, useRef } from "react";
import { InteractionManager, Platform } from "react-native";
import { queryClient } from "@/lib/queryClient";

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

// Pulls the issue id out of a tapped notification's data payload. The server
// sends `data: { type: "new_issue", issueId }` (see api-server
// lib/notifications.ts). Returns the id as a string ready for the route, or
// null if this notification isn't an issue notification.
function getIssueIdFromResponse(
  response: Notifications.NotificationResponse | null,
): string | null {
  const data = response?.notification.request.content.data as
    | { issueId?: number | string }
    | undefined;
  const id = data?.issueId;
  return id != null && id !== "" ? String(id) : null;
}

/**
 * Deep-links a tapped push notification straight to its issue detail screen.
 *
 * Handles both delivery cases:
 *  - Warm tap (app running / backgrounded): addNotificationResponseReceivedListener
 *  - Cold start (app launched by the tap): getLastNotificationResponseAsync
 *
 * `ready` should be false while auth is still loading. On a cold start the
 * navigation tree (and the issue route) isn't mounted yet, so we stash the id
 * and flush it the moment `ready` flips to true. Push notifications only go to
 * signed-in supervisors, so by the time they tap, they have access to the issue.
 */
export function useNotificationDeepLink(ready: boolean): void {
  // Holds an issue id captured before navigation was ready (cold start).
  const pendingRef = useRef<string | null>(null);
  // Mirror `ready` into a ref so the once-registered listener reads the live
  // value instead of the value captured when the effect first ran.
  const readyRef = useRef(ready);
  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  const navigateToIssue = (id: string) => {
    // Start the issue fetch NOW, before the (deferred) navigation below. On a
    // cold start the fetch would otherwise not begin until the issue screen
    // mounts — i.e. after auth resolves, the dashboard renders, AND the
    // deferral completes — so every round-trip ran in series and the user
    // watched a spinner. Prefetching overlaps the network with all of that;
    // React Query dedupes by key, so the screen's useGetIssue reads the cached
    // (or still-in-flight) result and usually renders with no spinner. By the
    // time we're called, auth is ready (ready/readyRef gate it), so the bearer
    // token is set for the request.
    const numericId = Number(id);
    if (Number.isFinite(numericId)) {
      queryClient
        .prefetchQuery({
          queryKey: getGetIssueQueryKey(numericId),
          queryFn: () => getIssue(numericId),
        })
        .catch(() => {});
    }

    // Defer the actual navigation past the current frame. On a cold start,
    // app/index.tsx fires a one-time `router.replace` to the dashboard; if our
    // push lands first, that replace clobbers the issue screen and dumps the
    // user on the dashboard instead. runAfterInteractions waits for the
    // navigator's initial transition to settle, reliably ordering us AFTER the
    // redirect (stack becomes [dashboard, issue], so Back returns to dashboard).
    // For warm taps the app is already idle, so this is a harmless extra tick.
    return InteractionManager.runAfterInteractions(() => {
      router.push(`/issue/${id}`);
    });
  };

  const go = (id: string) => {
    if (readyRef.current) {
      navigateToIssue(id);
    } else {
      pendingRef.current = id;
    }
  };

  // Flush a deep-link that arrived before the app was ready to navigate
  // (cold start). Cancel on unmount so a deferred push can't fire into a
  // torn-down tree.
  useEffect(() => {
    if (!ready || !pendingRef.current) return;
    const id = pendingRef.current;
    pendingRef.current = null;
    const handle = navigateToIssue(id);
    return () => handle.cancel();
  }, [ready]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    let mounted = true;

    // Cold start: was the app opened by tapping a notification?
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!mounted) return;
        const id = getIssueIdFromResponse(response);
        if (id) go(id);
      })
      .catch(() => {});

    // Warm: notification tapped while the app is running or backgrounded.
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const id = getIssueIdFromResponse(response);
      if (id) go(id);
    });

    return () => {
      mounted = false;
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
