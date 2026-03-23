import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";
import { supervisorsTable } from "./supervisors";

export const restaurantSessionsTable = pgTable("restaurant_sessions", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  restaurantId: integer("restaurant_id")
    .notNull()
    .references(() => restaurantsTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const supervisorSessionsTable = pgTable("supervisor_sessions", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  supervisorId: integer("supervisor_id")
    .notNull()
    .references(() => supervisorsTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type RestaurantSession = typeof restaurantSessionsTable.$inferSelect;
export type SupervisorSession = typeof supervisorSessionsTable.$inferSelect;
