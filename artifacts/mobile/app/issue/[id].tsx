import { Feather } from "@expo/vector-icons";
import {
  useGetIssue,
  useUpdateIssue,
  useAddComment,
  getGetIssueQueryKey,
  getListIssuesQueryKey,
  getListRestaurantIssuesQueryKey,
  type UpdateIssueRequestStatus,
  type UpdateIssueRequestPriority,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState, useRef } from "react";
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
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

type IssueStatus = UpdateIssueRequestStatus;
type IssuePriority = UpdateIssueRequestPriority;

const STATUS_OPTIONS: { value: IssueStatus; label: string; color: string; bg: string }[] = [
  { value: "open", label: "Open", color: Colors.openStatus, bg: Colors.openStatusBg },
  { value: "in_progress", label: "In Progress", color: Colors.inProgressStatus, bg: Colors.inProgressStatusBg },
  { value: "waiting", label: "Waiting", color: Colors.waitingStatus, bg: Colors.waitingStatusBg },
  { value: "resolved", label: "Resolved", color: Colors.resolvedStatus, bg: Colors.resolvedStatusBg },
];

const PRIORITY_OPTIONS: { value: IssuePriority; label: string; color: string; bg: string }[] = [
  { value: "urgent", label: "Urgent", color: Colors.urgent, bg: Colors.urgentBg },
  { value: "high", label: "High", color: Colors.high, bg: Colors.highBg },
  { value: "normal", label: "Normal", color: Colors.normal, bg: Colors.normalBg },
  { value: null, label: "None", color: Colors.textSecondary, bg: Colors.borderLight },
];

function getTimeLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 2) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString();
}

