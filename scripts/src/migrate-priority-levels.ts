/**
 * Migration: priority levels  urgent/high/normal -> urgent/normal/low.
 *
 * "high" is being removed (treated as redundant with "urgent"). Postgres
 * won't drop an enum value in place, so this recreates the type:
 *
 *   1. Remap every existing `high` issue to `urgent` (no data lost — high
 *      was the closest level to urgent).
 *   2. Create a new enum `priority_new` with the final values.
 *   3. Swap the issues.priority column onto the new type (value-by-value
 *      text cast; safe because no `high` values remain after step 1, and
 *      NULL/None rows pass through untouched).
 *   4. Drop the old type and rename the new one to `priority`.
 *
 * All in one transaction — if anything fails it rolls back and the old
 * enum is intact. Idempotent-ish: re-running after success is a no-op for
 * step 1 (no high rows left) and step 2+ would error only if a stale
 * `priority_new` exists, which the transaction prevents. Run BEFORE
 * `drizzle push`; afterwards push should report no changes.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("🔧 Migrating issue priority levels (high → urgent; add low)...\n");

  await db.transaction(async (tx) => {
    const remapped = await tx.execute(
      sql`UPDATE issues SET priority = 'urgent' WHERE priority = 'high'`,
    );
    console.log(`  ✓ Remapped ${remapped.rowCount ?? 0} 'high' issue(s) → 'urgent'`);

    await tx.execute(sql`CREATE TYPE priority_new AS ENUM ('urgent', 'normal', 'low')`);
    console.log("  ✓ Created new enum priority_new (urgent, normal, low)");

    await tx.execute(
      sql`ALTER TABLE issues
          ALTER COLUMN priority TYPE priority_new
          USING priority::text::priority_new`,
    );
    console.log("  ✓ Swapped issues.priority onto the new type");

    await tx.execute(sql`DROP TYPE priority`);
    await tx.execute(sql`ALTER TYPE priority_new RENAME TO priority`);
    console.log("  ✓ Dropped old type, renamed priority_new → priority");
  });

  console.log("\n✅ Done. Next: `pnpm --filter @workspace/db run push` (should report no changes).");
  process.exit(0);
}

main().catch((e) => {
  console.error("\n❌ Migration failed:", e);
  process.exit(1);
});
