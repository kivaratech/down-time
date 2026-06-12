import { Feather } from "@expo/vector-icons";
import { supervisorLogin } from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router, type Href } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { UI_VERSION } from "@/constants/version";
import { useAuth } from "@/context/AuthContext";

type Mode = "choose" | "supervisor";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { loginSupervisor } = useAuth();
  const [mode, setMode] = useState<Mode>("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const passwordRef = useRef<TextInput>(null);

  function reset() {
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setError("");
  }

  const handleSupervisorLogin = async () => {
    if (!email.trim() || !password || loading) return;
    setLoading(true);
    setError("");

    try {
      // Server lowercases on its side too — sending lowercase here keeps the
      // wire payload predictable and avoids any subtle case-sensitivity bugs
      // if the server normalization ever changes.
      const res = await supervisorLogin({ email: email.trim().toLowerCase(), password });
      // Narrow the server-returned role to a value the client knows how to
      // handle. supervisors.role is a plain text column with no DB enum, so
      // a rolled-forward server could return a string this client doesn't
      // recognise. Fail-safe to the lowest-privilege "supervisor" rather
      // than persisting an unknown string that downstream role gates would
      // silently fall open against.
      const rawRole = res.supervisor.role;
      const role: "admin" | "supervisor" | "super_admin" =
        rawRole === "admin" || rawRole === "super_admin" ? rawRole : "supervisor";
      await loginSupervisor(res.token, {
        id: res.supervisor.id,
        email: res.supervisor.email,
        name: res.supervisor.name,
        role,
        organizationId: res.supervisor.organizationId,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Branch on role: the role-based redirect in app/index.tsx only runs
      // when landing at "/", not after a router.replace. Without this branch
      // super_admins would land on /(supervisor) which 403s their queries.
      // Group routes aren't in the typed-routes Href union — cast through.
      const target = role === "super_admin" ? "/(super-admin)" : "/(supervisor)";
      router.replace(target as Href);
    } catch (err) {
      // Surface the server's actual message when there is one. A blanket
      // "Invalid email or password" hides rate-limit lockouts (429) and
      // deactivated accounts (403) — the user retries a correct password
      // forever and burns through the rate limit budget for nothing.
      const serverMessage = (err as { data?: { error?: string } })?.data?.error;
      setError(serverMessage ?? "Invalid email or password.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    // Outermost View owns the blue background and the version footer so the
    // keyboard moving the form doesn't drag the footer up with it. The
    // version stays anchored to the screen bottom and is hidden behind the
    // keyboard when one is open.
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <KeyboardAwareScrollView
        // Replaces the KAV+ScrollView combo with one component that handles
        // focused-input scrolling consistently on iOS AND Android — the
        // built-in KeyboardAvoidingView is famously flaky on Android (none of
        // "height"/"padding"/undefined behaviour reliably scrolls inputs
        // above the keyboard, because the OS's adjustResize and KAV fight
        // each other). This library takes a Keyboard.addListener +
        // measureLayout approach that just works.
        style={styles.kav}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        // extraScrollHeight sits between the focused input and the top of
        // the keyboard. 80 instead of 20 because Android's autofill prompt
        // ("Enable autofill on this password?") renders ~50-70px between
        // the input and the keyboard for fields with secureTextEntry — at
        // 20 the prompt covers the input. 80 leaves a small buffer even
        // with the prompt showing.
        extraScrollHeight={80}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Feather name="tool" size={32} color="#FFFFFF" />
          </View>
          <Text style={styles.appName}>DownTime</Text>
          <Text style={styles.tagline}>Restaurant Issue Tracker</Text>
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
                <Text style={styles.choiceSubtitle}>Individual login with email & password</Text>
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
              <Text style={styles.inputLabel}>Email</Text>
              <View style={styles.inputWrapper}>
                <Feather name="mail" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={email}
                  onChangeText={(v) => { setEmail(v); setError(""); }}
                  placeholder="Enter email"
                  placeholderTextColor={Colors.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  keyboardType="email-address"
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
                  autoComplete="current-password"
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
              style={[styles.loginBtn, (loading || !email.trim() || !password) && styles.loginBtnDisabled]}
              onPress={handleSupervisorLogin}
              disabled={loading || !email.trim() || !password}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.loginBtnText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAwareScrollView>
      {/* Sibling of the scroll view — anchored to the outer View's bottom so
          it doesn't move with the keyboard. pointerEvents="none" so it can't
          intercept taps. */}
      <View
        style={[styles.versionContainer, { paddingBottom: insets.bottom + 8 }]}
        pointerEvents="none"
      >
        <Text style={styles.versionText}>v{UI_VERSION}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  kav: {
    flex: 1,
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
    fontSize: 16,
    color: "rgba(255,255,255,0.75)",
    fontFamily: "Inter_400Regular",
    marginTop: 6,
  },
  chooseContainer: {
    // flexGrow (not flex) so it fills bottom normally but the ScrollView
    // can scroll when the keyboard shrinks the viewport. flex:1 would
    // force-shrink the container, preventing scroll.
    flexGrow: 1,
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
    // flexGrow (not flex) so the inputs can scroll above the keyboard —
    // see chooseContainer note above.
    flexGrow: 1,
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
  versionContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
  },
  versionText: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.3,
  },
});
