import { Feather } from "@expo/vector-icons";
import Constants from "expo-constants";
import { router } from "expo-router";
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

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { customFetch } from "@workspace/api-client-react";

type SettingsOption = {
  id: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  subtitle: string;
  route?: string;
  onPress?: () => void;
  adminOnly?: boolean;
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { supervisor, logout } = useAuth();
  const isAdmin = supervisor?.role === "admin";
  const [loggingOut, setLoggingOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const [changePwVisible, setChangePwVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changePwError, setChangePwError] = useState("");
  const [changePwSaving, setChangePwSaving] = useState(false);

  const topPadding = Platform.OS === "web" ? 32 : insets.top;

  function openChangePassword() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setChangePwError("");
    setChangePwVisible(true);
  }

  async function doChangePassword() {
    if (!currentPassword) {
      setChangePwError("Please enter your current password.");
      return;
    }
    if (newPassword.length < 6) {
      setChangePwError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setChangePwError("New passwords do not match.");
      return;
    }
    setChangePwError("");
    setChangePwSaving(true);
    try {
      await customFetch("/api/auth/supervisor/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setChangePwVisible(false);
      Alert.alert("Password Changed", "Your password has been updated successfully.");
    } catch (err: any) {
      setChangePwError(err?.data?.error ?? err?.message ?? "Something went wrong.");
    } finally {
      setChangePwSaving(false);
    }
  }

  const OPTIONS: SettingsOption[] = [
    {
      id: "device-pairing",
      icon: "tablet",
      title: "Device Pairing",
      subtitle: "Pair tablets & manage connections",
      route: "/(supervisor)/settings/device-pairing",
      adminOnly: true,
    },
    {
      id: "equipment",
      icon: "tool",
      title: "Equipment Catalog",
      subtitle: "Manage equipment items",
      route: "/(supervisor)/settings/equipment",
    },
    {
      id: "users",
      icon: "users",
      title: "Users",
      subtitle: "Manage team members",
      route: "/(supervisor)/users",
      adminOnly: true,
    },
    {
      id: "change-password",
      icon: "lock",
      title: "Change Password",
      subtitle: "Update your account password",
      onPress: openChangePassword,
    },
  ];

  const visibleOptions = OPTIONS.filter((opt) => !opt.adminOnly || isAdmin);

  const doLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      router.replace("/login");
    } catch {
      Alert.alert("Error", "Failed to log out.");
      setLoggingOut(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Settings</Text>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => setShowLogoutConfirm(true)}
          disabled={loggingOut}
        >
          <Feather name="log-out" size={20} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {visibleOptions.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={styles.optionCard}
            onPress={() => {
              if (option.onPress) {
                option.onPress();
              } else if (option.route) {
                router.push(option.route);
              }
            }}
            activeOpacity={0.75}
          >
            <View style={styles.optionIconBg}>
              <Feather name={option.icon} size={24} color={Colors.primary} />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>{option.title}</Text>
              <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
            </View>
            <Feather name="chevron-right" size={20} color={Colors.textTertiary} />
          </TouchableOpacity>
        ))}

        <Text style={styles.versionText}>
          Version {Constants.expoConfig?.version ?? "1.0.0"}
        </Text>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        visible={changePwVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setChangePwVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setChangePwVisible(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Change Password</Text>
            <TouchableOpacity onPress={doChangePassword} disabled={changePwSaving}>
              {changePwSaving ? (
                <ActivityIndicator color={Colors.primary} />
              ) : (
                <Text style={styles.saveText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            {!!changePwError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{changePwError}</Text>
              </View>
            )}

            <Text style={styles.fieldLabel}>Current Password</Text>
            <TextInput
              style={styles.input}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Enter current password"
              placeholderTextColor={Colors.textTertiary}
              secureTextEntry
              autoFocus
            />

            <Text style={styles.fieldLabel}>New Password</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Minimum 6 characters"
              placeholderTextColor={Colors.textTertiary}
              secureTextEntry
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  logoutBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 12,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  optionIconBg: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary + "15",
    justifyContent: "center",
    alignItems: "center",
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  optionSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
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
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  cancelText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  saveText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  errorBanner: {
    backgroundColor: Colors.accent + "18",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.accent + "40",
  },
  errorBannerText: {
    color: Colors.accent,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    marginBottom: 16,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  confirmBox: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 24,
    maxWidth: 320,
    width: "90%",
  },
  confirmTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 8,
  },
  confirmBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
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
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  confirmCancelText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  confirmConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: "center",
  },
  confirmDanger: {
    backgroundColor: Colors.accent,
  },
  confirmConfirmText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  versionText: {
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    marginTop: 12,
  },
});
