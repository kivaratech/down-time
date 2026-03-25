import { Feather } from "@expo/vector-icons";
import { customFetch } from "@workspace/api-client-react";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";

type RestaurantRow = { id: number; name: string; location: string };
type GeneratedCode = { code: string; expiresAt: string; restaurantName: string };
type DeviceSession = { id: number; restaurantId: number; restaurantName: string; createdAt: string };

export default function DevicePairingScreen() {
  const insets = useSafeAreaInsets();
  const [restaurants, setRestaurants] = useState<RestaurantRow[]>([]);
  const [pairingRestaurantId, setPairingRestaurantId] = useState<number | null>(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<GeneratedCode | null>(null);
  const [codeModalVisible, setCodeModalVisible] = useState(false);
  const [deviceSessions, setDeviceSessions] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);

  const topPadding = Platform.OS === "web" ? insets.top + 67 : insets.top;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [restData, sessionsData] = await Promise.all([
        customFetch<RestaurantRow[]>("/api/restaurants"),
        customFetch<DeviceSession[]>("/api/auth/admin/device-sessions"),
      ]);
      setRestaurants(restData);
      setDeviceSessions(sessionsData);
    } catch {
      Alert.alert("Error", "Failed to load pairing data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleGeneratePairingCode = async () => {
    if (!pairingRestaurantId || pairingLoading) return;
    setPairingLoading(true);
    try {
      const result = await customFetch<GeneratedCode>("/api/auth/admin/pairing-code", {
        method: "POST",
        body: JSON.stringify({ restaurantId: pairingRestaurantId }),
      });
      setGeneratedCode(result);
      setCodeModalVisible(true);
    } catch {
      Alert.alert("Error", "Failed to generate pairing code.");
    } finally {
      setPairingLoading(false);
    }
  };

  const handleRevokeSession = (session: DeviceSession) => {
    Alert.alert(
      "Disconnect Device",
      `Remove the tablet paired to ${session.restaurantName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            try {
              await customFetch(`/api/auth/admin/device-sessions/${session.id}`, { method: "DELETE" });
              setDeviceSessions((prev) => prev.filter((s) => s.id !== session.id));
            } catch {
              Alert.alert("Error", "Failed to disconnect device.");
            }
          },
        },
      ]
    );
  };

  const getExpiryMinutes = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.round(diff / 60000));
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Device Pairing</Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Generate Pairing Code Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="key" size={20} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Generate Pairing Code</Text>
            </View>
            <Text style={styles.sectionSubtitle}>Create a code for tablets to pair with a restaurant</Text>

            <Text style={styles.label}>Select Restaurant</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.restaurantScroll}
              contentContainerStyle={styles.restaurantScrollContent}
            >
              {restaurants.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.restaurantChip, pairingRestaurantId === r.id && styles.restaurantChipActive]}
                  onPress={() => setPairingRestaurantId(r.id)}
                >
                  <Text
                    style={[styles.restaurantChipText, pairingRestaurantId === r.id && styles.restaurantChipTextActive]}
                    numberOfLines={1}
                  >
                    {r.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.generateBtn, (!pairingRestaurantId || pairingLoading) && styles.generateBtnDisabled]}
              onPress={handleGeneratePairingCode}
              disabled={!pairingRestaurantId || pairingLoading}
            >
              {pairingLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Feather name="key" size={15} color="#FFFFFF" />
                  <Text style={styles.generateBtnText}>Generate Code</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Paired Devices Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="tablet" size={20} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Paired Devices</Text>
            </View>
            <Text style={styles.sectionSubtitle}>
              {deviceSessions.length === 0 ? "No tablets paired" : `${deviceSessions.length} tablet${deviceSessions.length !== 1 ? "s" : ""} connected`}
            </Text>

            {deviceSessions.length > 0 && (
              <View style={styles.devicesList}>
                {deviceSessions.map((session) => (
                  <View key={session.id} style={styles.deviceItem}>
                    <View style={styles.deviceItemContent}>
                      <View style={styles.deviceIconBg}>
                        <Feather name="tablet" size={18} color={Colors.primary} />
                      </View>
                      <View style={styles.deviceItemText}>
                        <Text style={styles.deviceItemName}>{session.restaurantName}</Text>
                        <Text style={styles.deviceItemDate}>
                          Paired {new Date(session.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.deviceDeleteBtn}
                      onPress={() => handleRevokeSession(session)}
                    >
                      <Feather name="x-circle" size={20} color={Colors.accent} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Pairing code modal */}
      <Modal
        visible={codeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCodeModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setCodeModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.codeModalHeader}>
              <Feather name="check-circle" size={28} color={Colors.success} />
              <Text style={styles.codeModalTitle}>Pairing Code Ready</Text>
            </View>
            {generatedCode && (
              <>
                <Text style={styles.codeModalRestaurant}>{generatedCode.restaurantName}</Text>
                <View style={styles.codeDisplay}>
                  <Text style={styles.codeText}>{generatedCode.code}</Text>
                </View>
                <Text style={styles.codeExpiry}>
                  Expires in ~{getExpiryMinutes(generatedCode.expiresAt)} minutes · One-time use
                </Text>
              </>
            )}
            <TouchableOpacity
              style={styles.modalSave}
              onPress={() => {
                setCodeModalVisible(false);
                setGeneratedCode(null);
                setPairingRestaurantId(null);
              }}
            >
              <Text style={styles.modalSaveText}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
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
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 24,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginBottom: 8,
  },
  restaurantScroll: {
    marginBottom: 12,
  },
  restaurantScrollContent: {
    gap: 8,
  },
  restaurantChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  restaurantChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  restaurantChipText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  restaurantChipTextActive: {
    color: "#FFFFFF",
  },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
  },
  generateBtnDisabled: {
    opacity: 0.45,
  },
  generateBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  devicesList: {
    gap: 8,
  },
  deviceItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: Colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  deviceItemContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  deviceIconBg: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.primary + "15",
    justifyContent: "center",
    alignItems: "center",
  },
  deviceItemText: {
    flex: 1,
  },
  deviceItemName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginBottom: 2,
  },
  deviceItemDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
  deviceDeleteBtn: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    maxWidth: 400,
    width: "90%",
  },
  codeModalHeader: {
    alignItems: "center",
    marginBottom: 16,
  },
  codeModalTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginTop: 12,
  },
  codeModalRestaurant: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    textAlign: "center",
    marginBottom: 14,
  },
  codeDisplay: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  codeText: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
    textAlign: "center",
    letterSpacing: 2,
  },
  codeExpiry: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    textAlign: "center",
    marginBottom: 20,
  },
  modalSave: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalSaveText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
});
