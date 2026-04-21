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

export const priorityEnum = pgEnum("priority", ["urgent", "high", "normal"]);

export const issuesTable = pgTable(
  "issues",
  {
    id: serial("id").primaryKey(),
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
