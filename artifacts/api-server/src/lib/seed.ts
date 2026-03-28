import { db, supervisorsTable, restaurantsTable } from "@workspace/db";
import { hashPassword } from "./auth";
import { logger } from "./logger";

const SEED_SUPERVISORS = [
  {
    username: "admin",
    password: "admin123",
    name: "Admin",
    role: "admin",
  },
  {
    username: "supervisor",
    password: "pass123",
    name: "Supervisor",
    role: "supervisor",
  },
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
      for (const sup of SEED_SUPERVISORS) {
        await db.insert(supervisorsTable).values({
          username: sup.username,
          passwordHash: hashPassword(sup.password),
          name: sup.name,
          role: sup.role,
          isActive: true,
        });
      }
      logger.info({ count: SEED_SUPERVISORS.length }, "Supervisors seeded");
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
