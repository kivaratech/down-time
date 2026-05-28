import { Stack } from "expo-router";
import Colors from "@/constants/colors";

export default function SuperAdminLayout() {
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
