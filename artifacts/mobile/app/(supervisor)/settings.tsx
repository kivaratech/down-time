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
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";

type EquipmentItemRow = {
  id: number;
  area: string;
  name: string;
  subItems: string[];
  supportsCustomLabel: boolean;
  sortOrder: number;
};

type Area = "Front Counter" | "Grill" | "Back of House" | "Technology";
const AREAS: Area[] = ["Front Counter", "Grill", "Back of House", "Technology"];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<EquipmentItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArea, setSelectedArea] = useState<Area>("Front Counter");
  const [editingItem, setEditingItem] = useState<EquipmentItemRow | null>(null);
  const [editName, setEditName] = useState("");
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [saving, setSaving] = useState(false);

  const topPadding = Platform.OS === "web" ? insets.top + 67 : insets.top;

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await customFetch<EquipmentItemRow[]>("/api/equipment/items");
      setItems(data);
    } catch {
      Alert.alert("Error", "Failed to load equipment list.");
    } finally {
      setLoading(false);
    }
  }, []);

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

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Equipment Settings</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setAddModalVisible(true)}>
          <Feather name="plus" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

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
              <Text style={styles.emptySubText}>Tap + to add one.</Text>
            </View>
          }
        />
      )}

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
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setEditingItem(null)}
              >
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
  addBtn: {
    backgroundColor: Colors.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
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
});
