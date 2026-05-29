import { Stack } from "expo-router";
import Colors from "@/constants/colors";

// Sub-layout for the orgs/ subdirectory. The parent (super-admin)/_layout.tsx
// renders <Stack.Screen name="orgs" headerShown:false /> and delegates the
// title/header here. This pattern is required because Expo Router's Stack
// only manages direct children — nested routes need their own layout.
export default function OrgsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: { fontFamily: "Inter_600SemiBold" },
        headerBackTitle: "Back",
      }}
    >
      <Stack.Screen
        name="new"
        options={{ title: "New Organization", presentation: "modal" }}
      />
      <Stack.Screen name="[id]" options={{ title: "Organization" }} />
    </Stack>
  );
}
