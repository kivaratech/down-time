import { Feather } from "@expo/vector-icons";
import {
  listIssues,
  type ListIssuesStatus,
} from "@workspace/api-client-react";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import IssueCard from "@/components/IssueCard";

type StatusFilter = ListIssuesStatus | "all";
type AreaFilter = "all" | "Front Counter" | "Grill" | "Back of House" | "Technology";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In Progress" },
  { key: "waiting", label: "Waiting" },
  { key: "resolved", label: "Resolved" },
  { key: "all", label: "All" },
];

const AREA_FILTERS: { key: AreaFilter; label: string }[] = [
  { key: "all", label: "All Areas" },
  { key: "Front Counter", label: "Front Counter" },
  { key: "Grill", label: "Grill" },
  { key: "Back of House", label: "Back of House" },
  { key: "Technology", label: "Technology" },
];

export default function SupervisorIssuesScreen() {
  const insets = useSafeAreaInsets();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [areaFilter, setAreaFilter] = useState<AreaFilter>("all");
  const [showAreaFilter, setShowAreaFilter] = useState(false);

  const { data: issues, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["supervisor-issues", statusFilter],
    queryFn: () => listIssues({ status: statusFilter }),
  });

  const filteredIssues = useMemo(() => {
    if (!issues) return [];
    if (areaFilter === "all") return issues;
    return issues.filter((i) => i.area === areaFilter);
  }, [issues, areaFilter]);

  const topPadding = Platform.OS === "web"
    ? insets.top + 67
    : insets.top;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding + 20 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>All Issues</Text>
          <TouchableOpacity
            style={[
              styles.areaFilterBtn,
              areaFilter !== "all" && styles.areaFilterBtnActive,
            ]}
            onPress={() => setShowAreaFilter(!showAreaFilter)}
          >
            <Feather
              name="filter"
              size={14}
              color={areaFilter !== "all" ? Colors.primary : Colors.textSecondary}
            />
            <Text
              style={[
                styles.areaFilterText,
                areaFilter !== "all" && styles.areaFilterTextActive,
              ]}
              numberOfLines={1}
            >
              {areaFilter === "all" ? "Area" : areaFilter}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Status pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pillScroll}
          contentContainerStyle={styles.pillScrollContent}
        >
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
        </ScrollView>

        {/* Area filter dropdown */}
        {showAreaFilter && (
          <View style={styles.areaDropdown}>
            {AREA_FILTERS.map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[
                  styles.areaDropdownItem,
                  areaFilter === f.key && styles.areaDropdownItemActive,
                ]}
                onPress={() => {
                  setAreaFilter(f.key);
                  setShowAreaFilter(false);
                }}
              >
                <Text
                  style={[
                    styles.areaDropdownText,
                    areaFilter === f.key && styles.areaDropdownTextActive,
                  ]}
                >
                  {f.label}
                </Text>
                {areaFilter === f.key && (
                  <Feather name="check" size={14} color={Colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Issue List */}
      <FlatList
        data={filteredIssues}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Colors.primary}
          />
        }
        renderItem={({ item }) => <IssueCard issue={item} showRestaurant />}
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
              <Text style={styles.emptyTitle}>No issues found</Text>
              <Text style={styles.emptySubtitle}>
                Try adjusting your filters to see more results.
              </Text>
            </View>
          )
        }
        ListHeaderComponent={
          filteredIssues.length > 0 ? (
            <View style={styles.countHeader}>
              <Text style={styles.countText}>
                {filteredIssues.length} issue{filteredIssues.length !== 1 ? "s" : ""}
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: Colors.text,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  areaFilterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    maxWidth: 140,
  },
  areaFilterBtnActive: {
    backgroundColor: Colors.primary + "10",
    borderColor: Colors.primary + "40",
  },
  areaFilterText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontFamily: "Inter_500Medium",
    flexShrink: 1,
  },
  areaFilterTextActive: {
    color: Colors.primary,
  },
  pillScroll: {
    marginBottom: 4,
  },
  pillScrollContent: {
    gap: 8,
    paddingRight: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.textSecondary,
    fontFamily: "Inter_500Medium",
  },
  filterPillTextActive: {
    color: "#FFFFFF",
  },
  areaDropdown: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  areaDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  areaDropdownItemActive: {
    backgroundColor: Colors.background,
  },
  areaDropdownText: {
    fontSize: 15,
    color: Colors.text,
    fontFamily: "Inter_400Regular",
  },
  areaDropdownTextActive: {
    color: Colors.primary,
    fontFamily: "Inter_600SemiBold",
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
});
