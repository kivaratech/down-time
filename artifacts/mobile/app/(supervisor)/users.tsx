import { Feather } from "@expo/vector-icons";
import { customFetch } from "@workspace/api-client-react";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

type UserRow = {
  id: number;
  username: string;
  name: string;
  email: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  restaurantIds: number[];
};

type Restaurant = {
  id: number;
  name: string;
  location: string;
};

type FormState = {
  username: string;
  name: string;
  email: string;
  password: string;
  role: "supervisor" | "admin";
};

const emptyForm = (): FormState => ({
  username: "",
  name: "",
  email: "",
  password: "",
  role: "supervisor",
});

export default function UsersScreen() {
  const insets = useSafeAreaInsets();
  const { supervisor } = useAuth();
  const isAdmin = supervisor?.role === "admin";

  const [users, setUsers] = useState<UserRow[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  const [formVisible, setFormVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const [confirmUser, setConfirmUser] = useState<UserRow | null>(null);
  const [toggling, setToggling] = useState(false);

  const [storeModalUser, setStoreModalUser] = useState<UserRow | null>(null);
  const [storeSelection, setStoreSelection] = useState<Set<number>>(new Set());
  const [storeSaving, setStoreSaving] = useState(false);

  const topPadding = Platform.OS === "web" ? 32 : insets.top;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [userData, restaurantData] = await Promise.all([
        customFetch<UserRow[]>("/api/admin/users"),
        customFetch<Restaurant[]>("/api/restaurants"),
      ]);
      setUsers(userData);
      setRestaurants(restaurantData);
    } catch {
      // silently fail — user will see empty list
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isAdmin) fetchData();
    }, [isAdmin, fetchData])
  );

  function openCreate() {
    setEditingUser(null);
    setForm(emptyForm());
    setFormError("");
    setFormVisible(true);
  }

  function openEdit(user: UserRow) {
    setEditingUser(user);
    setForm({
      username: user.username,
      name: user.name,
      email: user.email ?? "",
      password: "",
      role: user.role as "supervisor" | "admin",
    });
    setFormError("");
    setFormVisible(true);
  }

  function openManageStores(user: UserRow) {
    setStoreModalUser(user);
    setStoreSelection(new Set(user.restaurantIds));
  }

  function toggleStoreSelection(id: number) {
    setStoreSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function saveStoreAssignments() {
    if (!storeModalUser) return;
    setStoreSaving(true);
    try {
      await customFetch(`/api/admin/users/${storeModalUser.id}/restaurants`, {
        method: "PUT",
        body: JSON.stringify({ restaurantIds: Array.from(storeSelection) }),
      });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === storeModalUser.id
            ? { ...u, restaurantIds: Array.from(storeSelection) }
            : u
        )
      );
      setStoreModalUser(null);
    } catch (err: any) {
      Alert.alert("Error", err?.data?.error ?? err?.message ?? "Something went wrong.");
    } finally {
      setStoreSaving(false);
    }
  }

  async function saveUser() {
    if (!form.username.trim() || !form.name.trim()) {
      setFormError("Username and name are required.");
      return;
    }
    if (!editingUser && form.password.length < 6) {
      setFormError("Password must be at least 6 characters.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      if (editingUser) {
        const body: Record<string, any> = {
          username: form.username.trim(),
          name: form.name.trim(),
          role: form.role,
          email: form.email.trim() || null,
        };
        await customFetch(`/api/admin/users/${editingUser.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        setFormVisible(false);
        fetchData();
        Alert.alert("Saved", `${form.name.trim()}'s account has been updated.`);
      } else {
        const body: Record<string, any> = {
          username: form.username.trim(),
          name: form.name.trim(),
          password: form.password,
          role: form.role,
        };
        if (form.email.trim()) body.email = form.email.trim();
        await customFetch("/api/admin/users", {
          method: "POST",
          body: JSON.stringify(body),
        });
        setFormVisible(false);
        fetchData();
        Alert.alert("Account Created", `${form.name.trim()} can now log in with username "${form.username.trim()}".`);
      }
    } catch (err: any) {
      const message = err?.data?.error ?? err?.message ?? "Something went wrong.";
      setFormError(message);
    } finally {
      setSaving(false);
    }
  }

  async function doDeleteUser() {
    if (!confirmUser) return;
    const user = confirmUser;
    setToggling(true);
    try {
      await customFetch(`/api/admin/users/${user.id}/deactivate`, { method: "POST" });
      setConfirmUser(null);
      fetchData();
    } catch (err: any) {
      setConfirmUser(null);
      Alert.alert("Error", err?.data?.error ?? err?.message ?? "Something went wrong.");
    } finally {
      setToggling(false);
    }
  }

  function openResetPassword(user: UserRow) {
    setResetTargetUser(user);
    setNewPassword("");
    setResetModalVisible(true);
  }

  async function doResetPassword() {
    if (newPassword.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters.");
      return;
    }
    setResetting(true);
    try {
      await customFetch(
        `/api/admin/users/${resetTargetUser!.id}/reset-password`,
        {
          method: "POST",
          body: JSON.stringify({ newPassword }),
        }
      );
      setResetModalVisible(false);
      Alert.alert("Password Reset", `New password set for ${resetTargetUser!.name}. Their existing sessions have been signed out.`);
    } catch (err: any) {
      Alert.alert("Error", err?.data?.error ?? err?.message ?? "Something went wrong.");
    } finally {
      setResetting(false);
    }
  }

  if (!isAdmin) {
    return (
      <View style={[styles.centered, { paddingTop: topPadding }]}>
        <Feather name="lock" size={48} color={Colors.textTertiary} />
        <Text style={styles.emptyText}>Admin access required</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={26} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>User Management</Text>
        <TouchableOpacity style={styles.addButton} onPress={openCreate}>
          <Feather name="user-plus" size={18} color={Colors.surface} />
          <Text style={styles.addButtonText}>Add User</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => String(u.id)}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <UserCard
              user={item}
              restaurants={restaurants}
              currentSupervisorId={supervisor?.id ?? -1}
              onEdit={() => openEdit(item)}
              onToggleActive={() => setConfirmUser(item)}
              onResetPassword={() => openResetPassword(item)}
              onManageStores={() => openManageStores(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No users found.</Text>
            </View>
          }
        />
      )}

      {/* Create / Edit Modal */}
      <Modal
        visible={formVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFormVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setFormVisible(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingUser ? "Edit User" : "New User"}
            </Text>
            <TouchableOpacity onPress={saveUser} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={Colors.primary} />
              ) : (
                <Text style={styles.saveText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            {!!formError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{formError}</Text>
              </View>
            )}

            <Text style={styles.fieldLabel}>Full Name *</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
              placeholder="e.g. Jordan Smith"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>Username *</Text>
            <TextInput
              style={styles.input}
              value={form.username}
              onChangeText={(v) => setForm((f) => ({ ...f, username: v.toLowerCase().replace(/\s/g, "") }))}
              placeholder="e.g. jsmith"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.fieldLabel}>Email (optional)</Text>
            <TextInput
              style={styles.input}
              value={form.email}
              onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
              placeholder="e.g. jsmith@example.com"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />

            {!editingUser && (
              <View>
                <Text style={styles.fieldLabel}>Password *</Text>
                <TextInput
                  style={styles.input}
                  value={form.password}
                  onChangeText={(v) => setForm((f) => ({ ...f, password: v }))}
                  placeholder="Minimum 6 characters"
                  placeholderTextColor={Colors.textTertiary}
                  secureTextEntry
                />
              </View>
            )}

            <Text style={styles.fieldLabel}>Role</Text>
            <View style={styles.roleRow}>
              {(["supervisor", "admin"] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleChip, form.role === r && styles.roleChipActive]}
                  onPress={() => setForm((f) => ({ ...f, role: r }))}
                >
                  <Text style={[styles.roleChipText, form.role === r && styles.roleChipTextActive]}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        visible={resetModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setResetModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setResetModalVisible(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Reset Password</Text>
            <TouchableOpacity onPress={doResetPassword} disabled={resetting}>
              {resetting ? (
                <ActivityIndicator color={Colors.primary} />
              ) : (
                <Text style={styles.saveText}>Reset</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.resetSubtitle}>
              Set a new password for {resetTargetUser?.name}. Their existing sessions will be signed out.
            </Text>
            <Text style={styles.fieldLabel}>New Password</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Minimum 6 characters"
              placeholderTextColor={Colors.textTertiary}
              secureTextEntry
              autoFocus
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete User Confirmation Modal */}
      <Modal
        visible={!!confirmUser}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmUser(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>Delete Account</Text>
            <Text style={styles.confirmBody}>
              {confirmUser?.name} will be permanently deleted. Their sessions will be signed out. This cannot be undone.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancel}
                onPress={() => setConfirmUser(null)}
                disabled={toggling}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmConfirm, styles.confirmDanger]}
                onPress={doDeleteUser}
                disabled={toggling}
              >
                {toggling ? (
                  <ActivityIndicator color={Colors.surface} size="small" />
                ) : (
                  <Text style={styles.confirmConfirmText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Manage Stores Modal */}
      <Modal
        visible={!!storeModalUser}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setStoreModalUser(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setStoreModalUser(null)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Assign Stores</Text>
            <TouchableOpacity onPress={saveStoreAssignments} disabled={storeSaving}>
              {storeSaving ? (
                <ActivityIndicator color={Colors.primary} />
              ) : (
                <Text style={styles.saveText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.storeSubtitle}>
              Select which stores {storeModalUser?.name} can manage.
            </Text>
            {restaurants.map((r) => {
              const selected = storeSelection.has(r.id);
              return (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.storeRow, selected && styles.storeRowSelected]}
                  onPress={() => toggleStoreSelection(r.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.storeInfo}>
                    <Text style={styles.storeName}>{r.name}</Text>
                    <Text style={styles.storeLocation}>{r.location}</Text>
                  </View>
                  <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                    {selected && <Feather name="check" size={14} color={Colors.surface} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

type UserCardProps = {
  user: UserRow;
  restaurants: Restaurant[];
  currentSupervisorId: number;
  onEdit: () => void;
  onToggleActive: () => void;
  onResetPassword: () => void;
  onManageStores: () => void;
};

function UserCard({
  user,
  restaurants,
  currentSupervisorId,
  onEdit,
  onToggleActive,
  onResetPassword,
  onManageStores,
}: UserCardProps) {
  const isSelf = user.id === currentSupervisorId;
  const assignedRestaurants = restaurants.filter((r) => (user.restaurantIds ?? []).includes(r.id));

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardInfo}>
          <View style={styles.cardNameRow}>
            <Text style={styles.cardName}>{user.name}</Text>
            {isSelf && (
              <View style={styles.selfBadge}>
                <Text style={styles.selfBadgeText}>You</Text>
              </View>
            )}
            <View style={[styles.roleBadge, user.role === "admin" && styles.roleBadgeAdmin]}>
              <Text style={[styles.roleBadgeText, user.role === "admin" && styles.roleBadgeTextAdmin]}>
                {user.role}
              </Text>
            </View>
          </View>
          <Text style={styles.cardUsername}>@{user.username}</Text>
          {!!user.email && <Text style={styles.cardEmail}>{user.email}</Text>}

          {assignedRestaurants.length > 0 && (
            <View style={styles.storeChipsRow}>
              {assignedRestaurants.map((r) => (
                <View key={r.id} style={styles.storeChip}>
                  <Feather name="map-pin" size={10} color={Colors.primary} />
                  <Text style={styles.storeChipText}>{r.name}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onEdit}>
          <Feather name="edit-2" size={15} color={Colors.primary} />
          <Text style={styles.actionBtnText}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={onManageStores}>
          <Feather name="map-pin" size={15} color={Colors.primary} />
          <Text style={styles.actionBtnText}>Stores</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={onResetPassword}>
          <Feather name="key" size={15} color={Colors.textSecondary} />
          <Text style={[styles.actionBtnText, { color: Colors.textSecondary }]}>Reset Password</Text>
        </TouchableOpacity>

        {!isSelf && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnDanger]}
            onPress={onToggleActive}
          >
            <Feather name="trash-2" size={15} color={Colors.accent} />
            <Text style={[styles.actionBtnText, { color: Colors.accent }]}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.text,
    letterSpacing: -0.5,
    flex: 1,
    textAlign: "center",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  addButtonText: {
    color: Colors.surface,
    fontWeight: "600",
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    paddingTop: 4,
  },
  separator: {
    height: 10,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textTertiary,
    marginTop: 12,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardInactive: {
    opacity: 0.65,
    borderStyle: "dashed",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  cardInfo: {
    flex: 1,
    gap: 2,
  },
  cardNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  cardName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.text,
  },
  cardUsername: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  cardEmail: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  textMuted: {
    color: Colors.textTertiary,
  },
  selfBadge: {
    backgroundColor: Colors.primary + "18",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  selfBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.primary,
  },
  roleBadge: {
    backgroundColor: Colors.textTertiary + "22",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  roleBadgeSupervisor: {},
  roleBadgeAdmin: {
    backgroundColor: Colors.primary + "18",
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textSecondary,
    textTransform: "capitalize",
  },
  roleBadgeTextAdmin: {
    color: Colors.primary,
  },
  inactiveBadge: {
    backgroundColor: Colors.accent + "18",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  inactiveBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.accent,
  },
  storeChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  storeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.primary + "12",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  storeChipText: {
    fontSize: 11,
    fontWeight: "500",
    color: Colors.primary,
  },
  cardActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionBtnDanger: {
    borderColor: Colors.accent + "44",
    backgroundColor: Colors.accent + "08",
  },
  actionBtnSuccess: {
    borderColor: Colors.success + "44",
    backgroundColor: Colors.success + "08",
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.primary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: Colors.text,
  },
  cancelText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  saveText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.primary,
  },
  modalBody: {
    flex: 1,
    padding: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 16,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
  },
  roleRow: {
    flexDirection: "row",
    gap: 10,
  },
  roleChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  roleChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  roleChipText: {
    fontSize: 15,
    fontWeight: "500",
    color: Colors.textSecondary,
  },
  roleChipTextActive: {
    color: Colors.surface,
    fontWeight: "600",
  },
  errorBanner: {
    backgroundColor: Colors.accent + "18",
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  errorBannerText: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: "500",
  },
  resetSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
    marginTop: 4,
  },
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
  confirmSuccess: {
    backgroundColor: Colors.success,
  },
  confirmConfirmText: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.surface,
  },
  storeSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
    marginTop: 4,
  },
  storeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    marginBottom: 10,
  },
  storeRowSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + "08",
  },
  storeInfo: {
    flex: 1,
    gap: 2,
  },
  storeName: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text,
  },
  storeLocation: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
    marginLeft: 12,
  },
  checkboxSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
});
