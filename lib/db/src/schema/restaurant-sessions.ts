import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";

// Legacy table — predates device_sessions. Kept in schema to prevent Drizzle from dropping it.
export const restaurantSessionsTable = pgTable("restaurant_sessions", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  restaurantId: integer("restaurant_id")
    .notNull()
    .references(() => restaurantsTable.id),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type RestaurantSession = typeof restaurantSessionsTable.$inferSelect;
