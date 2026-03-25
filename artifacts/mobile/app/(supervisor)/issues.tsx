import { Feather } from "@expo/vector-icons";
import {
  useListIssues,
  useListRestaurants,
  type ListIssuesStatus,
  type ListIssuesCategory,
  type ListIssuesPriority,
} from "@workspace/api-client-react";
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
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/auth-context";
import Colors from "@/constants/colors";
import IssueCard from "@/components/IssueCard";

type StatusFilter = ListIssuesStatus | "all";
type AreaFilter = "all" | "Front Counter" | "Grill" | "Back of House" | "Technology";
type CategoryFilter = ListIssuesCategory | "all";
type PriorityFilter = ListIssuesPriority | "all";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In Progress" },
  { key: "waiting", label: "Waiting" },
  { key: "resolved", label: "Resolved" },
  { key: "all", label: "All" },
];

const AREA_OPTIONS: { key: AreaFilter; label: string }[] = [
  { key: "all", label: "All Areas" },
  { key: "Front Counter", label: "Front Counter" },
  { key: "Grill", label: "Grill" },
  { key: "Back of House", label: "Back of House" },
  { key: "Technology", label: "Technology" },
];

const CATEGORY_OPTIONS: { key: CategoryFilter; label: string }[] = [
  { key: "all", label: "All Categories" },
  { key: "equipment", label: "Equipment" },
  { key: "technology", label: "Technology" },
];

const PRIORITY_OPTIONS: { key: PriorityFilter; label: string; color: string }[] = [
  { key: "all", label: "Any Priority", color: Colors.textSecondary },
  { key: "urgent", label: "Urgent", color: Colors.urgent },
  { key: "high", label: "High", color: Colors.high },
  { key: "normal", label: "Normal", color: Colors.normal },
];

const AGING_OPTIONS: { key: number | null; label: string }[] = [
  { key: null, label: "Any Age" },
  { key: 3, label: "Older than 3 days" },
  { key: 7, label: "Older than 7 days" },
  { key: 14, label: "Older than 14 days" },
];

type ActiveDropdown = "area" | "category" | "priority" | "restaurant" | "aging" | null;

