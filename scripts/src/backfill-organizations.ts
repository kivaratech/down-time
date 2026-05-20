import { db } from "@workspace/db";
import {
  equipmentItemsTable,
  issuesTable,
  organizationsTable,
  restaurantsTable,
  supervisorsTable,
} from "@workspace/db/schema";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import crypto from "crypto";

// One-time, idempotent backfill that adopts all existing single-tenant data
// into a default organization, and creates a fresh platform super_admin.
//
// Safe to re-run: every step is guarded so it only touches rows that have not
// already been migrated. Run this AFTER the additive schema change has been
// applied (drizzle-kit push), and only against a database you have backed up.

const DEFAULT_ORG_NAME = process.env.DEFAULT_ORG_NAME?.trim() || "DownTime";
const SUPER_ADMIN_USERNAME = process.env.SUPER_ADMIN_USERNAME?.trim() || "superadmin";
const SUPER_ADMIN_NAME = process.env.SUPER_ADMIN_NAME?.trim() || "Platform Super Admin";

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = "sha512";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST)
    .toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  console.log("🏢 Backfilling organizations...");

  await db.transaction(async (tx) => {
    // 1. Find or create the default organization.
    const [existingOrg] = await tx
      .select()
      .from(organizationsTable)
      .where(eq(organizationsTable.name, DEFAULT_ORG_NAME))
      .limit(1);

    let orgId: number;
    if (existingOrg) {
      orgId = existingOrg.id;
      console.log(`  • Default org "${DEFAULT_ORG_NAME}" already exists (id=${orgId})`);
    } else {
      const [created] = await tx
        .insert(organizationsTable)
        .values({ name: DEFAULT_ORG_NAME })
        .returning();
      orgId = created.id;
      console.log(`  ✓ Created default org "${DEFAULT_ORG_NAME}" (id=${orgId})`);
    }

    // 2. Adopt existing restaurants.
    const restaurants = await tx
      .update(restaurantsTable)
      .set({ organizationId: orgId })
      .where(isNull(restaurantsTable.organizationId))
      .returning({ id: restaurantsTable.id });
    console.log(`  ✓ Assigned ${restaurants.length} restaurant(s)`);

    // 3. Adopt existing equipment items (the previously global catalog).
    const equipment = await tx
      .update(equipmentItemsTable)
      .set({ organizationId: orgId })
      .where(isNull(equipmentItemsTable.organizationId))
      .returning({ id: equipmentItemsTable.id });
    console.log(`  ✓ Assigned ${equipment.length} equipment item(s)`);

    // 4. Adopt existing supervisors/admins — but never touch super_admins.
    const supervisors = await tx
      .update(supervisorsTable)
      .set({ organizationId: orgId })
      .where(and(isNull(supervisorsTable.organizationId), ne(supervisorsTable.role, "super_admin")))
      .returning({ id: supervisorsTable.id });
    console.log(`  ✓ Assigned ${supervisors.length} supervisor/admin account(s)`);

    // 5. Adopt existing issues, deriving org from each issue's restaurant so it
    //    always matches the anchor.
    const issuesResult = await tx.execute(sql`
      update ${issuesTable} as i
      set organization_id = r.organization_id
      from ${restaurantsTable} as r
      where i.restaurant_id = r.id and i.organization_id is null
    `);
    console.log(`  ✓ Assigned ${issuesResult.rowCount ?? 0} issue(s)`);

    // 6. Create the platform super_admin (org = null) if it does not exist.
    const [existingSuper] = await tx
      .select({ id: supervisorsTable.id })
      .from(supervisorsTable)
      .where(eq(supervisorsTable.username, SUPER_ADMIN_USERNAME))
      .limit(1);

    if (existingSuper) {
      console.log(`  • Super admin "${SUPER_ADMIN_USERNAME}" already exists — left unchanged`);
    } else {
      const password = process.env.SUPER_ADMIN_PASSWORD?.trim() || crypto.randomBytes(12).toString("base64url");
      await tx.insert(supervisorsTable).values({
        organizationId: null,
        username: SUPER_ADMIN_USERNAME,
        passwordHash: hashPassword(password),
        name: SUPER_ADMIN_NAME,
        role: "super_admin",
        isActive: true,
      });
      console.log("  ✓ Created platform super_admin");
      console.log("    ───────────────────────────────────────────────");
      console.log(`    username: ${SUPER_ADMIN_USERNAME}`);
      console.log(`    password: ${password}`);
      console.log("    SAVE THIS PASSWORD — it will not be shown again.");
      console.log("    ───────────────────────────────────────────────");
    }
  });

  console.log("✅ Backfill complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Backfill failed (no changes committed):", err);
  process.exit(1);
});
