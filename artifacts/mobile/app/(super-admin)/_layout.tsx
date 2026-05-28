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
      <Stack.Screen
        name="orgs/new"
        options={{ title: "New Organization", presentation: "modal" }}
      />
      <Stack.Screen name="orgs/[id]" options={{ title: "Organization" }} />
    </Stack>
  );
}
