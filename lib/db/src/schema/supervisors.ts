import { boolean, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const supervisorsTable = pgTable("supervisors", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  role: text("role").notNull().default("supervisor"),
  isActive: boolean("is_active").notNull().default(true),
  expoPushToken: text("expo_push_token"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSupervisorSchema = createInsertSchema(supervisorsTable).omit({ id: true, createdAt: true });
export type InsertSupervisor = z.infer<typeof insertSupervisorSchema>;
export type Supervisor = typeof supervisorsTable.$inferSelect;
