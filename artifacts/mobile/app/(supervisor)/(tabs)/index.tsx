import { Feather } from "@expo/vector-icons";
import {
  listRestaurants,
  listIssues,
  useGetOrganizationSettings,
  type Restaurant,
  type Issue,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import IssueCard from "@/components/IssueCard";

type IssueNavFilters = {
  status: string;
  priority: string;
  restaurantId: string | number;
  agingDays?: number;
};

// Mirrors the organizations.aging_threshold_days column default. Used only as
// a client-side fallback before the settings request resolves.
const DEFAULT_AGING_THRESHOLD_DAYS = 14;

/** True if an unresolved issue has sat longer than the org's aging threshold. */
function isAging(issue: Issue, thresholdDays: number): boolean {
  const ageMs = Date.now() - new Date(issue.createdAt).getTime();
  return ageMs > thresholdDays * 86_400_000;
}

function RestaurantStatCard({
  restaurant,
  issues,
  agingThresholdDays,
  onStatPress,
}: {
  restaurant: Restaurant;
  issues: Issue[];
  agingThresholdDays: number;
  onStatPress: (filters: IssueNavFilters) => void;
}) {
  // Every stat on this card reflects outstanding work only — once an issue
  // is resolved it drops out of the urgent badge, Total, Aging, and quick rows
  // regardless of its priority.
  const activeIssues = issues.filter((i) => i.status !== "resolved");
  const openCount = activeIssues.filter((i) => i.status === "open").length;
  const urgentCount = activeIssues.filter((i) => i.priority === "urgent").length;
  const agingCount = activeIssues.filter((i) => isAging(i, agingThresholdDays)).length;
  const activeCount = activeIssues.length;
  const quickIssues = activeIssues
    .filter((i) => i.priority === "urgent" || i.status === "open")
    .slice(0, 2);

  return (
    <View style={styles.restaurantCard}>
      <View style={styles.restaurantCardHeader}>
        <View>
          <Text style={styles.restaurantCardName}>{restaurant.name}</Text>
          <Text style={styles.restaurantCardLocation}>{restaurant.location}</Text>
        </View>
        {urgentCount > 0 && (
          <View style={styles.urgentBadge}>
            <Feather name="alert-triangle" size={12} color={Colors.urgent} />
            <Text style={styles.urgentBadgeText}>{urgentCount} urgent</Text>
          </View>
        )}
      </View>

      <View style={styles.statRow}>
        <TouchableOpacity
          style={styles.statItem}
          onPress={() => onStatPress({ status: "open", priority: "all", restaurantId: restaurant.id })}
          activeOpacity={0.7}
        >
          <Text style={[styles.statValue, { color: Colors.openStatus }]}>{openCount}</Text>
          <Text style={styles.statLabel}>Open</Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <TouchableOpacity
          style={styles.statItem}
          onPress={() => onStatPress({ status: "all", priority: "all", restaurantId: restaurant.id })}
          activeOpacity={0.7}
        >
          <Text style={[styles.statValue, { color: Colors.textSecondary }]}>{activeCount}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <TouchableOpacity
          style={styles.statItem}
          onPress={() =>
            onStatPress({
              status: "all",
              priority: "all",
              restaurantId: restaurant.id,
              agingDays: agingThresholdDays,
            })
          }
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.statValue,
              { color: agingCount > 0 ? Colors.warning : Colors.textSecondary },
            ]}
          >
            {agingCount}
          </Text>
          <Text style={styles.statLabel}>Aging</Text>
        </TouchableOpacity>
      </View>

      {quickIssues.length > 0 ? (
        quickIssues.map((issue) => (
          <TouchableOpacity
            key={issue.id}
            style={styles.quickIssueRow}
            onPress={async () => {
              await Haptics.selectionAsync();
              router.push({ pathname: "/issue/[id]", params: { id: issue.id } });
            }}
            activeOpacity={0.72}
          >
            <View
              style={[
                styles.quickIssueDot,
                {
                  backgroundColor: issue.priority === "urgent"
                    ? Colors.urgent
                    : issue.status === "open"
                    ? Colors.openStatus
                    : Colors.textTertiary,
                },
              ]}
            />
            <Text style={styles.quickIssueText} numberOfLines={1}>
              {issue.equipmentType}
              {issue.subItem ? ` · ${issue.subItem}` : ""}
            </Text>
            <Text style={styles.quickIssueArea}>{issue.area}</Text>
            <Feather name="chevron-right" size={14} color={Colors.textTertiary} />
          </TouchableOpacity>
        ))
      ) : (
        <View style={styles.allClearRow}>
          <Feather name="check-circle" size={14} color={Colors.success} />
          <Text style={styles.allClearText}>All clear — no open issues</Text>
        </View>
      )}
    </View>
  );
}

