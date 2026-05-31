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
      {/* Note: previous versions declared `presentation: "modal"` on this
          screen, but the option had no visible effect — `new` is the root
          of this nested stack (the (super-admin) parent only pushes
          "orgs" as one segment), so there's nothing under it for iOS to
          slide a modal sheet over. To restore modal-style presentation
          later, move new.tsx out of orgs/ to sit beside (super-admin)/
          index.tsx so the parent stack can push it directly with
          presentation:"modal". Doing that needs a route rename (push
          paths from "/(super-admin)/orgs/new" → "/(super-admin)/new-org"
          or similar) so it's deferred for a separate change. */}
      <Stack.Screen name="new" options={{ title: "New Organization" }} />
      <Stack.Screen name="[id]" options={{ title: "Organization" }} />
    </Stack>
  );
}
