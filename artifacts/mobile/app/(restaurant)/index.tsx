import { Feather } from "@expo/vector-icons";
import { useListRestaurantIssues, getListRestaurantIssuesQueryKey } from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import IssueCard from "@/components/IssueCard";

const STATUS_FILTERS = [
  { key: "open" as const, label: "Open" },
  { key: "in_progress" as const, label: "In Progress" },
  { key: "waiting" as const, label: "Waiting" },
  { key: "resolved" as const, label: "Resolved" },
  { key: "all" as const, label: "All" },
];

type StatusFilter = (typeof STATUS_FILTERS)[number]["key"];

export default function RestaurantHomeScreen() {
  const insets = useSafeAreaInsets();
  const { restaurant, logout } = useAuth();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const {
    data: issues,
    isLoading,
    refetch,
    isRefetching,
  } = useListRestaurantIssues(restaurant?.id ?? 0, { status: statusFilter }, {
    query: {
      enabled: !!restaurant,
      queryKey: getListRestaurantIssuesQueryKey(restaurant?.id ?? 0, { status: statusFilter }),
    },
  });

  const topPadding = Platform.OS === "web"
    ? insets.top + 67
    : insets.top;

  return (
    <View style={[styles.container]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding + 20 }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.restaurantName}>{restaurant?.name}</Text>
            <Text style={styles.locationText}>{restaurant?.location}</Text>
          </View>
          <TouchableOpacity
            onPress={async () => {
              await Haptics.selectionAsync();
              await logout();
              router.replace("/login");
            }}
            style={styles.logoutBtn}
          >
            <Feather name="log-out" size={20} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        {/* Status Filter Pills */}
        <View style={styles.filterRow}>
          {STATUS_FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[
                styles.filterPill,
                statusFilter === f.key && styles.filterPillActive,
              ]}
              onPress={() => setStatusFilter(f.key)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  statusFilter === f.key && styles.filterPillTextActive,
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Issue List */}
      <FlatList
        data={issues}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Colors.primary}
          />
        }
        renderItem={({ item }) => <IssueCard issue={item} />}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBg}>
                <Feather name="check-circle" size={36} color={Colors.success} />
              </View>
              <Text style={styles.emptyTitle}>
                {statusFilter === "resolved" ? "No resolved issues" : "No open issues"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {statusFilter === "open" || statusFilter === "all"
                  ? "All clear — report a new issue if something comes up."
                  : `No issues with "${statusFilter.replace("_", " ")}" status.`}
              </Text>
            </View>
          )
        }
        ListHeaderComponent={
          issues && issues.length > 0 ? (
            <View style={styles.countHeader}>
              <Text style={styles.countText}>
                {issues.length} {statusFilter === "all" ? "total" : statusFilter.replace("_", " ")} issue{issues.length !== 1 ? "s" : ""}
              </Text>
            </View>
          ) : null
        }
      />

      {/* Report Issue FAB */}
      <View style={[styles.fabContainer, { paddingBottom: insets.bottom + 24 + (Platform.OS === "web" ? 34 : 0) }]}>
        <TouchableOpacity
          style={styles.fab}
          onPress={async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push("/(restaurant)/report");
          }}
          activeOpacity={0.85}
        >
          <Feather name="plus" size={22} color="#FFFFFF" />
          <Text style={styles.fabText}>Report Issue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  restaurantName: {
    fontSize: 26,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  locationText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.65)",
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  logoutBtn: {
    padding: 8,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "nowrap",
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  filterPillActive: {
    backgroundColor: "#FFFFFF",
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.8)",
    fontFamily: "Inter_500Medium",
  },
  filterPillTextActive: {
    color: Colors.primary,
  },
  list: {
    padding: 20,
  },
  countHeader: {
    marginBottom: 8,
  },
  countText: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyIconBg: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.openStatusBg,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: Colors.text,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  fabContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  fab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.accent,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 36,
    gap: 10,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
    width: "100%",
    maxWidth: 400,
  },
  fabText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
});
