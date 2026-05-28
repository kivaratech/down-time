import { Feather } from "@expo/vector-icons";
import {
  useCreateOrganization,
  useListEquipmentTemplates,
  getListOrganizationsQueryKey,
  type EquipmentTemplateSummary,
} from "@workspace/api-client-react";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router, type Href } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
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

type FormState = {
  name: string;
  adminUsername: string;
  adminName: string;
  adminEmail: string;
  templateKey: string;
};

const DEFAULT_TEMPLATE_KEY = "generic";

const emptyForm = (): FormState => ({
  name: "",
  adminUsername: "",
  adminName: "",
  adminEmail: "",
  templateKey: DEFAULT_TEMPLATE_KEY,
});

type SuccessPayload = {
  organizationId: number;
  organizationName: string;
  adminUsername: string;
  password: string;
};

export default function NewOrganizationScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormState>(emptyForm());
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<SuccessPayload | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: templates, isLoading: templatesLoading } =
    useListEquipmentTemplates();

  const createOrgMutation = useCreateOrganization({
    mutation: {
      onSuccess: async (data) => {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        queryClient.invalidateQueries({
          queryKey: getListOrganizationsQueryKey(),
        });
        setSuccess({
          organizationId: data.organization.id,
          organizationName: data.organization.name,
          adminUsername: data.admin.username,
          password: data.admin.password,
        });
      },
      onError: async (err: unknown) => {
        const message =
          (err as { data?: { error?: string } })?.data?.error ??
          (err as { message?: string })?.message ??
          "Failed to create organization.";
        setError(message);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      },
    },
  });

  const submit = () => {
    setError("");
    if (!form.name.trim()) {
      setError("Organization name is required.");
      return;
    }
    if (form.adminUsername.trim().length < 2) {
      setError("Admin username must be at least 2 characters.");
      return;
    }
    if (!form.adminName.trim()) {
      setError("Admin name is required.");
      return;
    }
    createOrgMutation.mutate({
      data: {
        name: form.name.trim(),
        adminUsername: form.adminUsername.trim(),
        adminName: form.adminName.trim(),
        adminEmail: form.adminEmail.trim() || null,
        // Cast: server validates against EQUIPMENT_TEMPLATES; spec restricts
        // to the closed enum so codegen narrows this field. We pass the
        // picked key through as-is.
        templateKey: form.templateKey as "generic" | "mcdonalds",
      },
    });
  };

  const copyPassword = async () => {
    if (!success) return;
    await Clipboard.setStringAsync(success.password);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const dismissSuccess = () => {
    if (!success) return;
    const orgId = success.organizationId;
    setSuccess(null);
    setForm(emptyForm());
    // Replace so the back button on detail goes to the org list, not the form.
    router.replace(`/(super-admin)/orgs/${orgId}` as Href);
  };

  const submitting = createOrgMutation.isPending;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionLabel}>Organization</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Name *</Text>
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
            placeholder="e.g. Burger Palace LLC"
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="words"
            editable={!submitting}
          />
        </View>

        <Text style={styles.sectionLabel}>First Admin</Text>
        <Text style={styles.sectionHint}>
          This admin will log in to manage their organization. A random password
          is generated and shown once after creation.
        </Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Username *</Text>
          <TextInput
            style={styles.input}
            value={form.adminUsername}
            onChangeText={(v) =>
              setForm((f) => ({ ...f, adminUsername: v }))
            }
            placeholder="e.g. burgerpalace_admin"
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Display Name *</Text>
          <TextInput
            style={styles.input}
            value={form.adminName}
            onChangeText={(v) => setForm((f) => ({ ...f, adminName: v }))}
            placeholder="e.g. Jamie Chen"
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="words"
            editable={!submitting}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Email (optional)</Text>
          <TextInput
            style={styles.input}
            value={form.adminEmail}
            onChangeText={(v) => setForm((f) => ({ ...f, adminEmail: v }))}
            placeholder="admin@example.com"
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!submitting}
          />
        </View>

        <Text style={styles.sectionLabel}>Equipment Template</Text>
        <Text style={styles.sectionHint}>
          Seeds the new org&apos;s equipment catalog. The org admin can edit it
          afterwards.
        </Text>

        {templatesLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginVertical: 12 }} />
        ) : (
          <View style={styles.templateList}>
            {(templates ?? []).map((t: EquipmentTemplateSummary) => {
              const selected = form.templateKey === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[
                    styles.templateCard,
                    selected && styles.templateCardSelected,
                  ]}
                  onPress={() =>
                    setForm((f) => ({ ...f, templateKey: t.key }))
                  }
                  disabled={submitting}
                  activeOpacity={0.75}
                >
                  <View style={styles.templateRadioWrap}>
                    <View
                      style={[
                        styles.templateRadio,
                        selected && styles.templateRadioSelected,
                      ]}
                    >
                      {selected && (
                        <View style={styles.templateRadioInner} />
                      )}
                    </View>
                  </View>
                  <View style={styles.templateText}>
                    <Text style={styles.templateLabel}>{t.label}</Text>
                    <Text style={styles.templateDescription}>
                      {t.description}
                    </Text>
                    <Text style={styles.templateCount}>
                      {t.itemCount} item{t.itemCount === 1 ? "" : "s"}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[
            styles.submitBtn,
            submitting && styles.submitBtnDisabled,
          ]}
          onPress={submit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitBtnText}>Create Organization</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => router.back()}
          disabled={submitting}
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* One-time password modal */}
      <Modal
        visible={!!success}
        transparent
        animationType="fade"
        onRequestClose={() => {
          /* prevent dismissing without copying */
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Feather name="check-circle" size={28} color={Colors.success} />
              <Text style={styles.modalTitle}>Organization Created</Text>
            </View>

            <Text style={styles.modalSubtitle}>
              {success?.organizationName} is ready. Save the password below —{" "}
              <Text style={{ fontWeight: "700", color: Colors.accent }}>
                it will not be shown again.
              </Text>
            </Text>

            <View style={styles.credentialBox}>
              <Text style={styles.credentialLabel}>Username</Text>
              <Text style={styles.credentialValue}>
                {success?.adminUsername}
              </Text>
            </View>

            <View style={styles.credentialBox}>
              <Text style={styles.credentialLabel}>Password</Text>
              <Text style={styles.credentialMono} selectable>
                {success?.password}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.copyBtn,
                copied && styles.copyBtnSuccess,
              ]}
              onPress={copyPassword}
              activeOpacity={0.85}
            >
              <Feather
                name={copied ? "check" : "copy"}
                size={18}
                color="#FFFFFF"
              />
              <Text style={styles.copyBtnText}>
                {copied ? "Copied!" : "Copy Password"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dismissBtn}
              onPress={dismissSuccess}
              activeOpacity={0.85}
            >
              <Text style={styles.dismissBtnText}>
                I&apos;ve saved the password
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  sectionHint: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
    marginBottom: 12,
  },
  fieldGroup: { marginBottom: 14 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
    fontFamily: "Inter_400Regular",
  },
  templateList: { gap: 10, marginBottom: 16 },
  templateCard: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 14,
    gap: 12,
  },
  templateCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceSecondary,
  },
  templateRadioWrap: { paddingTop: 2 },
  templateRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.textTertiary,
    justifyContent: "center",
    alignItems: "center",
  },
  templateRadioSelected: { borderColor: Colors.primary },
  templateRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  templateText: { flex: 1 },
  templateLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.text,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  templateDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
    marginBottom: 4,
  },
  templateCount: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontFamily: "Inter_400Regular",
  },
  errorText: {
    color: Colors.accent,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 8,
    marginBottom: 8,
    textAlign: "center",
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  cancelBtn: { paddingVertical: 14, alignItems: "center", marginTop: 4 },
  cancelBtnText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
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
    marginBottom: 18,
    lineHeight: 20,
  },
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
