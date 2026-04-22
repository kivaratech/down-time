import { db, notificationAttemptsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  sound?: "default" | null;
  data?: Record<string, unknown>;
};

type ExpoPushTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

export type NotificationRecipient = {
  supervisorId: number;
  token: string;
};

function isValidExpoPushToken(token: string): boolean {
  return token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[");
}

async function markAttemptFailed(attemptId: number, errorMessage: string) {
  try {
    await db
      .update(notificationAttemptsTable)
      .set({ status: "failed", errorMessage, updatedAt: new Date() })
      .where(eq(notificationAttemptsTable.id, attemptId));
  } catch (err) {
    logger.error({ err, attemptId }, "Failed to mark notification attempt failed");
  }
}

async function markAttemptSent(attemptId: number, ticketId: string | undefined) {
  try {
    await db
      .update(notificationAttemptsTable)
      .set({
        status: "sent",
        expoTicketId: ticketId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(notificationAttemptsTable.id, attemptId));
  } catch (err) {
    logger.error({ err, attemptId }, "Failed to mark notification attempt sent");
  }
}

export async function notifySupervisorsOfNewIssue(params: {
  issueId: number;
  restaurantName: string;
  equipmentType: string;
  subItem?: string | null;
  description: string;
  recipients: NotificationRecipient[];
}): Promise<void> {
  const {
    issueId,
    restaurantName,
    equipmentType,
    subItem,
    description,
    recipients,
  } = params;

  const validRecipients = recipients.filter((r) => isValidExpoPushToken(r.token));
  if (validRecipients.length === 0) return;

  // 1. Insert a pending attempt row for each recipient so we have a record even
  //    if the Expo call fails. Returning IDs lets us correlate tickets later.
  let attempts: { id: number; supervisorId: number | null; pushToken: string }[] = [];
  try {
    attempts = await db
      .insert(notificationAttemptsTable)
      .values(
        validRecipients.map((r) => ({
          issueId,
          supervisorId: r.supervisorId,
          pushToken: r.token,
          status: "pending" as const,
        })),
      )
      .returning({
        id: notificationAttemptsTable.id,
        supervisorId: notificationAttemptsTable.supervisorId,
        pushToken: notificationAttemptsTable.pushToken,
      });
  } catch (err) {
    logger.error({ err, issueId }, "Failed to write notification attempt rows");
    // Continue with send — better to deliver without a log than to skip.
  }

  const equipmentLabel = subItem ? `${equipmentType} · ${subItem}` : equipmentType;
  const shortDesc = description.length > 80 ? description.slice(0, 77) + "…" : description;

  const messages: ExpoPushMessage[] = validRecipients.map((r) => ({
    to: r.token,
    title: "New issue reported",
    body: `${restaurantName} — ${equipmentLabel} — ${shortDesc}`,
    sound: "default",
    data: { type: "new_issue", issueId },
  }));

  let tickets: ExpoPushTicket[] | null = null;
  let transportError: string | null = null;
  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const body = await response.text();
      transportError = `Expo ${response.status}: ${body.slice(0, 500)}`;
      logger.error({ status: response.status, body }, "Expo push API error");
    } else {
      const result = (await response.json()) as { data: ExpoPushTicket[] };
      tickets = result.data ?? [];
    }
  } catch (err) {
    transportError = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Failed to reach Expo push API");
  }

  // 2. Update attempt rows with the outcome. Expo returns tickets in the same
  //    order as the request array, so we can match by index.
  await Promise.all(
    validRecipients.map((_, i) => {
      const attempt = attempts[i];
      if (!attempt) return Promise.resolve();

      if (transportError) {
        return markAttemptFailed(attempt.id, transportError);
      }
      const ticket = tickets?.[i];
      if (!ticket) {
        return markAttemptFailed(attempt.id, "No ticket returned from Expo");
      }
      if (ticket.status === "error") {
        const msg = ticket.details?.error
          ? `${ticket.details.error}: ${ticket.message ?? ""}`.trim()
          : ticket.message ?? "unknown error";
        return markAttemptFailed(attempt.id, msg);
      }
      return markAttemptSent(attempt.id, ticket.id);
    }),
  );
}
