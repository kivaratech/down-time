import { boolean, check, index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

// organizationId is nullable so super_admin accounts (which operate across all
// orgs) can have no organization. The supervisors_org_required CHECK below
// enforces that every non-super_admin row HAS an organization. Username
// uniqueness is composite (organization_id, username) so two orgs can both
// have an "admin"; a separate partial unique index keeps super_admin
// usernames unique across the null-org slice.
export const supervisorsTable = pgTable(
  "supervisors",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").references(() => organizationsTable.id),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    email: text("email"),
    role: text("role").notNull().default("supervisor"),
    isActive: boolean("is_active").notNull().default(true),
    expoPushToken: text("expo_push_token"),
    passwordResetToken: text("password_reset_token"),
    passwordResetExpiresAt: timestamp("password_reset_expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("supervisors_organization_id_idx").on(table.organizationId),
    uniqueIndex("supervisors_org_username_unique").on(table.organizationId, table.username),
    uniqueIndex("supervisors_superadmin_username_unique")
      .on(table.username)
      .where(sql`${table.organizationId} is null`),
    check(
      "supervisors_org_required",
      sql`${table.role} = 'super_admin' OR ${table.organizationId} IS NOT NULL`,
    ),
  ],
);

export const insertSupervisorSchema = createInsertSchema(supervisorsTable).omit({ id: true, createdAt: true });
export type InsertSupervisor = z.infer<typeof insertSupervisorSchema>;
export type Supervisor = typeof supervisorsTable.$inferSelect;
