import { Feather } from "@expo/vector-icons";
import {
  useCreateIssue,
  useGetEquipment,
  getListRestaurantIssuesQueryKey,
  getGetEquipmentQueryKey,
} from "@workspace/api-client-react";
import type { EquipmentArea, EquipmentItem } from "@workspace/api-client-react";
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
import { useQueryClient } from "@tanstack/react-query";

import PhotoField from "@/components/PhotoField";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { stripObjectPlaceholders } from "@/lib/cleanText";
import { compressPhotoForUpload } from "@/lib/photoUtils";

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

const AREAS = ["Front Counter", "Grill", "Back of House", "Technology"] as const;
type Area = (typeof AREAS)[number];

type FeatherIconName = React.ComponentProps<typeof Feather>["name"];

const AREA_ICONS: Record<Area, FeatherIconName> = {
  "Front Counter": "coffee",
  "Grill": "zap",
  "Back of House": "package",
  "Technology": "monitor",
};

type Step = "area" | "equipment" | "subitem" | "description" | "submitting" | "done";

export default function ReportIssueScreen() {
  const insets = useSafeAreaInsets();
  const { restaurant, token } = useAuth();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("area");
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentItem | null>(null);
  const [selectedSubItem, setSelectedSubItem] = useState<string | null>(null);
  // Paired tablets are shared, so the person reporting types their name.
  const [reporterName, setReporterName] = useState("");
  const descriptionRef = useRef<TextInput>(null);
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoOriginalWidth, setPhotoOriginalWidth] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const createIssueMutation = useCreateIssue({
    mutation: {
      onSuccess: async () => {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (restaurant) {
          queryClient.invalidateQueries({ queryKey: getListRestaurantIssuesQueryKey(restaurant.id) });
        }
        setSubmitted(true);
      },
      onError: async () => {
        setError("Failed to submit. Please try again.");
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      },
    },
  });

  const { data: equipmentData } = useGetEquipment(
    selectedArea ? { area: selectedArea } : undefined,
    {
      query: {
        enabled: !!selectedArea,
        queryKey: getGetEquipmentQueryKey(selectedArea ? { area: selectedArea } : undefined),
      },
    }
  );

  // What actually gets sent: the typed/dictated text minus the invisible
  // placeholders iOS dictation leaves behind (Android shows them as "OBJ").
  // The input keeps the raw text — rewriting it mid-dictation cuts dictation off.
  const cleanDescription = stripObjectPlaceholders(description).trim();

  const currentArea = equipmentData?.areas?.find((a) => a.area === selectedArea);
  const equipmentItems = currentArea?.items ?? [];
  const subItems = selectedEquipment?.subItems ?? [];

  const topPadding = Platform.OS === "web"
    ? insets.top + 67
    : insets.top;

  function getStepLabel(): string {
    switch (step) {
      case "area": return "Select Area";
      case "equipment": return "Select Equipment";
      case "subitem": return "Select Item";
      case "description": return "Describe the Issue";
      default: return "";
    }
  }

  function getStepNumber(): number {
    switch (step) {
      case "area": return 1;
      case "equipment": return 2;
      case "subitem": return 3;
      case "description": return subItems.length > 0 ? 4 : 3;
      default: return 0;
    }
  }

  function getTotalSteps(): number {
    return subItems.length > 0 ? 4 : 3;
  }

  function handleBack() {
    if (step === "area") {
      router.back();
    } else if (step === "equipment") {
      setSelectedArea(null);
      setStep("area");
    } else if (step === "subitem") {
      setSelectedEquipment(null);
      setStep("equipment");
    } else if (step === "description") {
      if (subItems.length > 0) {
        setSelectedSubItem(null);
        setStep("subitem");
      } else {
        setSelectedEquipment(null);
        setStep("equipment");
      }
    }
  }

  async function handleAreaSelect(area: Area) {
    await Haptics.selectionAsync();
    setSelectedArea(area);
    setSelectedEquipment(null);
    setSelectedSubItem(null);
    setStep("equipment");
  }

  async function handleEquipmentSelect(item: EquipmentItem) {
    await Haptics.selectionAsync();
    setSelectedEquipment(item);
    setSelectedSubItem(null);
    if (item.subItems && item.subItems.length > 0) {
      setStep("subitem");
    } else {
      setStep("description");
    }
  }

  async function handleSubItemSelect(sub: string) {
    await Haptics.selectionAsync();
    setSelectedSubItem(sub);
    setStep("description");
  }

  async function handleSubmit() {
    if (!reporterName.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!cleanDescription) {
      setError("Please add a brief description.");
      return;
    }
    setError("");

    let imageObjectPath: string | undefined;

    if (photoUri) {
      setIsUploading(true);
      try {
        const compressed = await compressPhotoForUpload(photoUri, photoOriginalWidth);
        const fileResponse = await fetch(compressed.uri);
        const blob = await fileResponse.blob();
        console.log(`[photo] compressed ${compressed.width}x${compressed.height}, uploading ${Math.round(blob.size / 1024)}KB`);
        const uploadResponse = await fetch(`${API_BASE}/api/storage/uploads/photo`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "image/jpeg",
          },
          body: blob,
        });
        if (!uploadResponse.ok) {
          throw new Error(`Server upload failed: ${uploadResponse.status}`);
        }
        const uploadData = await uploadResponse.json() as { objectPath: string };
        imageObjectPath = uploadData.objectPath;
      } catch (e) {
        setIsUploading(false);
        setError("Photo upload failed. Submit without the photo, or try again.");
        return;
      } finally {
        setIsUploading(false);
      }
    }

    createIssueMutation.mutate({
      data: {
        restaurantId: restaurant!.id,
        area: selectedArea!,
        equipmentType: selectedEquipment!.name,
        subItem: selectedSubItem ?? undefined,
        description: cleanDescription,
        assignedTo: assignedTo.trim() || undefined,
        reportedBy: reporterName.trim(),
        imageUrl: imageObjectPath,
      },
    });
  }

  if (submitted) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Feather name="check-circle" size={56} color={Colors.success} />
          </View>
          <Text style={styles.successTitle}>Issue Reported</Text>
          <Text style={styles.successSubtitle}>
            {selectedEquipment?.name}
            {selectedSubItem ? ` · ${selectedSubItem}` : ""}
            {"\n"}has been logged successfully.
          </Text>
          <View style={styles.successActions}>
            <TouchableOpacity
              style={styles.reportAnotherBtn}
              onPress={() => {
                setStep("area");
                setSelectedArea(null);
                setSelectedEquipment(null);
                setSelectedSubItem(null);
                // reporterName is kept on purpose: "Report Another" is almost
                // always the same person, and the field stays editable.
                setDescription("");
                setAssignedTo("");
                setPhotoUri(null);
                setPhotoOriginalWidth(0);
                setSubmitted(false);
              }}
              activeOpacity={0.8}
            >
              <Feather name="plus" size={18} color={Colors.primary} />
              <Text style={styles.reportAnotherText}>Report Another</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  const isBusy = isUploading || createIssueMutation.isPending;
  const canSubmit = !!reporterName.trim() && !!cleanDescription && !isBusy;

  return (
    <KeyboardAvoidingView
      style={[styles.container]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding + 12 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{getStepLabel()}</Text>
            <Text style={styles.headerStep}>
              Step {getStepNumber()} of {getTotalSteps()}
            </Text>
          </View>
          <View style={{ width: 38 }} />
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(getStepNumber() / getTotalSteps()) * 100}%` },
            ]}
          />
        </View>

        {/* Breadcrumb */}
        {selectedArea && (
          <View style={styles.breadcrumb}>
            <Text style={styles.breadcrumbText}>{selectedArea}</Text>
            {selectedEquipment && (
              <>
                <Feather name="chevron-right" size={12} color="rgba(255,255,255,0.5)" />
                <Text style={styles.breadcrumbText}>{selectedEquipment.name}</Text>
              </>
            )}
            {selectedSubItem && (
              <>
                <Feather name="chevron-right" size={12} color="rgba(255,255,255,0.5)" />
                <Text style={styles.breadcrumbText}>{selectedSubItem}</Text>
              </>
            )}
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Area Step */}
        {step === "area" && (
          <View style={styles.optionsGrid}>
            {AREAS.map((area) => (
              <TouchableOpacity
                key={area}
                style={styles.areaCard}
                onPress={() => handleAreaSelect(area)}
                activeOpacity={0.75}
              >
                <View style={styles.areaIcon}>
                  <Feather name={AREA_ICONS[area]} size={30} color={Colors.primary} />
                </View>
                <Text style={styles.areaName}>{area}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Equipment Step */}
        {step === "equipment" && (
          <View style={styles.optionsList}>
            {equipmentItems.map((item) => (
              <TouchableOpacity
                key={item.name}
                style={styles.optionRow}
                onPress={() => handleEquipmentSelect(item)}
                activeOpacity={0.72}
              >
                <Text style={styles.optionText}>{item.name}</Text>
                {item.subItems && item.subItems.length > 0 && (
                  <Text style={styles.optionSubtext}>{item.subItems.length} options</Text>
                )}
                <Feather name="chevron-right" size={18} color={Colors.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Sub-item Step */}
        {step === "subitem" && (
          <View style={styles.optionsList}>
            <TouchableOpacity
              style={[styles.optionRow, styles.optionSkip]}
              onPress={() => { setSelectedSubItem(null); setStep("description"); }}
              activeOpacity={0.72}
            >
              <Text style={[styles.optionText, { color: Colors.textSecondary }]}>
                General / Not Specified
              </Text>
              <Feather name="chevron-right" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
            {subItems.map((sub) => (
              <TouchableOpacity
                key={sub}
                style={styles.optionRow}
                onPress={() => handleSubItemSelect(sub)}
                activeOpacity={0.72}
              >
                <Text style={styles.optionText}>{sub}</Text>
                <Feather name="chevron-right" size={18} color={Colors.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Description Step */}
        {step === "description" && (
          <View style={styles.descriptionStep}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Reporting issue for:</Text>
              <Text style={styles.summaryEquipment}>
                {selectedEquipment?.name}
                {selectedSubItem ? ` · ${selectedSubItem}` : ""}
              </Text>
              <Text style={styles.summaryArea}>{selectedArea}</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Your name *</Text>
              <View style={styles.assignInput}>
                <Feather name="user" size={16} color={Colors.textTertiary} />
                <TextInput
                  style={styles.assignTextInput}
                  value={reporterName}
                  onChangeText={(v) => { setReporterName(v); setError(""); }}
                  placeholder="Who is reporting this?"
                  placeholderTextColor={Colors.textTertiary}
                  maxLength={60}
                  autoCapitalize="words"
                  autoCorrect={false}
                  autoFocus={!reporterName}
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => descriptionRef.current?.focus()}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>What's wrong? *</Text>
              <TextInput
                ref={descriptionRef}
                style={styles.descriptionInput}
                value={description}
                onChangeText={(v) => { setDescription(v); setError(""); }}
                placeholder="Briefly describe the issue..."
                placeholderTextColor={Colors.textTertiary}
                multiline
                numberOfLines={4}
                maxLength={500}
                autoFocus={!!reporterName}
                returnKeyType="default"
              />
              <Text style={styles.charCount}>{description.length}/500</Text>
            </View>

            <PhotoField
              photoUri={photoUri}
              onChange={(photo) => {
                setPhotoUri(photo?.uri ?? null);
                setPhotoOriginalWidth(photo?.width ?? 0);
              }}
            />

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Assign to (optional)</Text>
              <View style={styles.assignInput}>
                <Feather name="user" size={16} color={Colors.textTertiary} />
                <TextInput
                  style={styles.assignTextInput}
                  value={assignedTo}
                  onChangeText={setAssignedTo}
                  placeholder="e.g. Tech Team, John D..."
                  placeholderTextColor={Colors.textTertiary}
                  returnKeyType="done"
                />
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              activeOpacity={0.8}
            >
              {isBusy ? (
                <View style={styles.submitBtnInner}>
                  <ActivityIndicator color="#FFFFFF" />
                  <Text style={styles.submitBtnText}>
                    {isUploading ? "Uploading photo..." : "Submitting..."}
                  </Text>
                </View>
              ) : (
                <>
                  <Feather name="send" size={18} color="#FFFFFF" />
                  <Text style={styles.submitBtnText}>Submit Issue</Text>
                </>
              )}
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
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: "Inter_600SemiBold",
  },
  headerStep: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  progressBar: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 2,
    marginBottom: 12,
  },
  progressFill: {
    height: 3,
    backgroundColor: "#FFFFFF",
    borderRadius: 2,
  },
  breadcrumb: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  breadcrumbText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.65)",
    fontFamily: "Inter_400Regular",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  areaCard: {
    width: "47%",
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
    gap: 14,
    minHeight: 130,
    justifyContent: "center",
  },
  areaIcon: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  areaName: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  optionsList: {
    gap: 2,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 14,
    marginBottom: 2,
    gap: 12,
  },
  optionSkip: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    marginBottom: 8,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    fontFamily: "Inter_500Medium",
  },
  optionSubtext: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontFamily: "Inter_400Regular",
  },
  descriptionStep: {
    gap: 20,
  },
  summaryCard: {
    backgroundColor: Colors.primaryLight + "15",
    borderRadius: 14,
    padding: 18,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryEquipment: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.text,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  summaryArea: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
    fontFamily: "Inter_600SemiBold",
  },
  descriptionInput: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 120,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontFamily: "Inter_400Regular",
    textAlign: "right",
  },
  assignInput: {
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
  assignTextInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    fontFamily: "Inter_400Regular",
  },
  errorText: {
    color: Colors.accent,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.accent,
    borderRadius: 16,
    paddingVertical: 18,
    gap: 10,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  submitBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: Colors.openStatusBg,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.text,
    fontFamily: "Inter_700Bold",
    marginBottom: 12,
  },
  successSubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 40,
  },
  successActions: {
    width: "100%",
    gap: 12,
  },
  reportAnotherBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reportAnotherText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  doneBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
  },
  doneBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
});
