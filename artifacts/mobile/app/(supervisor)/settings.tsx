import { Feather } from "@expo/vector-icons";
import { customFetch } from "@workspace/api-client-react";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
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

type EquipmentItemRow = {
  id: number;
  area: string;
  name: string;
  subItems: string[];
  supportsCustomLabel: boolean;
  sortOrder: number;
};

type RestaurantRow = { id: number; name: string; location: string };
type GeneratedCode = { code: string; expiresAt: string; restaurantName: string };

type Area = "Front Counter" | "Grill" | "Back of House" | "Technology";
const AREAS: Area[] = ["Front Counter", "Grill", "Back of House", "Technology"];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { supervisor, logout } = useAuth();
  const isAdmin = supervisor?.role === "admin";
  const [loggingOut, setLoggingOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const [items, setItems] = useState<EquipmentItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArea, setSelectedArea] = useState<Area>("Front Counter");
  const [editingItem, setEditingItem] = useState<EquipmentItemRow | null>(null);
  const [editName, setEditName] = useState("");
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [saving, setSaving] = useState(false);

  // Admin — device pairing state
  const [restaurants, setRestaurants] = useState<RestaurantRow[]>([]);
  const [pairingRestaurantId, setPairingRestaurantId] = useState<number | null>(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<GeneratedCode | null>(null);
  const [codeModalVisible, setCodeModalVisible] = useState(false);

  const topPadding = Platform.OS === "web" ? insets.top + 67 : insets.top;

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const [equipData, restData] = await Promise.all([
        customFetch<EquipmentItemRow[]>("/api/equipment/items"),
        isAdmin ? customFetch<RestaurantRow[]>("/api/restaurants") : Promise.resolve([]),
      ]);
      setItems(equipData);
      if (isAdmin) setRestaurants(restData);
    } catch {
      Alert.alert("Error", "Failed to load settings.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [loadItems])
  );

  const areaItems = items
    .filter((i) => i.area === selectedArea)
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleRename = async () => {
    if (!editingItem || !editName.trim()) return;
    setSaving(true);
    try {
      const updated = await customFetch<EquipmentItemRow>(
        `/api/equipment/items/${editingItem.id}`,
        { method: "PATCH", body: JSON.stringify({ name: editName.trim() }) }
      );
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setEditingItem(null);
    } catch {
      Alert.alert("Error", "Failed to rename item.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item: EquipmentItemRow) => {
    Alert.alert(
      "Delete Item",
      `Remove "${item.name}" from ${item.area}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await customFetch(`/api/equipment/items/${item.id}`, { method: "DELETE" });
              setItems((prev) => prev.filter((i) => i.id !== item.id));
            } catch {
              Alert.alert("Error", "Failed to delete item.");
            }
          },
        },
      ]
    );
  };

  const handleAddItem = async () => {
    if (!newItemName.trim()) return;
    setSaving(true);
    try {
      const created = await customFetch<EquipmentItemRow>("/api/equipment/items", {
        method: "POST",
        body: JSON.stringify({ area: selectedArea, name: newItemName.trim() }),
      });
      setItems((prev) => [...prev, created]);
      setNewItemName("");
      setAddModalVisible(false);
    } catch {
      Alert.alert("Error", "Failed to add item.");
    } finally {
      setSaving(false);
    }
  };

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

  const getExpiryMinutes = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.round(diff / 60000));
  };

  const doLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      Alert.alert("Error", "Failed to log out.");
      setLoggingOut(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Settings</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => setShowLogoutConfirm(true)} disabled={loggingOut}>
          <Feather name="log-out" size={20} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Admin-only: Device Pairing */}
      {isAdmin && (
        <View style={styles.pairingSection}>
          <View style={styles.pairingSectionHeader}>
            <Feather name="link" size={16} color={Colors.primary} />
            <Text style={styles.pairingSectionTitle}>Device Pairing</Text>
          </View>
          <Text style={styles.pairingSectionSubtitle}>
            Generate a one-time code to pair a restaurant tablet
          </Text>
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
                <Text style={styles.generateBtnText}>Generate Pairing Code</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.sectionLabel}>Equipment Catalog</Text>

      <View style={styles.areaTabs}>
        {AREAS.map((area) => (
          <TouchableOpacity
            key={area}
            style={[styles.areaTab, selectedArea === area && styles.areaTabActive]}
            onPress={() => setSelectedArea(area)}
          >
            <Text
              style={[styles.areaTabText, selectedArea === area && styles.areaTabTextActive]}
              numberOfLines={2}
            >
              {area}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={areaItems}
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
          renderItem={({ item }) => (
            <View style={styles.itemRow}>
              <Feather name="tool" size={16} color={Colors.textSecondary} style={styles.itemIcon} />
              <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
              <View style={styles.itemActions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => { setEditingItem(item); setEditName(item.name); }}
                >
                  <Feather name="edit-2" size={16} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.deleteBtn]}
                  onPress={() => handleDelete(item)}
                >
                  <Feather name="trash-2" size={16} color={Colors.accent} />
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No items in {selectedArea}.</Text>
            </View>
          }
          ListFooterComponent={
            <TouchableOpacity
              style={styles.addEquipmentFooter}
              onPress={() => setAddModalVisible(true)}
            >
              <Feather name="plus" size={18} color={Colors.surface} />
              <Text style={styles.addEquipmentFooterText}>Add Equipment</Text>
            </TouchableOpacity>
          }
        />
      )}

      {/* Pairing code result modal */}
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
              onPress={() => { setCodeModalVisible(false); setGeneratedCode(null); setPairingRestaurantId(null); }}
            >
              <Text style={styles.modalSaveText}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Rename modal */}
      <Modal
        visible={!!editingItem}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingItem(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setEditingItem(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Rename Item</Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleRename}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setEditingItem(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, (!editName.trim() || saving) && styles.modalSaveDisabled]}
                onPress={handleRename}
                disabled={!editName.trim() || saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add item modal */}
      <Modal
        visible={addModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setAddModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Add Item to {selectedArea}</Text>
            <TextInput
              style={styles.modalInput}
              value={newItemName}
              onChangeText={setNewItemName}
              placeholder="Item name"
              placeholderTextColor={Colors.textTertiary}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleAddItem}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => { setAddModalVisible(false); setNewItemName(""); }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, (!newItemName.trim() || saving) && styles.modalSaveDisabled]}
                onPress={handleAddItem}
                disabled={!newItemName.trim() || saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>Add</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
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
  addEquipmentFooter: {
    backgroundColor: Colors.primary,
    marginHorizontal: 12,
    marginVertical: 16,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addEquipmentFooterText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.surface,
  },
  // Admin device pairing section
  pairingSection: {
    backgroundColor: Colors.surface,
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pairingSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  pairingSectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  pairingSectionSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  restaurantScroll: {
    marginBottom: 12,
  },
  restaurantScrollContent: {
    gap: 8,
    paddingRight: 4,
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
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  areaTabs: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  areaTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: Colors.surface,
  },
  areaTabActive: {
    backgroundColor: Colors.primary,
  },
  areaTabText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  areaTabTextActive: {
    color: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    padding: 12,
    gap: 6,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemIcon: {
    marginRight: 10,
  },
  itemName: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  itemActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtn: {
    backgroundColor: "#FFF0F0",
  },
  empty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  emptySubText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
  // Code display modal styles
  codeModalHeader: {
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  codeModalTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  codeModalRestaurant: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    marginBottom: 16,
  },
  codeDisplay: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  codeText: {
    fontSize: 38,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
    letterSpacing: 10,
  },
  codeExpiry: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    textAlign: "center",
    marginBottom: 16,
  },
  // Shared modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 420,
    gap: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  modalSave: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: "center",
  },
  modalSaveDisabled: {
    opacity: 0.45,
  },
  modalSaveText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
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
