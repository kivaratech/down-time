import { boolean, integer, jsonb, pgTable, serial, text } from "drizzle-orm/pg-core";

export const equipmentItemsTable = pgTable("equipment_items", {
  id: serial("id").primaryKey(),
  area: text("area").notNull(),
  name: text("name").notNull(),
  subItems: jsonb("sub_items").$type<string[]>().default([]),
  supportsCustomLabel: boolean("supports_custom_label").default(false).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
});

export type EquipmentItemRow = typeof equipmentItemsTable.$inferSelect;
export type InsertEquipmentItem = typeof equipmentItemsTable.$inferInsert;
