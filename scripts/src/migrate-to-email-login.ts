/**
 * Migration: username → email login.
 *
 * Idempotent. Does the following, in order, in a single transaction:
 *
 *   1. Delete legacy test accounts that don't map to a real human:
 *      supervisor ids 5 and 6 (testuser, e999999), and any of their
 *      dependent rows (sessions, devices, assignments).
 *
 *   2. Backfill emails on the four known production supervisor rows:
 *        id 1 → tyler.powers@us.stores.mcd.com
 *        id 2 → kim.duncan@us.stores.mcd.com
 *        id 3 → kivara.tech@gmail.com         (super_admin)
 *        id 4 → max.lantz@us.stores.mcd.com
 *      Each row is only updated if its current email is null or empty —
 *      so re-running is safe and won't clobber a manually-set value.
 *
 *   3. Sanity check: every surviving row has a non-null, non-empty email.
 *      If anything is missing, the transaction rolls back and the next
 *      step (drizzle-kit push to apply NOT NULL + UNIQUE) is not safe.
 *
 * Run AFTER deploying the API server code that knows about email login
 * (so any new signups already write emails), but BEFORE running
 * `pnpm --filter @workspace/db run push` to enforce NOT NULL + UNIQUE.
 *
 * Once this script reports success, `drizzle-kit push` will be able to
 * drop the old per-org username unique indexes and add the new email
 * unique index without error.
 */
import { db } from "@workspace/db";
import {
  supervisorsTable,
  supervisorSessionsTable,
  supervisorDevicesTable,
  supervisorRestaurantsTable,
} from "@workspace/db/schema";
import { eq, inArray, isNull, or, sql } from "drizzle-orm";

const EMAIL_BACKFILL: Record<number, string> = {
  1: "tyler.powers@us.stores.mcd.com",
  2: "kim.duncan@us.stores.mcd.com",
  3: "kivara.tech@gmail.com",
  4: "max.lantz@us.stores.mcd.com",
};

const IDS_TO_DELETE = [5, 6];

async function main() {
  console.log("📧 Migrating supervisors to email-based login...\n");

  await db.transaction(async (tx) => {
    // ----------------------------------------------------------------------
    // 1. Delete legacy test accounts (id 5, 6) and their dependent rows.
    // ----------------------------------------------------------------------
    console.log(`  Deleting legacy test supervisors ${IDS_TO_DELETE.join(", ")}...`);

    await tx
      .delete(supervisorSessionsTable)
      .where(inArray(supervisorSessionsTable.supervisorId, IDS_TO_DELETE));
    await tx
      .delete(supervisorDevicesTable)
      .where(inArray(supervisorDevicesTable.supervisorId, IDS_TO_DELETE));
    await tx
      .delete(supervisorRestaurantsTable)
      .where(inArray(supervisorRestaurantsTable.supervisorId, IDS_TO_DELETE));
    const deleted = await tx
      .delete(supervisorsTable)
      .where(inArray(supervisorsTable.id, IDS_TO_DELETE))
      .returning({ id: supervisorsTable.id });
    console.log(`    ✓ Deleted ${deleted.length} supervisor row(s)`);

    // ----------------------------------------------------------------------
    // 2. Backfill emails on the known production rows.
    // ----------------------------------------------------------------------
    console.log("\n  Backfilling emails for production supervisors...");
    for (const [idStr, email] of Object.entries(EMAIL_BACKFILL)) {
      const id = Number(idStr);
      const [row] = await tx
        .select({ id: supervisorsTable.id, currentEmail: supervisorsTable.email, name: supervisorsTable.name })
        .from(supervisorsTable)
        .where(eq(supervisorsTable.id, id))
        .limit(1);

      if (!row) {
        throw new Error(
          `Supervisor id=${id} not found. Aborting before damage. Verify the production DB matches the expected id mapping.`,
        );
      }

      const hasEmail = typeof row.currentEmail === "string" && row.currentEmail.trim().length > 0;
      if (hasEmail && row.currentEmail !== email) {
        // Row already has a different email — leave it. Re-running after a
        // manual fix shouldn't undo the fix.
        console.log(`    · id=${id} (${row.name}) already has email "${row.currentEmail}" — leaving as-is`);
        continue;
      }
      if (hasEmail && row.currentEmail === email) {
        console.log(`    · id=${id} (${row.name}) already has expected email — no-op`);
        continue;
      }

      await tx
        .update(supervisorsTable)
        .set({ email })
        .where(eq(supervisorsTable.id, id));
      console.log(`    ✓ id=${id} (${row.name}) → ${email}`);
    }

    // ----------------------------------------------------------------------
    // 3. Sanity check: every surviving row must have a non-empty email.
    // ----------------------------------------------------------------------
    console.log("\n  Sanity check: every supervisor has an email...");
    const missing = await tx
      .select({ id: supervisorsTable.id, name: supervisorsTable.name, role: supervisorsTable.role })
      .from(supervisorsTable)
      .where(or(isNull(supervisorsTable.email), eq(supervisorsTable.email, "")));
    if (missing.length > 0) {
      console.error("    ✗ Rows without email:");
      for (const m of missing) console.error(`        id=${m.id} role=${m.role} name="${m.name}"`);
      throw new Error(
        `${missing.length} supervisor row(s) still have no email. Migration cannot proceed — add them to EMAIL_BACKFILL or delete them.`,
      );
    }
    console.log("    ✓ All supervisors have an email");

    // Also catch duplicate emails before the unique index would fail to build.
    const dupes = await tx.execute(sql<{ email: string; n: number }>`
      select email, count(*) as n
      from supervisors
      group by email
      having count(*) > 1
    `);
    if (dupes.rows.length > 0) {
      console.error("    ✗ Duplicate emails detected (would break the unique index):");
      for (const d of dupes.rows as Array<{ email: string; n: string | number }>) {
        console.error(`        ${d.email} (${d.n} rows)`);
      }
      throw new Error("Resolve duplicate emails before applying the unique index.");
    }
    console.log("    ✓ No duplicate emails");
  });

  console.log("\n✅ Migration complete. Next: `pnpm --filter @workspace/db run push` to apply NOT NULL + UNIQUE.");
  process.exit(0);
}

main().catch((e) => {
  console.error("\n❌ Migration failed:", e);
  process.exit(1);
});
