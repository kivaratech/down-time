import { Redirect, type Href } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { View, ActivityIndicator } from "react-native";
import Colors from "@/constants/colors";

export default function IndexScreen() {
  const { isLoading, authType } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // Group routes ("/(restaurant)", "/(supervisor)") are valid hrefs at runtime
  // but Expo Router's typed-routes generator doesn't include them in the
  // literal Href union. Cast through Href to satisfy the type check.
  if (authType === "restaurant") {
    return <Redirect href={"/(restaurant)" as Href} />;
  }

  if (authType === "supervisor") {
    return <Redirect href={"/(supervisor)" as Href} />;
  }

  return <Redirect href="/login" />;
}
