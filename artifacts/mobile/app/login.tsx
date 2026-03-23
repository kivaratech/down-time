import { Feather, Ionicons } from "@expo/vector-icons";
import { restaurantLogin, supervisorLogin } from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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

type Mode = "choose" | "pin" | "supervisor";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { loginRestaurant, loginSupervisor } = useAuth();
  const [mode, setMode] = useState<Mode>("choose");
  const [pin, setPin] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handlePinLogin = async () => {
    if (!pin || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await restaurantLogin({ pin });
      await loginRestaurant(res.token, res.restaurant);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(restaurant)");
    } catch (e: any) {
      setError("Invalid PIN. Please try again.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleSupervisorLogin = async () => {
    if (!username || !password || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await supervisorLogin({ username, password });
      await loginSupervisor(res.token, res.supervisor);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(supervisor)");
    } catch (e: any) {
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
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
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
              onPress={() => {
                setMode("pin");
                setError("");
              }}
              activeOpacity={0.75}
            >
              <View style={[styles.choiceIcon, { backgroundColor: Colors.primaryLight }]}>
                <Feather name="home" size={28} color="#FFFFFF" />
              </View>
              <View style={styles.choiceText}>
                <Text style={styles.choiceTitle}>Restaurant iPad</Text>
                <Text style={styles.choiceSubtitle}>Shared access with restaurant PIN</Text>
              </View>
              <Feather name="chevron-right" size={22} color={Colors.textTertiary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.choiceCard}
              onPress={() => {
                setMode("supervisor");
                setError("");
              }}
              activeOpacity={0.75}
            >
              <View style={[styles.choiceIcon, { backgroundColor: Colors.accent }]}>
                <Feather name="layers" size={28} color="#FFFFFF" />
              </View>
              <View style={styles.choiceText}>
                <Text style={styles.choiceTitle}>Supervisor</Text>
                <Text style={styles.choiceSubtitle}>Individual login with username & password</Text>
              </View>
              <Feather name="chevron-right" size={22} color={Colors.textTertiary} />
            </TouchableOpacity>
          </View>
        )}

        {mode === "pin" && (
          <View style={styles.formContainer}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => { setMode("choose"); setPin(""); setError(""); }}
            >
              <Feather name="arrow-left" size={20} color={Colors.primary} />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>

            <Text style={styles.formTitle}>Enter Restaurant PIN</Text>
            <Text style={styles.formSubtitle}>
              Ask your manager for the restaurant PIN
            </Text>

            <View style={styles.pinContainer}>
              {[0, 1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.pinDot,
                    pin.length > i && styles.pinDotFilled,
                  ]}
                />
              ))}
            </View>

            <TextInput
              style={styles.hiddenInput}
              value={pin}
              onChangeText={(v) => {
                const digits = v.replace(/\D/g, "").slice(0, 4);
                setPin(digits);
                setError("");
              }}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              autoFocus
            />

            <View style={styles.numpad}>
              {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((key) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.numKey, key === "" && styles.numKeyEmpty]}
                  onPress={() => {
                    if (key === "⌫") {
                      setPin((p) => p.slice(0, -1));
                    } else if (key !== "" && pin.length < 4) {
                      const newPin = pin + key;
                      setPin(newPin);
                      if (newPin.length === 4) {
                        setTimeout(() => handlePinLoginWithPin(newPin), 100);
                      }
                    }
                  }}
                  activeOpacity={0.65}
                  disabled={key === ""}
                >
                  {key === "⌫" ? (
                    <Feather name="delete" size={22} color={Colors.text} />
                  ) : (
                    <Text style={styles.numKeyText}>{key}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {loading && (
              <ActivityIndicator color={Colors.primary} style={{ marginTop: 16 }} />
            )}
          </View>
        )}

        {mode === "supervisor" && (
          <View style={styles.formContainer}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => { setMode("choose"); setUsername(""); setPassword(""); setError(""); }}
            >
              <Feather name="arrow-left" size={20} color={Colors.primary} />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>

            <Text style={styles.formTitle}>Supervisor Login</Text>
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
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputWrapper}>
                <Feather name="lock" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                <TextInput
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
              style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
              onPress={handleSupervisorLogin}
              disabled={loading || !username || !password}
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
      </ScrollView>
    </KeyboardAvoidingView>
  );

  async function handlePinLoginWithPin(p: string) {
    setLoading(true);
    setError("");
    try {
      const res = await restaurantLogin({ pin: p });
      await loginRestaurant(res.token, res.restaurant);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(restaurant)");
    } catch (e: any) {
      setPin("");
      setError("Invalid PIN. Please try again.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }
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
  pinContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginBottom: 24,
  },
  pinDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: "transparent",
  },
  pinDotFilled: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    height: 0,
    width: 0,
  },
  numpad: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
    maxWidth: 320,
    alignSelf: "center",
    width: "100%",
  },
  numKey: {
    width: 88,
    height: 72,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  numKeyEmpty: {
    backgroundColor: "transparent",
    shadowOpacity: 0,
    elevation: 0,
  },
  numKeyText: {
    fontSize: 24,
    fontWeight: "500",
    color: Colors.text,
    fontFamily: "Inter_500Medium",
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
    opacity: 0.6,
  },
  loginBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
});