export default function SupervisorDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { supervisor, logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const doLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      router.replace("/login");
    } catch {
      setLoggingOut(false);
    }
  };

  const goToIssues = async (filters: IssueNavFilters) => {
    await Haptics.selectionAsync();
    router.push({
      pathname: "/(supervisor)/(tabs)/issues",
      params: {
        status: filters.status,
        priority: filters.priority,
        restaurantId: String(filters.restaurantId),
        // Omitted (rather than "all") for non-aging tiles so the issues screen
        // can tell "clear the age filter" from "don't touch it".
        agingDays: filters.agingDays != null ? String(filters.agingDays) : "none",
        ts: String(Date.now()),
      },
    });
  };

  const { data: restaurants, isLoading: restaurantsLoading } = useQuery({
    queryKey: ["restaurants", supervisor?.id],
    queryFn: listRestaurants,
    staleTime: 0,
  });

  // Org-wide aging threshold. Falls back to 14 days while loading or if the
  // request fails so the Aging tile always renders a number.
  const { data: orgSettings } = useGetOrganizationSettings();
  const agingThresholdDays = orgSettings?.agingThresholdDays ?? DEFAULT_AGING_THRESHOLD_DAYS;

  const { data: allIssues, isLoading: issuesLoading, refetch, isRefetching } = useQuery({
    queryKey: ["supervisor-issues-all", supervisor?.id],
    queryFn: () => listIssues({ status: "all" }),
    staleTime: 0,
    // Auto-refresh every 30 seconds while the dashboard is open so newly
    // reported issues from restaurant tablets appear without pull-to-
    // refresh. Paused when the app is backgrounded to save battery —
    // returning to foreground triggers a fresh fetch via TanStack
    // Query's app-state listener.
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const { useSidebar } = useResponsiveLayout();
  const topPadding = Platform.OS === "web" ? 32 : insets.top;
  const bottomPadding = useSidebar ? 24 : insets.bottom + 100;

  const isLoading = restaurantsLoading || issuesLoading;

  // Summary tiles count outstanding work only — a resolved urgent issue no
  // longer counts as urgent.
  const activeIssues = allIssues?.filter((i) => i.status !== "resolved") ?? [];
  const totalOpen = activeIssues.filter((i) => i.status === "open").length;
  const totalUrgent = activeIssues.filter((i) => i.priority === "urgent").length;
  const totalActive = activeIssues.length;
  const restaurantCount = restaurants?.length ?? 0;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: topPadding + 20, paddingBottom: bottomPadding },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Supervisor Header */}
        <View style={styles.pageHeader}>
        <View style={styles.headerTextGroup}>
          <Text style={styles.greeting}>Dashboard</Text>
          <Text style={styles.supervisorName}>{supervisor?.name}</Text>
          {!isLoading && (
            <Text style={styles.headerSummary}>
              {restaurantCount} {restaurantCount === 1 ? "restaurant" : "restaurants"} · {totalOpen} open {totalOpen === 1 ? "issue" : "issues"}
            </Text>
          )}
        </View>
        {Platform.OS !== "web" && (
          <TouchableOpacity
            onPress={async () => {
              await Haptics.selectionAsync();
              setShowLogoutConfirm(true);
            }}
            style={styles.logoutBtn}
          >
            <Feather name="log-out" size={20} color={Colors.accent} />
          </TouchableOpacity>
        )}
      </View>

      {/* Summary Stats */}
      <View style={styles.summaryRow}>
        <TouchableOpacity
          style={[styles.summaryCard, { backgroundColor: Colors.urgentBg }]}
          onPress={() => goToIssues({ status: "all", priority: "urgent", restaurantId: "all" })}
          activeOpacity={0.75}
        >
          <Text style={[styles.summaryValue, { color: Colors.urgent }]}>{totalUrgent}</Text>
          <Text style={[styles.summaryLabel, { color: Colors.urgent }]}>Urgent</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.summaryCard, { backgroundColor: Colors.openStatusBg }]}
          onPress={() => goToIssues({ status: "open", priority: "all", restaurantId: "all" })}
          activeOpacity={0.75}
        >
          <Text style={[styles.summaryValue, { color: Colors.openStatus }]}>{totalOpen}</Text>
          <Text style={[styles.summaryLabel, { color: Colors.openStatus }]}>Open</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.summaryCard, { backgroundColor: Colors.lowBg }]}
          onPress={() => goToIssues({ status: "all", priority: "all", restaurantId: "all" })}
          activeOpacity={0.75}
        >
          <Text style={[styles.summaryValue, { color: Colors.textSecondary }]}>{totalActive}</Text>
          <Text style={[styles.summaryLabel, { color: Colors.textSecondary }]}>Total</Text>
        </TouchableOpacity>
      </View>

      {/* Per-restaurant cards */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      )}

      {!isLoading && restaurants?.map((restaurant) => {
        const restaurantIssues = allIssues?.filter(
          (i) => i.restaurantId === restaurant.id
        ) ?? [];
        return (
          <RestaurantStatCard
            key={restaurant.id}
            restaurant={restaurant}
            issues={restaurantIssues}
            agingThresholdDays={agingThresholdDays}
            onStatPress={goToIssues}
          />
        );
      })}

      {!isLoading && restaurantCount === 0 && (
        <View style={styles.emptyState}>
          <View style={styles.emptyStateIconBg}>
            <Feather name="home" size={32} color={Colors.primary} />
          </View>
          <Text style={styles.emptyStateTitle}>No restaurants yet</Text>
          <Text style={styles.emptyStateSubtitle}>
            Restaurants will appear here once they're added and paired.
          </Text>
        </View>
      )}
      {/* Report Issue Button */}
      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={styles.fabButton}
          onPress={async () => {
            await Haptics.selectionAsync();
            router.push("/(supervisor)/report");
          }}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={24} color="#FFFFFF" />
          <Text style={styles.fabText}>Report Issue</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>

    {/* Logout Confirmation Modal */}
    <Modal
      visible={showLogoutConfirm}
      transparent
      animationType="fade"
      onRequestClose={() => setShowLogoutConfirm(false)}
    >
      <View style={styles.overlay}>
        <View style={styles.confirmBox}>
          <Text style={styles.confirmTitle}>Log Out</Text>
          <Text style={styles.confirmBody}>Sign out of your account?</Text>
          <View style={styles.confirmActions}>
            <TouchableOpacity
              style={styles.confirmCancel}
              onPress={() => setShowLogoutConfirm(false)}
              disabled={loggingOut}
            >
              <Text style={styles.confirmCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmConfirm, styles.confirmDanger]}
              onPress={() => {
                setShowLogoutConfirm(false);
                doLogout();
              }}
              disabled={loggingOut}
            >
              {loggingOut ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.confirmConfirmText}>Log Out</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  fabContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  fabButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.accent,
    borderRadius: 16,
    paddingVertical: 16,
    gap: 10,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  fabText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 16,
  },
  pageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  headerTextGroup: {
    flex: 1,
  },
  headerSummary: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontFamily: "Inter_500Medium",
    marginTop: 4,
  },
  greeting: {
    fontSize: 14,
    color: Colors.textTertiary,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  supervisorName: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.text,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  logoutBtn: {
    padding: 8,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: "center",
  },
  restaurantCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  restaurantCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  restaurantCardName: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
    fontFamily: "Inter_700Bold",
  },
  restaurantCardLocation: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  urgentBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.urgentBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  urgentBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.urgent,
    fontFamily: "Inter_600SemiBold",
  },
  statRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    paddingVertical: 12,
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.borderLight,
  },
  quickIssueRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  quickIssueDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  quickIssueText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    fontFamily: "Inter_500Medium",
  },
  quickIssueArea: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontFamily: "Inter_400Regular",
  },
  allClearRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  allClearText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontFamily: "Inter_500Medium",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyStateIconBg: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: Colors.primary + "15",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
    fontFamily: "Inter_700Bold",
    marginBottom: 6,
    textAlign: "center",
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  // Logout confirmation modal
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  confirmBox: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 360,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  confirmTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 10,
  },
  confirmBody: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
  },
  confirmActions: {
    flexDirection: "row",
    gap: 10,
  },
  confirmCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  confirmCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  confirmConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmDanger: {
    backgroundColor: Colors.accent,
  },
  confirmConfirmText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
