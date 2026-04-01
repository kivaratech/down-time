import { Feather } from "@expo/vector-icons";
import { supervisorLogin } from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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

type Mode = "choose" | "supervisor";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { loginSupervisor } = useAuth();
  const [mode, setMode] = useState<Mode>("choose");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const passwordRef = useRef<TextInput>(null);

  function reset() {
    setUsername("");
    setPassword("");
    setShowPassword(false);
    setError("");
  }

  const handleSupervisorLogin = async () => {
    if (!username.trim() || !password || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await supervisorLogin({ username: username.trim(), password });
      await loginSupervisor(res.token, {
        id: res.supervisor.id,
        username: res.supervisor.username,
        name: res.supervisor.name,
        role: (res.supervisor as { role?: string }).role as "admin" | "supervisor" ?? "supervisor",
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(supervisor)");
    } catch {
      setError("Invalid username or password.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Feather name="tool" size={32} color="#FFFFFF" />
          </View>
          <Text style={styles.appName}>DownTime</Text>
          <Text style={styles.tagline}>Restaurant Issue Tracker</Text>
          <Text style={styles.orgName}>Gandar Management, Inc.</Text>
        </View>

        {mode === "choose" && (
          <View style={styles.chooseContainer}>
            <Text style={styles.chooseTitle}>How are you accessing?</Text>

            <TouchableOpacity
              style={styles.choiceCard}
              onPress={() => { setMode("supervisor"); reset(); }}
              activeOpacity={0.75}
            >
              <View style={[styles.choiceIcon, { backgroundColor: Colors.primary }]}>
                <Feather name="layers" size={28} color="#FFFFFF" />
              </View>
              <View style={styles.choiceText}>
                <Text style={styles.choiceTitle}>Supervisor / Admin Login</Text>
                <Text style={styles.choiceSubtitle}>Individual login with username & password</Text>
              </View>
              <Feather name="chevron-right" size={22} color={Colors.textTertiary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.choiceCard}
              onPress={() => router.push("/pair")}
              activeOpacity={0.75}
            >
              <View style={[styles.choiceIcon, { backgroundColor: Colors.accent }]}>
                <Feather name="link" size={28} color="#FFFFFF" />
              </View>
              <View style={styles.choiceText}>
                <Text style={styles.choiceTitle}>Pair Restaurant Device</Text>
                <Text style={styles.choiceSubtitle}>Enter pairing code from your admin</Text>
              </View>
              <Feather name="chevron-right" size={22} color={Colors.textTertiary} />
            </TouchableOpacity>
          </View>
        )}

        {mode === "supervisor" && (
          <View style={styles.formContainer}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => { setMode("choose"); reset(); }}
            >
              <Feather name="arrow-left" size={20} color={Colors.primary} />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>

            <Text style={styles.formTitle}>Supervisor / Admin Login</Text>
            <Text style={styles.formSubtitle}>Enter your individual credentials</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Username</Text>
              <View style={styles.inputWrapper}>
                <Feather name="user" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={username}
                  onChangeText={(v) => { setUsername(v); setError(""); }}
                  placeholder="Enter username"
                  placeholderTextColor={Colors.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  autoFocus
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputWrapper}>
                <Feather name="lock" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                <TextInput
                  ref={passwordRef}
                  style={[styles.textInput, { flex: 1 }]}
                  value={password}
                  onChangeText={(v) => { setPassword(v); setError(""); }}
                  placeholder="Enter password"
                  placeholderTextColor={Colors.textTertiary}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleSupervisorLogin}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Feather
                    name={showPassword ? "eye-off" : "eye"}
                    size={18}
                    color={Colors.textTertiary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.loginBtn, (loading || !username.trim() || !password) && styles.loginBtnDisabled]}
              onPress={handleSupervisorLogin}
              disabled={loading || !username.trim() || !password}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.loginBtnText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.forgotBtn}
              onPress={() => router.push("/forgot-password")}
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  scroll: {
    flexGrow: 1,
  },
  header: {
    alignItems: "center",
    paddingTop: 48,
    paddingBottom: 40,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  appName: {
    fontSize: 34,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 15,
    color: "rgba(255,255,255,0.65)",
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  orgName: {
    fontSize: 18,
    fontWeight: "700",
    color: "rgba(255,255,255,0.8)",
    fontFamily: "Inter_700Bold",
    marginTop: 8,
    letterSpacing: 0.3,
  },
  chooseContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingTop: 32,
  },
  chooseTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.text,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 20,
    textAlign: "center",
  },
  choiceCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
    gap: 14,
  },
  choiceIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  choiceText: {
    flex: 1,
  },
  choiceTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: Colors.text,
    fontFamily: "Inter_600SemiBold",
  },
  choiceSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  formContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingTop: 28,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 24,
    alignSelf: "flex-start",
  },
  backText: {
    fontSize: 16,
    color: Colors.primary,
    fontFamily: "Inter_500Medium",
  },
  formTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.text,
    fontFamily: "Inter_700Bold",
    marginBottom: 6,
  },
  formSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  inputIcon: {
    marginRight: 2,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    fontFamily: "Inter_400Regular",
  },
  errorText: {
    color: Colors.accent,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 12,
    textAlign: "center",
  },
  loginBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 24,
  },
  loginBtnDisabled: {
    opacity: 0.5,
  },
  loginBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  forgotBtn: {
    alignItems: "center",
    paddingVertical: 14,
  },
  forgotText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textDecorationLine: "underline",
  },
});
