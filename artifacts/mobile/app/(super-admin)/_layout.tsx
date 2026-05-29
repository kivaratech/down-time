import { Redirect, Stack } from "expo-router";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

export default function SuperAdminLayout() {
  const { isLoading, authType, supervisor } = useAuth();

  // Layout-level role guard. app/index.tsx already redirects on landing at
  // "/", but a deep link / back-stack / web URL can drop a non-super_admin
  // directly into this route group, where every API call would 403 and the
  // empty states would render as "no data" with no explanation. Bounce them
  // back to "/" so the root role gate routes them to the right stack.
  if (isLoading) return null;
  if (authType !== "supervisor" || supervisor?.role !== "super_admin") {
    return <Redirect href="/" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: { fontFamily: "Inter_600SemiBold" },
        headerBackTitle: "Back",
      }}
    >
      <Stack.Screen name="index" options={{ title: "Organizations" }} />
      {/* orgs/ has its own nested _layout.tsx for the new/[id] sub-stack
          (Expo Router Stack only manages direct children — declaring
          "orgs/new" and "orgs/[id]" here triggers the "Too many screens
          defined" warning). Hiding the parent header so the nested Stack
          owns the title and back button. */}
      <Stack.Screen name="orgs" options={{ headerShown: false }} />
    </Stack>
  );
}
