import { integer, pgTable, primaryKey, timestamp } from "drizzle-orm/pg-core";
import { supervisorsTable } from "./supervisors";
import { restaurantsTable } from "./restaurants";

export const supervisorRestaurantsTable = pgTable(
  "supervisor_restaurants",
  {
    supervisorId: integer("supervisor_id")
      .notNull()
      .references(() => supervisorsTable.id, { onDelete: "cascade" }),
    restaurantId: integer("restaurant_id")
      .notNull()
      .references(() => restaurantsTable.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.supervisorId, table.restaurantId] })]
);

export type SupervisorRestaurant = typeof supervisorRestaurantsTable.$inferSelect;
