import { db, supervisorsTable, restaurantsTable } from "@workspace/db";
import { hashPassword } from "./auth";
import { logger } from "./logger";
import crypto from "crypto";

const SEED_SUPERVISOR_TEMPLATES = [
  { username: "admin", name: "Admin", role: "admin" as const },
  { username: "supervisor", name: "Supervisor", role: "supervisor" as const },
];

const SEED_RESTAURANTS = [
  { name: "Zeeb", location: "Zeeb Rd" },
  { name: "Baker", location: "Baker Rd" },
  { name: "Leslie", location: "Leslie Ave" },
  { name: "Stockbridge", location: "Stockbridge Rd" },
];

export async function seedDatabaseIfEmpty(): Promise<void> {
  try {
    const existingSupervisors = await db.select().from(supervisorsTable).limit(1);
    if (existingSupervisors.length === 0) {
      logger.info("Seeding supervisors...");
      for (const sup of SEED_SUPERVISOR_TEMPLATES) {
        const password = crypto.randomBytes(10).toString("base64url");
        await db.insert(supervisorsTable).values({
          username: sup.username,
          passwordHash: hashPassword(password),
          name: sup.name,
          role: sup.role,
          isActive: true,
        });
        logger.info({ username: sup.username, password }, "Seeded supervisor — save this password, it will not be shown again");
      }
      logger.info({ count: SEED_SUPERVISOR_TEMPLATES.length }, "Supervisors seeded");
    } else {
      logger.info("Supervisors already exist, skipping seed");
    }

    const existingRestaurants = await db.select().from(restaurantsTable).limit(1);
    if (existingRestaurants.length === 0) {
      logger.info("Seeding restaurants...");
      for (const rest of SEED_RESTAURANTS) {
        await db.insert(restaurantsTable).values(rest);
      }
      logger.info({ count: SEED_RESTAURANTS.length }, "Restaurants seeded");
    } else {
      logger.info("Restaurants already exist, skipping seed");
    }
  } catch (err) {
    logger.error({ err }, "Database seed failed — server will still start");
  }
}
