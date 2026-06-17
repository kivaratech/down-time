import { boolean, check, index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

// organizationId is nullable so super_admin accounts (which operate across
// all orgs) can have no organization. The supervisors_org_required CHECK
// below enforces that every non-super_admin row HAS an organization.
//
// Authentication is by email + password. Email is GLOBALLY unique (one
// person, one account) — not per-org. This matches the way email works in
// the real world and avoids the username-collision ambiguity the per-org
// username scheme had (two orgs each having "admin" → the login flow
// couldn't disambiguate).
//
// The `username` column was removed when login moved to email; the per-org
// + super-admin partial unique indexes that backed it were dropped at the
// same time.
export const supervisorsTable = pgTable(
  "supervisors",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").references(() => organizationsTable.id),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull().default("supervisor"),
    // Which issue category this person handles: "equipment", "technology",
    // or "both". Default "both" preserves prior behavior (gets everything).
    // Drives (a) who is pushed a notification on a new issue and (b) what
    // category the supervisor's issue list defaults to. Admins ignore this —
    // they always receive all notifications.
    specialty: text("specialty").notNull().default("both"),
    isActive: boolean("is_active").notNull().default(true),
    // Legacy: single push-token column from before per-device tokens
    // (commit 526d2d7). Kept as vestigial — every code path reads from
    // supervisor_devices now. Drop in a separate cleanup PR when
    // confident nothing else references it.
    expoPushToken: text("expo_push_token"),
    passwordResetToken: text("password_reset_token"),
    passwordResetExpiresAt: timestamp("password_reset_expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("supervisors_organization_id_idx").on(table.organizationId),
    uniqueIndex("supervisors_email_unique").on(table.email),
    check(
      "supervisors_org_required",
      sql`${table.role} = 'super_admin' OR ${table.organizationId} IS NOT NULL`,
    ),
    check(
      "supervisors_specialty_valid",
      sql`${table.specialty} IN ('equipment', 'technology', 'both')`,
    ),
  ],
);

export const insertSupervisorSchema = createInsertSchema(supervisorsTable).omit({ id: true, createdAt: true });
export type InsertSupervisor = z.infer<typeof insertSupervisorSchema>;
export type Supervisor = typeof supervisorsTable.$inferSelect;
