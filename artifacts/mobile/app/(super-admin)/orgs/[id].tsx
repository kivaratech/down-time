import { Feather } from "@expo/vector-icons";
import {
  useCreateOrgAdmin,
  useCreateOrgRestaurant,
  useDeleteOrganization,
  useGetOrganization,
  useResetOrgUserPassword,
  getGetOrganizationQueryKey,
  getListOrganizationsQueryKey,
  type OrgUser,
  type Restaurant,
} from "@workspace/api-client-react";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams, type Href } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useQueryClient } from "@tanstack/react-query";

import Colors from "@/constants/colors";

type PasswordModalData = {
  title: string;
  subtitle: string;
  username: string;
  password: string;
};

function formatCreatedAt(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function OrganizationDetailScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ id: string }>();
  const orgId = Number(params.id);

  const {
    data: org,
    isLoading,
    isError,
    refetch,
  } = useGetOrganization(orgId, {
    query: {
      queryKey: getGetOrganizationQueryKey(orgId),
      enabled: !isNaN(orgId),
    },
  });

  // ---- Restaurant add modal --------------------------------------------------
  const [addRestaurantVisible, setAddRestaurantVisible] = useState(false);
  const [restaurantForm, setRestaurantForm] = useState({ name: "", location: "" });
  const [restaurantError, setRestaurantError] = useState("");

  const createRestaurantMutation = useCreateOrgRestaurant({
    mutation: {
      onSuccess: async () => {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        queryClient.invalidateQueries({ queryKey: getGetOrganizationQueryKey(orgId) });
        queryClient.invalidateQueries({ queryKey: getListOrganizationsQueryKey() });
        setAddRestaurantVisible(false);
        setRestaurantForm({ name: "", location: "" });
      },
      onError: (err: unknown) => {
        setRestaurantError(
          (err as { data?: { error?: string } })?.data?.error ??
            (err as { message?: string })?.message ??
            "Failed to add restaurant."
        );
      },
    },
  });

  const submitRestaurant = () => {
    setRestaurantError("");
    if (!restaurantForm.name.trim()) {
      setRestaurantError("Restaurant name is required.");
      return;
    }
    if (!restaurantForm.location.trim()) {
      setRestaurantError("Location is required.");
      return;
    }
    createRestaurantMutation.mutate({
      id: orgId,
      data: {
        name: restaurantForm.name.trim(),
        location: restaurantForm.location.trim(),
      },
    });
  };

  // ---- Admin add modal -------------------------------------------------------
  const [addAdminVisible, setAddAdminVisible] = useState(false);
  const [adminForm, setAdminForm] = useState({ username: "", name: "", email: "" });
  const [adminError, setAdminError] = useState("");

  const createAdminMutation = useCreateOrgAdmin({
    mutation: {
      onSuccess: async (data) => {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        queryClient.invalidateQueries({ queryKey: getGetOrganizationQueryKey(orgId) });
        queryClient.invalidateQueries({ queryKey: getListOrganizationsQueryKey() });
        setAddAdminVisible(false);
        setAdminForm({ username: "", name: "", email: "" });
        setPasswordModal({
          title: "Admin Created",
          subtitle: `Save the password below — it will not be shown again.`,
          username: data.username,
          password: data.password,
        });
      },
      onError: (err: unknown) => {
        setAdminError(
          (err as { data?: { error?: string } })?.data?.error ??
            (err as { message?: string })?.message ??
            "Failed to add admin."
        );
      },
    },
  });

  const submitAdmin = () => {
    setAdminError("");
    if (adminForm.username.trim().length < 2) {
      setAdminError("Username must be at least 2 characters.");
      return;
    }
    if (!adminForm.name.trim()) {
      setAdminError("Display name is required.");
      return;
    }
    createAdminMutation.mutate({
      id: orgId,
      data: {
        username: adminForm.username.trim(),
        name: adminForm.name.trim(),
        email: adminForm.email.trim() || null,
      },
    });
  };

  // ---- Reset password flow ---------------------------------------------------
  const [resetTarget, setResetTarget] = useState<OrgUser | null>(null);

  const resetPasswordMutation = useResetOrgUserPassword({
    mutation: {
      onSuccess: async (data, vars) => {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const username =
          [...(org?.admins ?? []), ...(org?.supervisors ?? [])].find(
            (u) => u.id === vars.userId
          )?.username ?? "user";
        setResetTarget(null);
        setPasswordModal({
          title: "Password Reset",
          subtitle:
            `New password for ${username}. All their existing sessions have been revoked.`,
          username,
          password: data.password,
        });
      },
      onError: () => {
        setResetTarget(null);
        Alert.alert("Reset Failed", "Could not reset the password. Try again.");
      },
    },
  });

  const confirmReset = (user: OrgUser) => setResetTarget(user);
  const doReset = () => {
    if (!resetTarget) return;
    resetPasswordMutation.mutate({ id: orgId, userId: resetTarget.id });
  };

  // ---- Password modal (shared for add-admin and reset) -----------------------
  const [passwordModal, setPasswordModal] = useState<PasswordModalData | null>(null);
  const [copied, setCopied] = useState(false);

  const copyPassword = async () => {
    if (!passwordModal) return;
    await Clipboard.setStringAsync(passwordModal.password);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ---- Delete org flow -------------------------------------------------------
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const deleteOrgMutation = useDeleteOrganization({
    mutation: {
      onSuccess: async () => {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        queryClient.invalidateQueries({ queryKey: getListOrganizationsQueryKey() });
        queryClient.removeQueries({ queryKey: getGetOrganizationQueryKey(orgId) });
        setDeleteVisible(false);
        router.replace("/(super-admin)" as Href);
      },
      onError: (err: unknown) => {
        setDeleteError(
          (err as { data?: { error?: string } })?.data?.error ??
            (err as { message?: string })?.message ??
            "Failed to delete organization."
        );
      },
    },
  });

  const openDelete = () => {
    setDeleteConfirmText("");
    setDeleteError("");
    setDeleteVisible(true);
  };

  const doDelete = () => {
    if (!org) return;
    if (deleteConfirmText.trim() !== org.name) {
      setDeleteError(`Please type "${org.name}" exactly to confirm.`);
      return;
    }
    deleteOrgMutation.mutate({ id: orgId });
  };

  // ---- Render ----------------------------------------------------------------
  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: Colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (isError || !org) {
    return (
      <View style={[styles.centered, { backgroundColor: Colors.background }]}>
        <Feather name="alert-circle" size={42} color={Colors.textTertiary} />
        <Text style={styles.errorText}>Could not load organization.</Text>
        <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const adminCount = org.admins?.length ?? 0;
  const supervisorCount = org.supervisors?.length ?? 0;
  const restaurantCount = org.restaurants?.length ?? 0;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: org.name,
          headerRight: () => (
            <TouchableOpacity
              onPress={openDelete}
              style={styles.headerBtn}
              accessibilityLabel="Delete organization"
            >
              <Feather name="trash-2" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <View style={styles.metaCard}>
          <Text style={styles.metaTitle}>{org.name}</Text>
          <Text style={styles.metaSub}>
            Created {formatCreatedAt(org.createdAt)} · ID {org.id}
          </Text>
        </View>

        {/* Restaurants section */}
        <SectionHeader
          title="Restaurants"
          count={restaurantCount}
          actionLabel="Add"
          onAction={() => {
            setRestaurantForm({ name: "", location: "" });
            setRestaurantError("");
            setAddRestaurantVisible(true);
          }}
        />
        <View style={styles.section}>
          {restaurantCount === 0 ? (
            <EmptyRow text="No restaurants yet." />
          ) : (
            org.restaurants?.map((r: Restaurant) => (
              <View key={r.id} style={styles.row}>
                <View style={styles.rowLeft}>
                  <Text style={styles.rowTitle}>{r.name}</Text>
                  <Text style={styles.rowSub}>{r.location}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Admins section */}
        <SectionHeader
          title="Admins"
          count={adminCount}
          actionLabel="Add"
          onAction={() => {
            setAdminForm({ username: "", name: "", email: "" });
            setAdminError("");
            setAddAdminVisible(true);
          }}
        />
        <View style={styles.section}>
          {adminCount === 0 ? (
            <EmptyRow text="No admins yet." />
          ) : (
            org.admins?.map((u: OrgUser) => (
              <UserRow key={u.id} user={u} onResetPassword={() => confirmReset(u)} />
            ))
          )}
        </View>

        {/* Supervisors section (read-only — added by org admins via their own UI) */}
        <SectionHeader title="Supervisors" count={supervisorCount} />
        <View style={styles.section}>
          {supervisorCount === 0 ? (
            <EmptyRow text="No supervisors yet. The org admin adds these from their dashboard." />
          ) : (
            org.supervisors?.map((u: OrgUser) => (
              <UserRow key={u.id} user={u} onResetPassword={() => confirmReset(u)} />
            ))
          )}
        </View>
      </ScrollView>

      {/* Add restaurant modal */}
      <FormModal
        visible={addRestaurantVisible}
        title="Add Restaurant"
        submitting={createRestaurantMutation.isPending}
        onSubmit={submitRestaurant}
        onCancel={() => setAddRestaurantVisible(false)}
        error={restaurantError}
        submitLabel="Add Restaurant"
      >
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Name *</Text>
          <TextInput
            style={styles.input}
            value={restaurantForm.name}
            onChangeText={(v) => setRestaurantForm((f) => ({ ...f, name: v }))}
            placeholder="e.g. Main Street"
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="words"
            editable={!createRestaurantMutation.isPending}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Location *</Text>
          <TextInput
            style={styles.input}
            value={restaurantForm.location}
            onChangeText={(v) =>
              setRestaurantForm((f) => ({ ...f, location: v }))
            }
            placeholder="e.g. 123 Main St"
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="words"
            editable={!createRestaurantMutation.isPending}
          />
        </View>
      </FormModal>

      {/* Add admin modal */}
      <FormModal
        visible={addAdminVisible}
        title="Add Admin"
        submitting={createAdminMutation.isPending}
        onSubmit={submitAdmin}
        onCancel={() => setAddAdminVisible(false)}
        error={adminError}
        submitLabel="Create Admin"
      >
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Username *</Text>
          <TextInput
            style={styles.input}
            value={adminForm.username}
            onChangeText={(v) => setAdminForm((f) => ({ ...f, username: v }))}
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor={Colors.textTertiary}
            editable={!createAdminMutation.isPending}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Display Name *</Text>
          <TextInput
            style={styles.input}
            value={adminForm.name}
            onChangeText={(v) => setAdminForm((f) => ({ ...f, name: v }))}
            autoCapitalize="words"
            placeholderTextColor={Colors.textTertiary}
            editable={!createAdminMutation.isPending}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Email (optional)</Text>
          <TextInput
            style={styles.input}
            value={adminForm.email}
            onChangeText={(v) => setAdminForm((f) => ({ ...f, email: v }))}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholderTextColor={Colors.textTertiary}
            editable={!createAdminMutation.isPending}
          />
        </View>
      </FormModal>

      {/* Reset password confirmation modal */}
      <Modal visible={!!resetTarget} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Feather name="key" size={24} color={Colors.warning} />
              <Text style={styles.modalTitle}>Reset Password</Text>
            </View>
            <Text style={styles.modalSubtitle}>
              Generate a fresh password for{" "}
              <Text style={{ fontWeight: "700", color: Colors.text }}>
                {resetTarget?.name}
              </Text>{" "}
              ({resetTarget?.username})? All of their existing sessions will be
              revoked.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setResetTarget(null)}
                disabled={resetPasswordMutation.isPending}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={doReset}
                disabled={resetPasswordMutation.isPending}
              >
                {resetPasswordMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>
                    Reset Password
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* One-time password modal (shared for create admin / reset password) */}
      <Modal visible={!!passwordModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Feather name="check-circle" size={28} color={Colors.success} />
              <Text style={styles.modalTitle}>{passwordModal?.title}</Text>
            </View>
            <Text style={styles.modalSubtitle}>
              {passwordModal?.subtitle}{" "}
              <Text style={{ fontWeight: "700", color: Colors.accent }}>
                It will not be shown again.
              </Text>
            </Text>

            <View style={styles.credentialBox}>
              <Text style={styles.credentialLabel}>Username</Text>
              <Text style={styles.credentialValue}>{passwordModal?.username}</Text>
            </View>
            <View style={styles.credentialBox}>
              <Text style={styles.credentialLabel}>Password</Text>
              <Text style={styles.credentialMono} selectable>
                {passwordModal?.password}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.copyBtn, copied && styles.copyBtnSuccess]}
              onPress={copyPassword}
            >
              <Feather name={copied ? "check" : "copy"} size={18} color="#FFFFFF" />
              <Text style={styles.copyBtnText}>
                {copied ? "Copied!" : "Copy Password"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dismissBtn}
              onPress={() => {
                setPasswordModal(null);
                setCopied(false);
              }}
            >
              <Text style={styles.dismissBtnText}>
                I&apos;ve saved the password
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete org modal */}
      <Modal visible={deleteVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Feather name="alert-triangle" size={28} color={Colors.accent} />
                <Text style={styles.modalTitle}>Delete Organization</Text>
              </View>
              <Text style={styles.modalSubtitle}>
                This deletes{" "}
                <Text style={{ fontWeight: "700", color: Colors.text }}>
                  {org.name}
                </Text>{" "}
                and all of its restaurants, issues, equipment, users, and
                sessions. This cannot be undone.
              </Text>
              <Text style={styles.modalSubtitle}>
                Type{" "}
                <Text style={{ fontWeight: "700", color: Colors.text }}>
                  {org.name}
                </Text>{" "}
                to confirm:
              </Text>
              <TextInput
                style={styles.input}
                value={deleteConfirmText}
                onChangeText={(v) => {
                  setDeleteConfirmText(v);
                  setDeleteError("");
                }}
                placeholder={org.name}
                placeholderTextColor={Colors.textTertiary}
                autoCapitalize="none"
                editable={!deleteOrgMutation.isPending}
              />
              {deleteError ? (
                <Text style={styles.errorText}>{deleteError}</Text>
              ) : null}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnCancel]}
                  onPress={() => setDeleteVisible(false)}
                  disabled={deleteOrgMutation.isPending}
                >
                  <Text style={styles.modalBtnCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnDanger]}
                  onPress={doDelete}
                  disabled={
                    deleteOrgMutation.isPending ||
                    deleteConfirmText.trim() !== org.name
                  }
                >
                  {deleteOrgMutation.isPending ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalBtnPrimaryText}>
                      Delete Forever
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Internal building blocks
// ---------------------------------------------------------------------------

function SectionHeader({
  title,
  count,
  actionLabel,
  onAction,
}: {
  title: string;
  count: number;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{count}</Text>
        </View>
      </View>
      {actionLabel && onAction ? (
        <TouchableOpacity
          onPress={onAction}
          style={styles.sectionAction}
          activeOpacity={0.75}
        >
          <Feather name="plus" size={16} color={Colors.primary} />
          <Text style={styles.sectionActionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <View style={styles.emptyRow}>
      <Text style={styles.emptyRowText}>{text}</Text>
    </View>
  );
}

function UserRow({
  user,
  onResetPassword,
}: {
  user: OrgUser;
  onResetPassword: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowTitle}>{user.name}</Text>
        <Text style={styles.rowSub}>
          {user.username}
          {user.email ? ` · ${user.email}` : ""}
          {user.isActive ? "" : " · inactive"}
        </Text>
      </View>
      <TouchableOpacity
        onPress={onResetPassword}
        style={styles.rowAction}
        accessibilityLabel={`Reset password for ${user.username}`}
      >
        <Feather name="key" size={16} color={Colors.warning} />
        <Text style={styles.rowActionText}>Reset</Text>
      </TouchableOpacity>
    </View>
  );
}

function FormModal({
  visible,
  title,
  submitting,
  onSubmit,
  onCancel,
  submitLabel,
  error,
  children,
}: {
  visible: boolean;
  title: string;
  submitting: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
  error: string;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{title}</Text>
            <View style={{ marginTop: 12 }}>{children}</View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={onCancel}
                disabled={submitting}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={onSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>{submitLabel}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    padding: 20,
  },
  headerBtn: { paddingHorizontal: 8, paddingVertical: 4 },

  metaCard: {
    backgroundColor: Colors.surface,
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 14,
  },
  metaTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.text,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  metaSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textSecondary,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  countBadge: {
    backgroundColor: Colors.borderLight,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countBadgeText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: "Inter_600SemiBold",
  },
  sectionAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  sectionActionText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },

  section: {
    marginHorizontal: 16,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  rowLeft: { flex: 1 },
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  rowSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  rowAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Colors.warning + "12",
    borderRadius: 8,
  },
  rowActionText: {
    color: Colors.warning,
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  emptyRow: {
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  emptyRowText: {
    fontSize: 14,
    color: Colors.textTertiary,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
  },

  // Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 24,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.text,
    fontFamily: "Inter_700Bold",
  },
  modalSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
    marginBottom: 14,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  modalBtnCancel: {
    backgroundColor: Colors.borderLight,
  },
  modalBtnCancelText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  modalBtnPrimary: { backgroundColor: Colors.primary },
  modalBtnPrimaryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  modalBtnDanger: { backgroundColor: Colors.accent },

  // Form fields shared with modals
  fieldGroup: { marginBottom: 12 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 16,
    color: Colors.text,
    fontFamily: "Inter_400Regular",
  },
  errorText: {
    color: Colors.accent,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 6,
    textAlign: "center",
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },

  // Password modal extras
  credentialBox: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  credentialLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textSecondary,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  credentialValue: {
    fontSize: 16,
    color: Colors.text,
    fontFamily: "Inter_500Medium",
  },
  credentialMono: {
    fontSize: 16,
    color: Colors.text,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
  },
  copyBtnSuccess: { backgroundColor: Colors.success },
  copyBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  dismissBtn: {
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  dismissBtnText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
