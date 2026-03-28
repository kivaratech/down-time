import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Platform, StyleSheet, View } from "react-native";
import Colors from "@/constants/colors";
import WebSidebar from "@/components/WebSidebar";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";

const TAB_SCREENS = (
  <>
    <Tabs.Screen
      name="index"
      options={{
        title: "Dashboard",
        tabBarIcon: ({ color }) => <Feather name="grid" size={22} color={color} />,
      }}
    />
    <Tabs.Screen
      name="issues"
      options={{
        title: "All Issues",
        tabBarIcon: ({ color }) => <Feather name="list" size={22} color={color} />,
      }}
    />
    <Tabs.Screen
      name="settings"
      options={{
        title: "Settings",
        tabBarIcon: ({ color }) => <Feather name="settings" size={22} color={color} />,
      }}
    />
    <Tabs.Screen
      name="report"
      options={{ href: null, tabBarButton: () => null }}
    />
    <Tabs.Screen
      name="users"
      options={{ href: null, tabBarButton: () => null }}
    />
    <Tabs.Screen
      name="settings/device-pairing"
      options={{ href: null, tabBarButton: () => null }}
    />
    <Tabs.Screen
      name="settings/equipment"
      options={{ href: null, tabBarButton: () => null }}
    />
  </>
);

export default function SupervisorLayout() {
  const { useSidebar } = useResponsiveLayout();
  const isIOS = Platform.OS === "ios";

  if (useSidebar) {
    return (
      <View style={styles.webShell}>
        <WebSidebar />
        <View style={styles.webContent}>
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarStyle: styles.hiddenTabBar,
            }}
          >
            {TAB_SCREENS}
          </Tabs>
        </View>
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.tabIconDefault,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : Colors.surface,
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint="light"
              style={StyleSheet.absoluteFill}
            />
          ) : null,
      }}
    >
      {TAB_SCREENS}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  webShell: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: Colors.background,
  },
  webContent: {
    flex: 1,
    overflow: "hidden",
  },
  hiddenTabBar: {
    display: "none",
  },
});
