import { Feather } from "@expo/vector-icons";
import {
  useListOrganizations,
  getListOrganizationsQueryKey,
  type OrganizationSummary,
} from "@workspace/api-client-react";
import { router, Stack, type Href } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

function formatCreatedAt(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function plural(n: number, singular: string): string {
  return `${n} ${singular}${n === 1 ? "" : "s"}`;
}

export default function OrganizationsListScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const {
    data: organizations,
    isLoading,
    isRefetching,
    refetch,
  } = useListOrganizations();

  const doLogout = () => {
    Alert.alert("Log Out", "Sign out of the super-admin dashboard?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          setLoggingOut(true);
          try {
            await logout();
            router.replace("/login");
          } catch {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  const renderOrg = ({ item }: { item: OrganizationSummary }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        router.push(`/(super-admin)/orgs/${item.id}` as Href)
      }
      activeOpacity={0.75}
    >
      <View style={styles.cardLeft}>
        <Text style={styles.orgName}>{item.name}</Text>
        <Text style={styles.orgMeta}>
          {plural(item.restaurantCount, "restaurant")} ·{" "}
          {plural(item.adminCount, "admin")} ·{" "}
          {plural(item.supervisorCount, "supervisor")}
        </Text>
        <Text style={styles.orgDate}>
          Created {formatCreatedAt(item.createdAt)}
        </Text>
      </View>
      <Feather name="chevron-right" size={20} color={Colors.textTertiary} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <TouchableOpacity
              onPress={doLogout}
              disabled={loggingOut}
              style={styles.headerBtn}
              accessibilityLabel="Log out"
            >
              <Feather name="log-out" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          ),
        }}
      />

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={organizations ?? []}
          keyExtractor={(o) => String(o.id)}
          renderItem={renderOrg}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 100 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => {
                queryClient.invalidateQueries({
                  queryKey: getListOrganizationsQueryKey(),
                });
                refetch();
              }}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="briefcase" size={42} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>No organizations yet</Text>
              <Text style={styles.emptySubtitle}>
                Tap &ldquo;New Organization&rdquo; to onboard your first customer.
              </Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
        onPress={() => router.push("/(super-admin)/orgs/new" as Href)}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={22} color="#FFFFFF" />
        <Text style={styles.fabText}>New Organization</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  listContent: { padding: 16 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardLeft: { flex: 1 },
  orgName: {
    fontSize: 17,
    fontWeight: "600",
    color: Colors.text,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
  },
  orgMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
    marginBottom: 2,
  },
  orgDate: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontFamily: "Inter_400Regular",
  },
  empty: { alignItems: "center", padding: 40, marginTop: 40, gap: 8 },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: Colors.text,
    fontFamily: "Inter_600SemiBold",
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
});
