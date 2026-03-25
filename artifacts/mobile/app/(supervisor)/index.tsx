import { Feather } from "@expo/vector-icons";
import {
  listRestaurants,
  listIssues,
  type Restaurant,
  type Issue,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import IssueCard from "@/components/IssueCard";

function RestaurantStatCard({ restaurant, issues }: { restaurant: Restaurant; issues: Issue[] }) {
  const openCount = issues.filter((i) => i.status === "open").length;
  const urgentCount = issues.filter((i) => i.priority === "urgent").length;
  const inProgressCount = issues.filter((i) => i.status === "in_progress").length;

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
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: Colors.openStatus }]}>{openCount}</Text>
          <Text style={styles.statLabel}>Open</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: Colors.inProgressStatus }]}>{inProgressCount}</Text>
          <Text style={styles.statLabel}>In Progress</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: Colors.textSecondary }]}>{issues.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      {issues.filter((i) => i.priority === "urgent" || i.status === "open").slice(0, 2).map((issue) => (
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
      ))}
    </View>
  );
}

export default function SupervisorDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { supervisor, logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const { data: restaurants, isLoading: restaurantsLoading } = useQuery({
    queryKey: ["restaurants"],
    queryFn: listRestaurants,
  });

  const { data: allIssues, isLoading: issuesLoading, refetch, isRefetching } = useQuery({
    queryKey: ["supervisor-issues-all"],
    queryFn: () => listIssues({ status: "all" }),
  });

  const topPadding = Platform.OS === "web"
    ? insets.top + 67
    : insets.top;

  const isLoading = restaurantsLoading || issuesLoading;

  const doLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      Alert.alert("Error", "Failed to log out.");
      setLoggingOut(false);
    }
  };

  const totalOpen = allIssues?.filter((i) => i.status === "open").length ?? 0;
  const totalUrgent = allIssues?.filter((i) => i.priority === "urgent").length ?? 0;
  const totalInProgress = allIssues?.filter((i) => i.status === "in_progress").length ?? 0;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: topPadding + 20, paddingBottom: insets.bottom + 100 },
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
        <View>
          <Text style={styles.greeting}>Dashboard</Text>
          <Text style={styles.supervisorName}>{supervisor?.name}</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowLogoutConfirm(true)}
          disabled={loggingOut}
          style={styles.logoutBtn}
        >
          <Feather name="log-out" size={20} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Summary Stats */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: Colors.urgentBg }]}>
          <Text style={[styles.summaryValue, { color: Colors.urgent }]}>{totalUrgent}</Text>
          <Text style={[styles.summaryLabel, { color: Colors.urgent }]}>Urgent</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: Colors.openStatusBg }]}>
          <Text style={[styles.summaryValue, { color: Colors.openStatus }]}>{totalOpen}</Text>
          <Text style={[styles.summaryLabel, { color: Colors.openStatus }]}>Open</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: Colors.inProgressStatusBg }]}>
          <Text style={[styles.summaryValue, { color: Colors.inProgressStatus }]}>{totalInProgress}</Text>
          <Text style={[styles.summaryLabel, { color: Colors.inProgressStatus }]}>In Progress</Text>
        </View>
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
          />
        );
      })}
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
  scrollContainer: {
    flex: 1,
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
