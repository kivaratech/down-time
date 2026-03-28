import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Platform, StyleSheet } from "react-native";
import Colors from "@/constants/colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";

export default function TabsLayout() {
  const { useSidebar } = useResponsiveLayout();
  const isIOS = Platform.OS === "ios";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.tabIconDefault,
        headerShown: false,
        tabBarStyle: useSidebar
          ? styles.hiddenTabBar
          : {
              position: "absolute",
              backgroundColor: isIOS ? "transparent" : Colors.surface,
              borderTopWidth: 0,
              elevation: 0,
            },
        tabBarBackground: () =>
          isIOS && !useSidebar ? (
            <BlurView
              intensity={100}
              tint="light"
              style={StyleSheet.absoluteFill}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => (
            <Feather name="grid" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="issues"
        options={{
          title: "All Issues",
          tabBarIcon: ({ color }) => (
            <Feather name="list" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => (
            <Feather name="settings" size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  hiddenTabBar: {
    display: "none",
  },
});
