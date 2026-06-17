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

type Specialty = "equipment" | "technology" | "both";

type UserRow = {
  id: number;
  name: string;
  email: string;
  role: string;
  specialty: Specialty;
  isActive: boolean;
  createdAt: string;
  restaurantIds: number[];
};

const SPECIALTY_OPTIONS: { key: Specialty; label: string; icon: React.ComponentProps<typeof Feather>["name"] }[] = [
  { key: "equipment", label: "Equipment", icon: "tool" },
  { key: "technology", label: "Technology", icon: "monitor" },
  { key: "both", label: "Both", icon: "layers" },
];

type Restaurant = {
  id: number;
  name: string;
  location: string;
};

type FormState = {
  name: string;
  email: string;
  emailConfirm: string;
  password: string;
  confirmPassword: string;
  role: "supervisor" | "admin";
  specialty: Specialty;
};

const emptyForm = (): FormState => ({
  name: "",
  email: "",
  emailConfirm: "",
  password: "",
  confirmPassword: "",
  role: "supervisor",
  specialty: "both",
});

// Lightweight client-side email shape check. The server has the
// authoritative zod + MX validation; this just catches obvious mistakes
// before a round trip.
function looksLikeEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

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
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetting, setResetting] = useState(false);

  const [confirmUser, setConfirmUser] = useState<UserRow | null>(null);
  const [toggling, setToggling] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

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
      name: user.name,
      email: user.email,
      // Pre-fill the confirm field on edit so the admin doesn't need to
      // retype an unchanged email. The validator only re-checks the match
      // when the email field is actually edited away from this value.
      emailConfirm: user.email,
      password: "",
      confirmPassword: "",
      role: user.role as "supervisor" | "admin",
      specialty: user.specialty ?? "both",
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
    if (!form.name.trim()) {
      setFormError("Name is required.");
      return;
    }
    const email = form.email.trim().toLowerCase();
    const emailConfirm = form.emailConfirm.trim().toLowerCase();
    if (!email) {
      setFormError("Email is required — it's the login credential.");
      return;
    }
    if (!looksLikeEmail(email)) {
      setFormError("That doesn't look like a valid email.");
      return;
    }
    if (email !== emailConfirm) {
      setFormError("The two email addresses don't match.");
      return;
    }
    if (!editingUser && form.password.length < 6) {
      setFormError("Password must be at least 6 characters.");
      return;
    }
    if (!editingUser && form.password !== form.confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      if (editingUser) {
        const body: Record<string, any> = {
          name: form.name.trim(),
          role: form.role,
          // Specialty only matters for supervisors; the server pins admins to
          // "both" anyway, so sending it is harmless.
          specialty: form.role === "admin" ? "both" : form.specialty,
        };
        // Only send email if it actually changed — avoids triggering a
        // redundant MX check and uniqueness lookup server-side.
        if (email !== editingUser.email) body.email = email;
        await customFetch(`/api/admin/users/${editingUser.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        setFormVisible(false);
        fetchData();
        Alert.alert("Saved", `${form.name.trim()}'s account has been updated.`);
      } else {
        const body = {
          name: form.name.trim(),
          email,
          password: form.password,
          role: form.role,
          specialty: form.role === "admin" ? "both" : form.specialty,
        };
        await customFetch("/api/admin/users", {
          method: "POST",
          body: JSON.stringify(body),
        });
        setFormVisible(false);
        fetchData();
        Alert.alert("Account Created", `${form.name.trim()} can now log in with "${email}".`);
      }
    } catch (err: any) {
      const message = err?.data?.error ?? err?.message ?? "Something went wrong.";
      setFormError(message);
    } finally {
      setSaving(false);
    }
  }

  async function doToggleUser() {
    if (!confirmUser) return;
    const user = confirmUser;
    setToggling(true);
    try {
      // "Delete" was always a soft deactivate server-side; the UI now says
      // so honestly and offers the reverse path. Reactivated users keep
      // their existing password.
      const action = user.isActive ? "deactivate" : "activate";
      await customFetch(`/api/admin/users/${user.id}/${action}`, { method: "POST" });
      setConfirmUser(null);
      fetchData();
    } catch (err: any) {
      setConfirmUser(null);
      Alert.alert("Error", err?.data?.error ?? err?.message ?? "Something went wrong.");
    } finally {
      setToggling(false);
    }
  }

  async function doDeleteUser() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await customFetch(`/api/admin/users/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      fetchData();
    } catch (err: any) {
      setDeleteTarget(null);
      Alert.alert("Error", err?.data?.error ?? err?.message ?? "Something went wrong.");
    } finally {
      setDeleting(false);
    }
  }

  function openResetPassword(user: UserRow) {
    setResetTargetUser(user);
    setNewPassword("");
    setConfirmNewPassword("");
    setResetError("");
    setResetModalVisible(true);
  }

  async function doResetPassword() {
    if (newPassword.length < 6) {
      setResetError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setResetError("Passwords do not match.");
      return;
    }
    setResetError("");
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
              onDelete={() => setDeleteTarget(item)}
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

            <Text style={styles.fieldLabel}>Email *</Text>
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

            <Text style={styles.fieldLabel}>Confirm Email *</Text>
            <TextInput
              style={styles.input}
              value={form.emailConfirm}
              onChangeText={(v) => setForm((f) => ({ ...f, emailConfirm: v }))}
              placeholder="Re-enter email"
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
                <Text style={styles.fieldLabel}>Confirm Password *</Text>
                <TextInput
                  style={styles.input}
                  value={form.confirmPassword}
                  onChangeText={(v) => setForm((f) => ({ ...f, confirmPassword: v }))}
                  placeholder="Re-enter password"
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

            {/* Specialty — supervisors only. Admins always get everything, so
                there's nothing to choose for them. */}
            {form.role === "supervisor" && (
              <>
                <Text style={styles.fieldLabel}>Notifications For</Text>
                <View style={styles.specialtyRow}>
                  {SPECIALTY_OPTIONS.map((opt) => {
                    const active = form.specialty === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={[styles.specialtyChip, active && styles.specialtyChipActive]}
                        onPress={() => setForm((f) => ({ ...f, specialty: opt.key }))}
                      >
                        <Feather
                          name={opt.icon}
                          size={15}
                          color={active ? "#FFFFFF" : Colors.textSecondary}
                        />
                        <Text style={[styles.specialtyChipText, active && styles.specialtyChipTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.specialtyHint}>
                  Which issues this person is notified about. Their issue list
                  also opens to this category (they can still view all).
                </Text>
              </>
            )}
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
            {!!resetError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{resetError}</Text>
              </View>
            )}
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
            <Text style={styles.fieldLabel}>Confirm New Password</Text>
            <TextInput
              style={styles.input}
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
              placeholder="Re-enter new password"
              placeholderTextColor={Colors.textTertiary}
              secureTextEntry
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Deactivate / Reactivate Confirmation Modal */}
      <Modal
        visible={!!confirmUser}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmUser(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>
              {confirmUser?.isActive ? "Deactivate Account" : "Reactivate Account"}
            </Text>
            <Text style={styles.confirmBody}>
              {confirmUser?.isActive
                ? `${confirmUser?.name} will no longer be able to log in, and their sessions will be signed out. You can reactivate them later — their password is kept.`
                : `${confirmUser?.name} will be able to log in again with their existing password.`}
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
                style={[
                  styles.confirmConfirm,
                  confirmUser?.isActive ? styles.confirmDanger : styles.confirmSuccess,
                ]}
                onPress={doToggleUser}
                disabled={toggling}
              >
                {toggling ? (
                  <ActivityIndicator color={Colors.surface} size="small" />
                ) : (
                  <Text style={styles.confirmConfirmText}>
                    {confirmUser?.isActive ? "Deactivate" : "Reactivate"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Permanent Delete Confirmation Modal */}
      <Modal
        visible={!!deleteTarget}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      >
        <View style={styles.overlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>Delete Permanently</Text>
            <Text style={styles.confirmBody}>
              {deleteTarget?.name} ({deleteTarget?.email}) will be permanently
              deleted. This cannot be undone. Their email becomes available
              for a new account.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancel}
                onPress={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmConfirm, styles.confirmDanger]}
                onPress={doDeleteUser}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator color={Colors.surface} size="small" />
                ) : (
                  <Text style={styles.confirmConfirmText}>Delete Forever</Text>
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
  onDelete: () => void;
  onResetPassword: () => void;
  onManageStores: () => void;
};

function UserCard({
  user,
  restaurants,
  currentSupervisorId,
  onEdit,
  onToggleActive,
  onDelete,
  onResetPassword,
  onManageStores,
}: UserCardProps) {
  const isSelf = user.id === currentSupervisorId;
  const assignedRestaurants = restaurants.filter((r) => (user.restaurantIds ?? []).includes(r.id));

  return (
    <View style={[styles.card, !user.isActive && styles.cardInactive]}>
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
            {/* Specialty badge — supervisors only (admins always get all). */}
            {user.role === "supervisor" && (() => {
              const spec = SPECIALTY_OPTIONS.find((s) => s.key === (user.specialty ?? "both")) ?? SPECIALTY_OPTIONS[2];
              return (
                <View style={styles.specialtyBadge}>
                  <Feather name={spec.icon} size={11} color={Colors.primary} />
                  <Text style={styles.specialtyBadgeText}>{spec.label}</Text>
                </View>
              );
            })()}
            {!user.isActive && (
              <View style={styles.inactiveBadge}>
                <Text style={styles.inactiveBadgeText}>Inactive</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardEmail}>{user.email}</Text>

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
          user.isActive ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnDanger]}
              onPress={onToggleActive}
            >
              <Feather name="user-x" size={15} color={Colors.accent} />
              <Text style={[styles.actionBtnText, { color: Colors.accent }]}>Deactivate</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnSuccess]}
                onPress={onToggleActive}
              >
                <Feather name="user-check" size={15} color={Colors.success} />
                <Text style={[styles.actionBtnText, { color: Colors.success }]}>Reactivate</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnDanger]}
                onPress={onDelete}
              >
                <Feather name="trash-2" size={15} color={Colors.accent} />
                <Text style={[styles.actionBtnText, { color: Colors.accent }]}>Delete</Text>
              </TouchableOpacity>
            </>
          )
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
    // Reduced horizontal padding compensates for the new padding on the
    // Cancel/Save buttons so the text stays near the edges; extra top
    // padding nudges the whole row down from the very top of the sheet.
    paddingHorizontal: 12,
    paddingTop: 26,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: Colors.text,
  },
  // Padding lives on the Text so it grows the TouchableOpacity's tap area —
  // bigger, easier-to-hit Cancel/Save targets without changing the layout.
  cancelText: {
    fontSize: 17,
    color: Colors.textSecondary,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  saveText: {
    fontSize: 17,
    fontWeight: "600",
    color: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 8,
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
  specialtyRow: {
    flexDirection: "row",
    gap: 8,
  },
  specialtyChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  specialtyChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  specialtyChipText: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.textSecondary,
    fontFamily: "Inter_500Medium",
  },
  specialtyChipTextActive: {
    color: Colors.surface,
    fontWeight: "600",
  },
  specialtyHint: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontFamily: "Inter_400Regular",
    marginTop: 8,
    lineHeight: 17,
  },
  specialtyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.primary + "12",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  specialtyBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.primary,
    fontFamily: "Inter_600SemiBold",
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
