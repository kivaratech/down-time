import { Platform, useWindowDimensions } from "react-native";

const SIDEBAR_BREAKPOINT = 768;

export function useResponsiveLayout() {
  const { width } = useWindowDimensions();
  const useSidebar = Platform.OS === "web" && width >= SIDEBAR_BREAKPOINT;
  return { useSidebar, screenWidth: width };
}