export default function IssueDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { authType, restaurant, supervisor } = useAuth();
  const queryClient = useQueryClient();
  const isSupervisor = authType === "supervisor";

  const [comment, setComment] = useState("");
  const [addingComment, setAddingComment] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [localStatus, setLocalStatus] = useState<IssueStatus | null>(null);
  const [localPriority, setLocalPriority] = useState<IssuePriority | undefined>(undefined);
  const [assignedToInput, setAssignedToInput] = useState<string | null>(null);
  const [editingAssignment, setEditingAssignment] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const { data: issue, isLoading } = useGetIssue(Number(id), {
    query: { enabled: !!id, queryKey: getGetIssueQueryKey(Number(id)) },
  });

  const statusMutation = useUpdateIssue({
    mutation: {
      onSuccess: (data) => {
        setLocalStatus(data.status as IssueStatus);
        queryClient.invalidateQueries({ queryKey: getGetIssueQueryKey(Number(id)) });
        queryClient.invalidateQueries({ queryKey: getListIssuesQueryKey() });
        if (restaurant) {
          queryClient.invalidateQueries({ queryKey: getListRestaurantIssuesQueryKey(restaurant.id) });
        }
        // Auto-navigate to dashboard when issue is marked as resolved
        if (data.status === "resolved") {
          setTimeout(() => {
            router.push(isSupervisor ? "/(supervisor)" : "/(restaurant)");
          }, 400);
        }
      },
    },
  });

  const priorityMutation = useUpdateIssue({
    mutation: {
      onSuccess: (data) => {
        setLocalPriority(data.priority as IssuePriority);
        queryClient.invalidateQueries({ queryKey: getGetIssueQueryKey(Number(id)) });
        queryClient.invalidateQueries({ queryKey: getListIssuesQueryKey() });
      },
    },
  });

  const assignmentMutation = useUpdateIssue({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetIssueQueryKey(Number(id)) });
        queryClient.invalidateQueries({ queryKey: getListIssuesQueryKey() });
        if (restaurant) {
          queryClient.invalidateQueries({ queryKey: getListRestaurantIssuesQueryKey(restaurant.id) });
        }
        setEditingAssignment(false);
        setAssignedToInput(null);
      },
    },
  });

  const commentMutation = useAddComment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetIssueQueryKey(Number(id)) });
        setComment("");
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
      },
    },
  });

  if (isLoading || !issue) {
    return (
      <View style={[styles.loadingContainer]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const currentStatus = localStatus ?? (issue.status as IssueStatus);
  const statusStyle = STATUS_OPTIONS.find((s) => s.value === currentStatus) ?? STATUS_OPTIONS[0];

  const topPadding = Platform.OS === "web"
    ? insets.top + 67
    : insets.top;

  async function handleStatusChange(newStatus: IssueStatus) {
    setLocalStatus(newStatus);
    setShowStatusPicker(false);
    await Haptics.selectionAsync();
    statusMutation.mutate({ id: Number(id), data: { status: newStatus } });
  }

  async function handlePriorityChange(newPriority: IssuePriority) {
    setLocalPriority(newPriority);
    setShowPriorityPicker(false);
    await Haptics.selectionAsync();
    priorityMutation.mutate({ id: Number(id), data: { priority: newPriority } });
  }

  async function handleAddComment() {
    if (!comment.trim() || addingComment) return;
    setAddingComment(true);
    await Haptics.selectionAsync();
    const authorName = isSupervisor
      ? (supervisor?.name ?? "Supervisor")
      : (restaurant?.name ?? "Restaurant Staff");
    commentMutation.mutate({ id: Number(id), data: { authorName, body: comment.trim() } });
    setAddingComment(false);
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding + 12 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Issue #{issue.id}
          </Text>
          <View style={{ width: 38 }} />
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Main Info Card */}
        <View style={styles.mainCard}>
          <View style={styles.equipmentRow}>
            <Text style={styles.equipmentName}>
              {issue.equipmentType}
              {issue.subItem ? ` · ${issue.subItem}` : ""}
            </Text>
          </View>

          <View style={styles.tagsRow}>
            <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.badgeText, { color: statusStyle.color }]}>
                {statusStyle.label}
              </Text>
            </View>
            <View style={styles.areaBadge}>
              <Text style={styles.areaText}>{issue.area}</Text>
            </View>
            {issue.restaurantName && isSupervisor && (
              <View style={styles.areaBadge}>
                <Text style={styles.areaText}>{issue.restaurantName}</Text>
              </View>
            )}
          </View>

          <Text style={styles.description}>{issue.description}</Text>

          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Feather name="clock" size={14} color={Colors.textTertiary} />
              <Text style={styles.metaText}>Reported {getTimeLabel(issue.createdAt)}</Text>
            </View>
            {issue.assignedTo && (
              <View style={styles.metaItem}>
                <Feather name="user" size={14} color={Colors.textTertiary} />
                <Text style={styles.metaText}>{issue.assignedTo}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Actions Card */}
        <View style={styles.actionsCard}>
          <Text style={styles.sectionTitle}>Status</Text>

          <TouchableOpacity
            style={[styles.statusBtn, { borderColor: statusStyle.color + "40", backgroundColor: statusStyle.bg }]}
            onPress={() => setShowStatusPicker(true)}
            activeOpacity={0.75}
          >
            <View style={[styles.statusDot, { backgroundColor: statusStyle.color }]} />
            <Text style={[styles.statusBtnText, { color: statusStyle.color }]}>
              {statusStyle.label}
            </Text>
            <Feather name="chevron-down" size={16} color={statusStyle.color} />
          </TouchableOpacity>

          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Assigned To</Text>
          {editingAssignment ? (
            <View style={styles.assignmentInputRow}>
              <TextInput
                style={styles.assignmentInput}
                value={assignedToInput ?? ""}
                onChangeText={setAssignedToInput}
                placeholder="Team or person name..."
                placeholderTextColor={Colors.textTertiary}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => assignmentMutation.mutate({ id: Number(id), data: { assignedTo: assignedToInput?.trim() || null } })}
              />
              <TouchableOpacity
                style={styles.assignmentSaveBtn}
                onPress={() => assignmentMutation.mutate({ id: Number(id), data: { assignedTo: assignedToInput?.trim() || null } })}
                disabled={assignmentMutation.isPending}
              >
                {assignmentMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Feather name="check" size={16} color="#fff" />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.assignmentCancelBtn}
                onPress={() => { setEditingAssignment(false); setAssignedToInput(null); }}
              >
                <Feather name="x" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.assignmentDisplayBtn}
              onPress={() => {
                setAssignedToInput(issue.assignedTo ?? "");
                setEditingAssignment(true);
              }}
              activeOpacity={0.75}
            >
              <Feather name="user" size={16} color={issue.assignedTo ? Colors.primary : Colors.textTertiary} />
              <Text style={[styles.assignmentDisplayText, !issue.assignedTo && styles.assignmentPlaceholder]}>
                {issue.assignedTo ?? "Unassigned — tap to assign"}
              </Text>
              <Feather name="edit-2" size={14} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}

          {isSupervisor && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Priority</Text>
              {(() => {
                const prio = localPriority !== undefined ? localPriority : (issue.priority as IssuePriority);
                const prioStyle = PRIORITY_OPTIONS.find((p) => p.value === prio) ?? PRIORITY_OPTIONS[3];
                return (
                  <TouchableOpacity
                    style={[styles.statusBtn, { borderColor: prioStyle.color + "40", backgroundColor: prioStyle.bg }]}
                    onPress={() => setShowPriorityPicker(true)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.statusDot, { backgroundColor: prioStyle.color }]} />
                    <Text style={[styles.statusBtnText, { color: prioStyle.color }]}>
                      {prioStyle.label}
                    </Text>
                    <Feather name="chevron-down" size={16} color={prioStyle.color} />
                  </TouchableOpacity>
                );
              })()}
            </>
          )}
        </View>

        {/* Comments */}
        <View style={styles.commentsCard}>
          <Text style={styles.sectionTitle}>
            Activity
            {issue.comments && issue.comments.length > 0 && (
              <Text style={styles.commentCount}> ({issue.comments.length})</Text>
            )}
          </Text>

          {(!issue.comments || issue.comments.length === 0) && (
            <Text style={styles.noComments}>No comments yet.</Text>
          )}

          {issue.comments?.map((c) => (
            <View key={c.id} style={styles.commentItem}>
              <View style={styles.commentAvatar}>
                <Text style={styles.commentAvatarText}>
                  {(c.authorName ?? "?").charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.commentBody}>
                <View style={styles.commentHeader}>
                  <Text style={styles.commentAuthor}>{c.authorName ?? "Anonymous"}</Text>
                  <Text style={styles.commentTime}>{getTimeLabel(c.createdAt)}</Text>
                </View>
                <Text style={styles.commentText}>{c.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Comment Input */}
      <View style={[styles.commentInputBar, { paddingBottom: insets.bottom + 12 + (Platform.OS === "web" ? 84 : 0) }]}>
        <TextInput
          style={styles.commentInput}
          value={comment}
          onChangeText={setComment}
          placeholder="Add a comment..."
          placeholderTextColor={Colors.textTertiary}
          returnKeyType="send"
          onSubmitEditing={handleAddComment}
          multiline={false}
        />
        <TouchableOpacity
          style={[styles.commentSendBtn, (!comment.trim() || addingComment) && styles.commentSendBtnDisabled]}
          onPress={handleAddComment}
          disabled={!comment.trim() || addingComment}
        >
          {addingComment ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Feather name="send" size={18} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>

      {/* Status Picker Modal */}
      <Modal
        visible={showStatusPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStatusPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowStatusPicker(false)}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Update Status</Text>
            {STATUS_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.modalOption,
                  currentStatus === opt.value && styles.modalOptionSelected,
                ]}
                onPress={() => handleStatusChange(opt.value)}
              >
                <View style={[styles.statusDot, { backgroundColor: opt.color }]} />
                <Text style={[styles.modalOptionText, { color: opt.color }]}>{opt.label}</Text>
                {currentStatus === opt.value && (
                  <Feather name="check" size={18} color={opt.color} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Priority Picker Modal */}
      <Modal
        visible={showPriorityPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPriorityPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowPriorityPicker(false)}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Set Priority</Text>
            {PRIORITY_OPTIONS.map((opt) => {
              const currentPrio = localPriority !== undefined ? localPriority : (issue.priority as IssuePriority);
              return (
                <TouchableOpacity
                  key={String(opt.value)}
                  style={[
                    styles.modalOption,
                    currentPrio === opt.value && styles.modalOptionSelected,
                  ]}
                  onPress={() => handlePriorityChange(opt.value)}
                >
                  <View style={[styles.statusDot, { backgroundColor: opt.color }]} />
                  <Text style={[styles.modalOptionText, { color: opt.color }]}>{opt.label}</Text>
                  {currentPrio === opt.value && (
                    <Feather name="check" size={18} color={opt.color} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  mainCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  equipmentRow: {
    marginBottom: 10,
  },
  equipmentName: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.text,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  areaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.borderLight,
  },
  areaText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontFamily: "Inter_500Medium",
  },
  description: {
    fontSize: 16,
    color: Colors.text,
    fontFamily: "Inter_400Regular",
    lineHeight: 24,
    marginBottom: 16,
  },
  metaGrid: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 14,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  actionsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  statusBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    gap: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusBtnText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  commentsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  commentCount: {
    color: Colors.textTertiary,
    fontWeight: "400",
  },
  noComments: {
    fontSize: 14,
    color: Colors.textTertiary,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingVertical: 16,
  },
  commentItem: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 18,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary + "15",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  commentAvatarText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
    fontFamily: "Inter_600SemiBold",
  },
  commentBody: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
    fontFamily: "Inter_600SemiBold",
  },
  commentTime: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontFamily: "Inter_400Regular",
  },
  commentText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  commentInputBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 10,
  },
  commentInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
    borderColor: Colors.border,
    maxHeight: 80,
  },
  commentSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  commentSendBtnDisabled: {
    opacity: 0.4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
    fontFamily: "Inter_700Bold",
    marginBottom: 16,
    textAlign: "center",
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 4,
  },
  modalOptionSelected: {
    backgroundColor: Colors.background,
  },
  modalOptionText: {
    flex: 1,
    fontSize: 17,
    fontWeight: "500",
    fontFamily: "Inter_500Medium",
  },
  assignmentDisplayBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    gap: 10,
  },
  assignmentDisplayText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  assignmentPlaceholder: {
    color: Colors.textTertiary,
    fontFamily: "Inter_400Regular",
  },
  assignmentInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  assignmentInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: Colors.text,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
    borderColor: Colors.primary + "60",
  },
  assignmentSaveBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  assignmentCancelBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.borderLight,
    justifyContent: "center",
    alignItems: "center",
  },
});
