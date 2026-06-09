import { db, organizationsTable, supervisorsTable, restaurantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "./auth";
import { logger } from "./logger";
import crypto from "crypto";

const DEFAULT_ORG_NAME = "DownTime";
const SUPER_ADMIN_EMAIL = "superadmin@downtime.local";

// Seed emails use the .local TLD so MX validation (production code path)
// will reject them in real usage — these are only created in an empty DB.
const SEED_SUPERVISOR_TEMPLATES = [
  { email: "admin@downtime.local", name: "Admin", role: "admin" as const },
  { email: "supervisor@downtime.local", name: "Supervisor", role: "supervisor" as const },
];

const SEED_RESTAURANTS = [
  { name: "Zeeb", location: "Zeeb Rd" },
  { name: "Baker", location: "Baker Rd" },
  { name: "Leslie", location: "Leslie Ave" },
  { name: "Stockbridge", location: "Stockbridge Rd" },
];

// Returns the default organization's id, creating it if it does not exist yet.
async function ensureDefaultOrg(): Promise<number> {
  const [existing] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.name, DEFAULT_ORG_NAME))
    .limit(1);
  if (existing) return existing.id;

  const [created] = await db
    .insert(organizationsTable)
    .values({ name: DEFAULT_ORG_NAME })
    .returning();
  logger.info({ orgId: created.id, name: DEFAULT_ORG_NAME }, "Seeded default organization");
  return created.id;
}

export async function seedDatabaseIfEmpty(): Promise<void> {
  try {
    const orgId = await ensureDefaultOrg();

    const existingSupervisors = await db.select().from(supervisorsTable).limit(1);
    if (existingSupervisors.length === 0) {
      logger.info("Seeding supervisors...");
      for (const sup of SEED_SUPERVISOR_TEMPLATES) {
        const password = crypto.randomBytes(10).toString("base64url");
        await db.insert(supervisorsTable).values({
          organizationId: orgId,
          email: sup.email,
          passwordHash: hashPassword(password),
          name: sup.name,
          role: sup.role,
          isActive: true,
        });
        logger.info({ email: sup.email, password }, "Seeded supervisor — save this password, it will not be shown again");
      }

      // Platform super_admin operates across all orgs, so it has no organization.
      const superPassword = crypto.randomBytes(10).toString("base64url");
      await db.insert(supervisorsTable).values({
        organizationId: null,
        email: SUPER_ADMIN_EMAIL,
        passwordHash: hashPassword(superPassword),
        name: "Platform Super Admin",
        role: "super_admin",
        isActive: true,
      });
      logger.info({ email: SUPER_ADMIN_EMAIL, password: superPassword }, "Seeded super_admin — save this password, it will not be shown again");

      logger.info({ count: SEED_SUPERVISOR_TEMPLATES.length + 1 }, "Supervisors seeded");
    } else {
      logger.info("Supervisors already exist, skipping seed");
    }

    const existingRestaurants = await db.select().from(restaurantsTable).limit(1);
    if (existingRestaurants.length === 0) {
      logger.info("Seeding restaurants...");
      for (const rest of SEED_RESTAURANTS) {
        await db.insert(restaurantsTable).values({ ...rest, organizationId: orgId });
      }
      logger.info({ count: SEED_RESTAURANTS.length }, "Restaurants seeded");
    } else {
      logger.info("Restaurants already exist, skipping seed");
    }
  } catch (err) {
    logger.error({ err }, "Database seed failed — server will still start");
  }
}
