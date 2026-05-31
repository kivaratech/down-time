import { index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { supervisorsTable } from "./supervisors";

// Per-device push tokens. One supervisor can have many devices (phone +
// tablet, app reinstall produces a new Expo push token, etc.). Replaces the
// single `supervisors.expoPushToken` column which forced last-device-wins
// semantics (a second device's registration silently un-routed the first).
//
// Unique on (supervisorId, expoPushToken) so re-registering the same tuple
// is a no-op — the upsert just bumps `lastSeenAt`.
//
// `onDelete: "cascade"` on the supervisor FK means deactivating/deleting a
// supervisor automatically cleans up their device rows — no need to add this
// table to the app-level org-delete cascade in routes/super-admin.ts (the
// supervisor delete in that cascade fires the FK action). If you ever change
// the supervisors delete to NOT cascade, register this table there.
export const supervisorDevicesTable = pgTable(
  "supervisor_devices",
  {
    id: serial("id").primaryKey(),
    supervisorId: integer("supervisor_id")
      .notNull()
      .references(() => supervisorsTable.id, { onDelete: "cascade" }),
    expoPushToken: text("expo_push_token").notNull(),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("supervisor_devices_supervisor_token_unique").on(
      table.supervisorId,
      table.expoPushToken,
    ),
    index("supervisor_devices_supervisor_idx").on(table.supervisorId),
  ],
);

export const insertSupervisorDeviceSchema = createInsertSchema(supervisorDevicesTable).omit({
  id: true,
  createdAt: true,
  lastSeenAt: true,
});
export type InsertSupervisorDevice = z.infer<typeof insertSupervisorDeviceSchema>;
export type SupervisorDevice = typeof supervisorDevicesTable.$inferSelect;
