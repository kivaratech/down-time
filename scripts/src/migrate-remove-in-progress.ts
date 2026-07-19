/**
 * Migration: issue status  open/in_progress/waiting/resolved -> open/waiting/resolved.
 *
 * "in_progress" is being removed. An audit of prod on 2026-07-18 found ZERO
 * rows using it across the entire issues table — teams set "waiting" instead,
 * which covers the same "picked up, not done" meaning. Same shape as
 * migrate-priority-levels.ts (high -> urgent):
 *
 *   1. Remap any lingering `in_progress` issue to `open`. Expected to touch 0
 *      rows; kept as a safety net in case one lands between the audit and the
 *      run. `open` (not `waiting`) is the safe landing spot — it puts the
 *      issue back in the triage queue rather than silently marking it blocked.
 *   2. Create a new enum `status_new` with the final values.
 *   3. Swap issues.status onto the new type (text cast; safe because no
 *      in_progress values remain after step 1).
 *   4. Drop the old type and rename the new one to `status`.
 *
 * The column default (`open`) is dropped before the type swap and restored
 * after — Postgres won't cast a column default across enum types in place.
 *
 * All in one transaction — if anything fails it rolls back and the old enum is
 * intact. Run BEFORE deploying the new API build: the new build's Zod schemas
 * reject `in_progress`, so running it after would leave a window where the DB
 * can still hold a value the API refuses to serialize. Run BEFORE
 * `drizzle push`; afterwards push should report no changes.
 */
import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Load DATABASE_URL from the project-root .env before importing @workspace/db,
// which throws at import time if it's unset. Same approach as
// lib/db/drizzle.config.ts — Node 22+'s built-in loadEnvFile, no dotenv dep.
const here = path.dirname(fileURLToPath(import.meta.url));
const rootEnv = path.resolve(here, "..", "..", ".env");
if (!process.env.DATABASE_URL && existsSync(rootEnv)) {
  loadEnvFile(rootEnv);
}

const { db } = await import("@workspace/db");
const { sql } = await import("drizzle-orm");

async function main() {
  console.log("🔧 Removing issue status 'in_progress' (→ open)...\n");

  await db.transaction(async (tx) => {
    const preview = await tx.execute(
      sql`SELECT count(*)::int AS n FROM issues WHERE status = 'in_progress'`,
    );
    const affected = (preview.rows?.[0] as { n?: number } | undefined)?.n ?? 0;
    console.log(`  · Found ${affected} issue(s) with status 'in_progress'`);

    const remapped = await tx.execute(
      sql`UPDATE issues SET status = 'open' WHERE status = 'in_progress'`,
    );
    console.log(`  ✓ Remapped ${remapped.rowCount ?? 0} issue(s) → 'open'`);

    await tx.execute(sql`ALTER TABLE issues ALTER COLUMN status DROP DEFAULT`);
    console.log("  ✓ Dropped the column default (restored after the swap)");

    await tx.execute(sql`CREATE TYPE status_new AS ENUM ('open', 'waiting', 'resolved')`);
    console.log("  ✓ Created new enum status_new (open, waiting, resolved)");

    await tx.execute(
      sql`ALTER TABLE issues
          ALTER COLUMN status TYPE status_new
          USING status::text::status_new`,
    );
    console.log("  ✓ Swapped issues.status onto the new type");

    await tx.execute(sql`DROP TYPE status`);
    await tx.execute(sql`ALTER TYPE status_new RENAME TO status`);
    console.log("  ✓ Dropped old type, renamed status_new → status");

    await tx.execute(sql`ALTER TABLE issues ALTER COLUMN status SET DEFAULT 'open'`);
    console.log("  ✓ Restored the 'open' column default");
  });

  console.log("\n✅ Done. Next: `pnpm --filter @workspace/db run push` (should report no changes).");
  process.exit(0);
}

main().catch((e) => {
  console.error("\n❌ Migration failed:", e);
  process.exit(1);
});
