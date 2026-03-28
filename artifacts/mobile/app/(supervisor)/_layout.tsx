import { Stack } from "expo-router";
import { StyleSheet, View } from "react-native";
import Colors from "@/constants/colors";
import WebSidebar from "@/components/WebSidebar";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";

export default function SupervisorLayout() {
  const { useSidebar } = useResponsiveLayout();

  if (useSidebar) {
    return (
      <View style={styles.webShell}>
        <WebSidebar />
        <View style={styles.webContent}>
          <Stack screenOptions={{ headerShown: false }} />
        </View>
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
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
});
