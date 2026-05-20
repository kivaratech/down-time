import { boolean, index, integer, jsonb, pgTable, serial, text } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";

export const equipmentItemsTable = pgTable(
  "equipment_items",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").references(() => organizationsTable.id),
    area: text("area").notNull(),
    name: text("name").notNull(),
    subItems: jsonb("sub_items").$type<string[]>().default([]),
    supportsCustomLabel: boolean("supports_custom_label").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (table) => [index("equipment_items_organization_id_idx").on(table.organizationId)],
);

export type EquipmentItemRow = typeof equipmentItemsTable.$inferSelect;
export type InsertEquipmentItem = typeof equipmentItemsTable.$inferInsert;
