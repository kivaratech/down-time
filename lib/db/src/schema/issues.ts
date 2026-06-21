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
import { organizationsTable } from "./organizations";
import { restaurantsTable } from "./restaurants";

export const areaEnum = pgEnum("area", [
  "Front Counter",
  "Grill",
  "Back of House",
  "Technology",
]);

export const categoryEnum = pgEnum("category", ["equipment", "technology"]);

export const statusEnum = pgEnum("status", [
  "open",
  "in_progress",
  "waiting",
  "resolved",
]);

// Priority levels, most-severe first. "high" was removed (it was redundant
// with "urgent"); existing high rows are remapped to urgent by the
// migrate-priority-levels script. A null value = "None" (the unset default).
export const priorityEnum = pgEnum("priority", ["urgent", "normal", "low"]);

export const issuesTable = pgTable(
  "issues",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").notNull().references(() => organizationsTable.id),
    restaurantId: integer("restaurant_id")
      .notNull()
      .references(() => restaurantsTable.id),
    area: areaEnum("area").notNull(),
    category: categoryEnum("category").notNull(),
    equipmentType: text("equipment_type").notNull(),
    subItem: text("sub_item"),
    customLabel: text("custom_label"),
    description: text("description").notNull(),
    status: statusEnum("status").notNull().default("open"),
    assignedTo: text("assigned_to"),
    priority: priorityEnum("priority"),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at"),
  },
  (table) => [
    index("issues_restaurant_id_idx").on(table.restaurantId),
    index("issues_status_idx").on(table.status),
    index("issues_restaurant_status_idx").on(table.restaurantId, table.status),
    index("issues_organization_id_idx").on(table.organizationId),
    index("issues_org_status_idx").on(table.organizationId, table.status),
  ],
);

export const insertIssueSchema = createInsertSchema(issuesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
});
export type InsertIssue = z.infer<typeof insertIssueSchema>;
export type Issue = typeof issuesTable.$inferSelect;
