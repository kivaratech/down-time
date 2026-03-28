import { Feather } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

type NavItem = {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  href: string;
  urlMatch: string;
  adminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { icon: "grid", label: "Dashboard", href: "/(supervisor)/", urlMatch: "/" },
  { icon: "list", label: "All Issues", href: "/(supervisor)/issues", urlMatch: "/issues" },
  { icon: "users", label: "Users", href: "/(supervisor)/users", urlMatch: "/users", adminOnly: true },
  { icon: "settings", label: "Settings", href: "/(supervisor)/settings", urlMatch: "/settings" },
];

export default function WebSidebar() {
  const pathname = usePathname();
  const { supervisor, logout } = useAuth();

  const isActive = (item: NavItem) => {
    if (item.urlMatch === "/") {
      return pathname === "/" || pathname === "";
    }
    return pathname.startsWith(item.urlMatch);
  };

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.adminOnly || supervisor?.role === "admin",
  );

  return (
    <View style={styles.sidebar}>
      <View style={styles.brand}>
        <View style={styles.logoIcon}>
          <Feather name="tool" size={20} color="#fff" />
        </View>
        <View>
          <Text style={styles.appName}>DownTime</Text>
          <Text style={styles.orgName}>Gandar Management</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.nav}>
        <Text style={styles.navSectionLabel}>NAVIGATION</Text>
        {visibleItems.map((item) => {
          const active = isActive(item);
          return (
            <TouchableOpacity
              key={item.href}
              style={[styles.navItem, active && styles.navItemActive]}
              onPress={() => router.push(item.href as Parameters<typeof router.push>[0])}
              activeOpacity={0.75}
            >
              <Feather
                name={item.icon}
                size={18}
                color={active ? "#fff" : "rgba(255,255,255,0.55)"}
              />
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.bottom}>
        <View style={styles.divider} />
        <View style={styles.userRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(supervisor?.name || supervisor?.username || "U").charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>
              {supervisor?.name || supervisor?.username || "User"}
            </Text>
            <Text style={styles.userRole}>
              {supervisor?.role === "admin" ? "Administrator" : "Supervisor"}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.75}>
          <Feather name="log-out" size={15} color="rgba(255,255,255,0.55)" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 240,
    backgroundColor: Colors.primary,
    paddingTop: 24,
    paddingBottom: 24,
    flexDirection: "column",
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  appName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  orgName: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginHorizontal: 20,
    marginVertical: 4,
  },
  nav: {
    flex: 1,
    paddingTop: 16,
    paddingHorizontal: 12,
    gap: 2,
  },
  navSectionLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "rgba(255,255,255,0.35)",
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
  },
  navItemActive: {
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  navLabel: {
    fontSize: 14,
    color: "rgba(255,255,255,0.55)",
    fontFamily: "Inter_500Medium",
  },
  navLabelActive: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
  },
  bottom: {
    paddingHorizontal: 12,
    gap: 12,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingTop: 12,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    fontFamily: "Inter_700Bold",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 13,
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
  },
  userRole: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    fontFamily: "Inter_400Regular",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
    fontFamily: "Inter_500Medium",
  },
});
