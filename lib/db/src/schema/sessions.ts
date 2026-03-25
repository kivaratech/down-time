import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { restaurantsTable } from "./restaurants";
import { supervisorsTable } from "./supervisors";

export const deviceSessionsTable = pgTable("device_sessions", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  restaurantId: integer("restaurant_id")
    .notNull()
    .references(() => restaurantsTable.id),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pairingCodesTable = pgTable("pairing_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  restaurantId: integer("restaurant_id")
    .notNull()
    .references(() => restaurantsTable.id),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
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

export type DeviceSession = typeof deviceSessionsTable.$inferSelect;
export type PairingCode = typeof pairingCodesTable.$inferSelect;
export type SupervisorSession = typeof supervisorSessionsTable.$inferSelect;