export default function SupervisorIssuesScreen() {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [areaFilter, setAreaFilter] = useState<AreaFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [restaurantFilter, setRestaurantFilter] = useState<number | null>(null);
  const [agingFilter, setAgingFilter] = useState<number | null>(null);
  const [assignedToFilter, setAssignedToFilter] = useState("");
  const [activeDropdown, setActiveDropdown] = useState<ActiveDropdown>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const { data: restaurants } = useListRestaurants();

  const queryParams = {
    status: statusFilter,
    ...(categoryFilter !== "all" ? { category: categoryFilter } : {}),
    ...(priorityFilter !== "all" ? { priority: priorityFilter } : {}),
    ...(restaurantFilter !== null ? { restaurantId: restaurantFilter } : {}),
    ...(agingFilter !== null ? { agingDays: agingFilter } : {}),
    ...(assignedToFilter.trim() ? { assignedTo: assignedToFilter.trim() } : {}),
  };

  const { data: issues, isLoading, refetch, isRefetching } = useListIssues(queryParams);

  const filteredIssues = areaFilter === "all"
    ? (issues ?? [])
    : (issues ?? []).filter((i) => i.area === areaFilter);

  const topPadding = Platform.OS === "web"
    ? insets.top + 67
    : insets.top;

  const activeFilterCount = [
    areaFilter !== "all",
    categoryFilter !== "all",
    priorityFilter !== "all",
    restaurantFilter !== null,
    agingFilter !== null,
    assignedToFilter.trim().length > 0,
  ].filter(Boolean).length;

  function toggleDropdown(name: ActiveDropdown) {
    setActiveDropdown((prev) => (prev === name ? null : name));
  }

  function clearAllFilters() {
    setAreaFilter("all");
    setCategoryFilter("all");
    setPriorityFilter("all");
    setRestaurantFilter(null);
    setAgingFilter(null);
    setAssignedToFilter("");
    setActiveDropdown(null);
  }

  const doLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      Alert.alert("Error", "Failed to log out.");
      setLoggingOut(false);
    }
  };

  const selectedRestaurant = restaurants?.find((r) => r.id === restaurantFilter);
  const selectedAging = AGING_OPTIONS.find((a) => a.key === agingFilter);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding + 20 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>All Issues</Text>
          <View style={styles.headerActions}>
            {activeFilterCount > 0 && (
              <TouchableOpacity style={styles.clearBtn} onPress={clearAllFilters}>
                <Feather name="x" size={12} color={Colors.primary} />
                <Text style={styles.clearBtnText}>Clear filters</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={() => setShowLogoutConfirm(true)}
              disabled={loggingOut}
            >
              <Feather name="log-out" size={18} color={Colors.accent} />
            </TouchableOpacity>
          </View>
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
              style={[styles.filterPill, statusFilter === f.key && styles.filterPillActive]}
              onPress={() => setStatusFilter(f.key)}
            >
              <Text style={[styles.filterPillText, statusFilter === f.key && styles.filterPillTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Secondary filters row 1 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.secondaryScroll}
          contentContainerStyle={styles.secondaryScrollContent}
        >
          <TouchableOpacity
            style={[styles.secondaryFilterBtn, restaurantFilter !== null && styles.secondaryFilterBtnActive]}
            onPress={() => toggleDropdown("restaurant")}
          >
            <Feather name="home" size={12} color={restaurantFilter !== null ? Colors.primary : Colors.textSecondary} />
            <Text style={[styles.secondaryFilterText, restaurantFilter !== null && styles.secondaryFilterTextActive]} numberOfLines={1}>
              {selectedRestaurant ? selectedRestaurant.name : "Restaurant"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryFilterBtn, areaFilter !== "all" && styles.secondaryFilterBtnActive]}
            onPress={() => toggleDropdown("area")}
          >
            <Feather name="map-pin" size={12} color={areaFilter !== "all" ? Colors.primary : Colors.textSecondary} />
            <Text style={[styles.secondaryFilterText, areaFilter !== "all" && styles.secondaryFilterTextActive]} numberOfLines={1}>
              {areaFilter === "all" ? "Area" : areaFilter}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryFilterBtn, categoryFilter !== "all" && styles.secondaryFilterBtnActive]}
            onPress={() => toggleDropdown("category")}
          >
            <Feather name="tag" size={12} color={categoryFilter !== "all" ? Colors.primary : Colors.textSecondary} />
            <Text style={[styles.secondaryFilterText, categoryFilter !== "all" && styles.secondaryFilterTextActive]} numberOfLines={1}>
              {categoryFilter === "all" ? "Category" : categoryFilter === "equipment" ? "Equipment" : "Technology"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryFilterBtn, priorityFilter !== "all" && styles.secondaryFilterBtnActive]}
            onPress={() => toggleDropdown("priority")}
          >
            <Feather name="alert-triangle" size={12} color={priorityFilter !== "all" ? Colors.primary : Colors.textSecondary} />
            <Text style={[styles.secondaryFilterText, priorityFilter !== "all" && styles.secondaryFilterTextActive]} numberOfLines={1}>
              {priorityFilter === "all" ? "Priority" : priorityFilter.charAt(0).toUpperCase() + priorityFilter.slice(1)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryFilterBtn, agingFilter !== null && styles.secondaryFilterBtnActive]}
            onPress={() => toggleDropdown("aging")}
          >
            <Feather name="clock" size={12} color={agingFilter !== null ? Colors.primary : Colors.textSecondary} />
            <Text style={[styles.secondaryFilterText, agingFilter !== null && styles.secondaryFilterTextActive]} numberOfLines={1}>
              {agingFilter !== null ? `>${agingFilter}d old` : "Age"}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Assigned To input */}
        <View style={styles.assignedToRow}>
          <Feather name="user" size={14} color={assignedToFilter ? Colors.primary : Colors.textTertiary} style={styles.assignedToIcon} />
          <TextInput
            style={styles.assignedToInput}
            value={assignedToFilter}
            onChangeText={setAssignedToFilter}
            placeholder="Filter by assignee..."
            placeholderTextColor={Colors.textTertiary}
            returnKeyType="search"
          />
          {assignedToFilter.length > 0 && (
            <TouchableOpacity onPress={() => setAssignedToFilter("")} style={styles.assignedToClear}>
              <Feather name="x" size={14} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Dropdowns */}
        {activeDropdown === "restaurant" && (
          <View style={styles.dropdown}>
            <TouchableOpacity
              style={[styles.dropdownItem, restaurantFilter === null && styles.dropdownItemActive]}
              onPress={() => { setRestaurantFilter(null); setActiveDropdown(null); }}
            >
              <Text style={[styles.dropdownItemText, restaurantFilter === null && styles.dropdownItemTextActive]}>All Restaurants</Text>
              {restaurantFilter === null && <Feather name="check" size={14} color={Colors.primary} />}
            </TouchableOpacity>
            {(restaurants ?? []).map((r) => (
              <TouchableOpacity
                key={r.id}
                style={[styles.dropdownItem, restaurantFilter === r.id && styles.dropdownItemActive]}
                onPress={() => { setRestaurantFilter(r.id); setActiveDropdown(null); }}
              >
                <Text style={[styles.dropdownItemText, restaurantFilter === r.id && styles.dropdownItemTextActive]}>{r.name}</Text>
                {restaurantFilter === r.id && <Feather name="check" size={14} color={Colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {activeDropdown === "area" && (
          <View style={styles.dropdown}>
            {AREA_OPTIONS.map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[styles.dropdownItem, areaFilter === f.key && styles.dropdownItemActive]}
                onPress={() => { setAreaFilter(f.key); setActiveDropdown(null); }}
              >
                <Text style={[styles.dropdownItemText, areaFilter === f.key && styles.dropdownItemTextActive]}>{f.label}</Text>
                {areaFilter === f.key && <Feather name="check" size={14} color={Colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {activeDropdown === "category" && (
          <View style={styles.dropdown}>
            {CATEGORY_OPTIONS.map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[styles.dropdownItem, categoryFilter === f.key && styles.dropdownItemActive]}
                onPress={() => { setCategoryFilter(f.key); setActiveDropdown(null); }}
              >
                <Text style={[styles.dropdownItemText, categoryFilter === f.key && styles.dropdownItemTextActive]}>{f.label}</Text>
                {categoryFilter === f.key && <Feather name="check" size={14} color={Colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {activeDropdown === "priority" && (
          <View style={styles.dropdown}>
            {PRIORITY_OPTIONS.map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[styles.dropdownItem, priorityFilter === f.key && styles.dropdownItemActive]}
                onPress={() => { setPriorityFilter(f.key); setActiveDropdown(null); }}
              >
                <Text style={[styles.dropdownItemText, priorityFilter === f.key && styles.dropdownItemTextActive, f.key !== "all" && { color: f.color }]}>
                  {f.label}
                </Text>
                {priorityFilter === f.key && <Feather name="check" size={14} color={Colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {activeDropdown === "aging" && (
          <View style={styles.dropdown}>
            {AGING_OPTIONS.map((f) => (
              <TouchableOpacity
                key={String(f.key)}
                style={[styles.dropdownItem, agingFilter === f.key && styles.dropdownItemActive]}
                onPress={() => { setAgingFilter(f.key); setActiveDropdown(null); }}
              >
                <Text style={[styles.dropdownItemText, agingFilter === f.key && styles.dropdownItemTextActive]}>{f.label}</Text>
                {agingFilter === f.key && <Feather name="check" size={14} color={Colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Issue List */}
      <FlatList
        data={filteredIssues}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />
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
              <Text style={styles.emptySubtitle}>Try adjusting your filters to see more results.</Text>
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
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.primary + "10",
  },
  clearBtnText: {
    fontSize: 12,
    color: Colors.primary,
    fontFamily: "Inter_500Medium",
  },
  pillScroll: {
    marginBottom: 10,
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
  secondaryScroll: {
    marginBottom: 10,
  },
  secondaryScrollContent: {
    gap: 8,
    paddingRight: 8,
  },
  secondaryFilterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryFilterBtnActive: {
    backgroundColor: Colors.primary + "10",
    borderColor: Colors.primary + "40",
  },
  secondaryFilterText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: "Inter_500Medium",
  },
  secondaryFilterTextActive: {
    color: Colors.primary,
  },
  assignedToRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    marginBottom: 4,
  },
  assignedToIcon: {
    marginRight: 6,
  },
  assignedToInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    fontFamily: "Inter_400Regular",
    paddingVertical: 9,
  },
  assignedToClear: {
    padding: 4,
  },
  dropdown: {
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
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  dropdownItemActive: {
    backgroundColor: Colors.background,
  },
  dropdownItemText: {
    fontSize: 15,
    color: Colors.text,
    fontFamily: "Inter_400Regular",
  },
  dropdownItemTextActive: {
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
  // Header actions
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoutBtn: {
    padding: 6,
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
