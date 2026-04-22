import {
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { issuesTable } from "./issues";
import { supervisorsTable } from "./supervisors";

export const notificationStatusEnum = pgEnum("notification_status", [
  "pending",
  "sent",
  "failed",
]);

export const notificationAttemptsTable = pgTable(
  "notification_attempts",
  {
    id: serial("id").primaryKey(),
    issueId: integer("issue_id")
      .notNull()
      .references(() => issuesTable.id, { onDelete: "cascade" }),
    supervisorId: integer("supervisor_id").references(
      () => supervisorsTable.id,
      { onDelete: "set null" },
    ),
    pushToken: text("push_token").notNull(),
    status: notificationStatusEnum("status").notNull().default("pending"),
    errorMessage: text("error_message"),
    expoTicketId: text("expo_ticket_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("notification_attempts_issue_id_idx").on(table.issueId),
    index("notification_attempts_created_at_idx").on(table.createdAt),
  ],
);

export const insertNotificationAttemptSchema = createInsertSchema(
  notificationAttemptsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertNotificationAttempt = z.infer<
  typeof insertNotificationAttemptSchema
>;
export type NotificationAttempt =
  typeof notificationAttemptsTable.$inferSelect;
