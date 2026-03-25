import { Feather } from "@expo/vector-icons";
import type { Issue } from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

function getAgeLabel(createdAt: string): string {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "1 day old";
  return `${diffDays} days old`;
}

function getStatusStyle(status: string) {
  switch (status) {
    case "open":
      return { bg: Colors.openStatusBg, text: Colors.openStatus, label: "Open" };
    case "in_progress":
      return { bg: Colors.inProgressStatusBg, text: Colors.inProgressStatus, label: "In Progress" };
    case "waiting":
      return { bg: Colors.waitingStatusBg, text: Colors.waitingStatus, label: "Waiting" };
    case "resolved":
      return { bg: Colors.resolvedStatusBg, text: Colors.resolvedStatus, label: "Resolved" };
    default:
      return { bg: Colors.resolvedStatusBg, text: Colors.resolvedStatus, label: status };
  }
}

function getPriorityStyle(priority: string | null | undefined) {
  if (!priority) return null;
  switch (priority) {
    case "urgent":
      return { bg: Colors.urgentBg, text: Colors.urgent, label: "Urgent" };
    case "high":
      return { bg: Colors.highBg, text: Colors.high, label: "High" };
    case "normal":
      return { bg: Colors.normalBg, text: Colors.normal, label: "Normal" };
    default:
      return null;
  }
}

type Props = {
  issue: Issue;
  showRestaurant?: boolean;
};

export default function IssueCard({ issue, showRestaurant }: Props) {
  const statusStyle = getStatusStyle(issue.status);
  const priorityStyle = getPriorityStyle(issue.priority);
  const isUrgent = issue.priority === "urgent";

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        isUrgent && styles.urgentCard,
        pressed && styles.cardPressed,
      ]}
      onPress={async () => {
        await Haptics.selectionAsync();
        router.push({ pathname: "/issue/[id]", params: { id: issue.id } });
      }}
    >
      {isUrgent && <View style={styles.urgentStripe} />}

      <View style={styles.cardHeader}>
        <View style={styles.titleRow}>
          <Text style={styles.equipmentName} numberOfLines={1}>
            {issue.equipmentType}
            {issue.subItem ? ` · ${issue.subItem}` : ""}
          </Text>
          {priorityStyle && (
            <View style={[styles.badge, { backgroundColor: priorityStyle.bg }]}>
              <Text style={[styles.badgeText, { color: priorityStyle.text }]}>
                {priorityStyle.label}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.metaRow}>
          <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.badgeText, { color: statusStyle.text }]}>
              {statusStyle.label}
            </Text>
          </View>
          <Text style={styles.area}>{issue.area}</Text>
          {showRestaurant && issue.restaurantName && (
            <>
              <Text style={styles.dot}>·</Text>
              <Text style={styles.area}>{issue.restaurantName}</Text>
            </>
          )}
        </View>
      </View>

      <Text style={styles.description} numberOfLines={2}>
        {issue.description}
      </Text>

      {issue.imageUrl && (
        <Image
          source={{ uri: `${API_BASE}/api/storage/objects/${issue.imageUrl}` }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
      )}

      <View style={styles.cardFooter}>
        <Text style={styles.age}>{getAgeLabel(issue.createdAt)}</Text>
        <View style={styles.footerRight}>
          {issue.assignedTo && (
            <View style={styles.assignedRow}>
              <Feather name="user" size={12} color={Colors.textTertiary} />
              <Text style={styles.assignedText}>{issue.assignedTo}</Text>
            </View>
          )}
          {(issue.commentCount ?? 0) > 0 && (
            <View style={styles.commentRow}>
              <Feather name="message-circle" size={12} color={Colors.textTertiary} />
              <Text style={styles.commentCount}>{issue.commentCount}</Text>
            </View>
          )}
          <Feather name="chevron-right" size={16} color={Colors.textTertiary} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    overflow: "hidden",
  },
  urgentCard: {
    borderWidth: 1,
    borderColor: Colors.urgent + "30",
  },
  urgentStripe: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: Colors.urgent,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  cardPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  cardHeader: {
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    gap: 8,
  },
  equipmentName: {
    fontSize: 17,
    fontWeight: "600",
    color: Colors.text,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  area: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  dot: {
    color: Colors.textTertiary,
    fontSize: 13,
  },
  description: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    marginBottom: 8,
  },
  thumbnail: {
    width: "100%",
    height: 160,
    borderRadius: 10,
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  age: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontFamily: "Inter_400Regular",
  },
  footerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  assignedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  assignedText: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontFamily: "Inter_400Regular",
  },
  commentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  commentCount: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontFamily: "Inter_400Regular",
  },
});
