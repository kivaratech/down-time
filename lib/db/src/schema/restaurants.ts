import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const restaurantsTable = pgTable(
  "restaurants",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").notNull().references(() => organizationsTable.id),
    name: text("name").notNull(),
    location: text("location").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("restaurants_organization_id_idx").on(table.organizationId)],
);

export const insertRestaurantSchema = createInsertSchema(restaurantsTable).omit({ id: true, createdAt: true });
export type InsertRestaurant = z.infer<typeof insertRestaurantSchema>;
export type Restaurant = typeof restaurantsTable.$inferSelect;
