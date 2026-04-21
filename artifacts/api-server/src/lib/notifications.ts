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

async function sendExpoPushNotifications(messages: ExpoPushMessage[]): Promise<void> {
  if (messages.length === 0) return;

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
      logger.error({ status: response.status, body }, "Expo push API error");
      return;
    }

    const result = (await response.json()) as { data: ExpoPushTicket[] };
    for (const ticket of result.data ?? []) {
      if (ticket.status === "error") {
        logger.error({ message: ticket.message, details: ticket.details }, "Push ticket error");
      }
    }
  } catch (err) {
    logger.error({ err }, "Failed to send push notifications");
  }
}

function isValidExpoPushToken(token: string): boolean {
  return token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[");
}

export async function notifySupervisorsOfNewIssue(params: {
  restaurantName: string;
  equipmentType: string;
  subItem?: string | null;
  description: string;
  supervisorTokens: (string | null)[];
}): Promise<void> {
  const { restaurantName, equipmentType, subItem, description, supervisorTokens } = params;

  const validTokens = supervisorTokens.filter(
    (t): t is string => typeof t === "string" && isValidExpoPushToken(t)
  );
  if (validTokens.length === 0) return;

  const equipmentLabel = subItem ? `${equipmentType} · ${subItem}` : equipmentType;
  const shortDesc = description.length > 80 ? description.slice(0, 77) + "…" : description;

  const messages: ExpoPushMessage[] = validTokens.map((token) => ({
    to: token,
    title: "New issue reported",
    body: `${restaurantName} — ${equipmentLabel} — ${shortDesc}`,
    sound: "default",
    data: { type: "new_issue" },
  }));

  await sendExpoPushNotifications(messages);
}
