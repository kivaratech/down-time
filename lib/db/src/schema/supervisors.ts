import { boolean, index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

// organizationId is nullable: super_admin accounts have no organization (they
// operate across all orgs). Phase 2 will add a CHECK enforcing that every
// non-super_admin row has an organization, once the write paths set it.
export const supervisorsTable = pgTable(
  "supervisors",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").references(() => organizationsTable.id),
    username: text("username").notNull().unique(),
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
  (table) => [index("supervisors_organization_id_idx").on(table.organizationId)],
);

export const insertSupervisorSchema = createInsertSchema(supervisorsTable).omit({ id: true, createdAt: true });
export type InsertSupervisor = z.infer<typeof insertSupervisorSchema>;
export type Supervisor = typeof supervisorsTable.$inferSelect;
