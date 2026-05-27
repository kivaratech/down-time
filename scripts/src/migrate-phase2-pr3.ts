import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/**
 * Phase 2 PR-3 migration — runs 2d → 2e → 2f in a single transaction.
 *
 * 2d. Backfill any issues created before PR-1 deployed (organization_id NULL).
 * 2e. Set NOT NULL on restaurants/issues/equipment_items.organization_id;
 *     add CHECK constraint requiring an org unless role='super_admin'.
 * 2f. Swap supervisors.username uniqueness from global → composite
 *     (organization_id, username), plus partial unique for super_admins.
 *
 * Idempotent: re-running on a partially-applied DB will skip the bits that
 * are already done. On any error, NOTHING commits — caller can investigate
 * and re-run.
 */
async function main() {
  console.log("🚀 Phase 2 PR-3 migration starting...");

  await db.transaction(async (tx) => {
    // ---------------------------------------------------------------------
    // 2d. Adopt orphan issues into their restaurant's organization.
    // ---------------------------------------------------------------------
    const backfillResult = await tx.execute(sql`
      update issues as i
      set organization_id = r.organization_id
      from restaurants as r
      where i.restaurant_id = r.id and i.organization_id is null
    `);
    console.log(`  ✓ 2d: backfilled ${backfillResult.rowCount ?? 0} orphan issue(s)`);

    // Belt-and-braces: confirm no nulls remain on the three columns we are
    // about to lock down. If anything remains, abort the transaction.
    const remaining = await tx.execute(sql`
      select 'restaurants' as t, count(*)::int as n from restaurants where organization_id is null
      union all select 'issues', count(*)::int from issues where organization_id is null
      union all select 'equipment_items', count(*)::int from equipment_items where organization_id is null
    `);
    for (const row of remaining.rows as { t: string; n: number }[]) {
      if (row.n > 0) {
        throw new Error(`Refusing to enforce NOT NULL: ${row.t} still has ${row.n} null organization_id row(s)`);
      }
    }
    console.log("  ✓ pre-check: zero null organization_id remaining on restaurants/issues/equipment_items");

    // ---------------------------------------------------------------------
    // 2e. NOT NULL flips + CHECK constraint on supervisors.
    //     `SET NOT NULL` is idempotent in Postgres — already-NOT-NULL is a no-op.
    // ---------------------------------------------------------------------
    await tx.execute(sql`alter table restaurants alter column organization_id set not null`);
    await tx.execute(sql`alter table issues alter column organization_id set not null`);
    await tx.execute(sql`alter table equipment_items alter column organization_id set not null`);
    console.log("  ✓ 2e: organization_id is NOT NULL on restaurants/issues/equipment_items");

    // Add CHECK constraint — guarded so re-runs don't fail with "already exists".
    const checkExists = await tx.execute(sql`
      select 1 from pg_constraint
      where conname = 'supervisors_org_required'
        and conrelid = 'supervisors'::regclass
    `);
    if (checkExists.rows.length === 0) {
      await tx.execute(sql`
        alter table supervisors
        add constraint supervisors_org_required
        check (role = 'super_admin' or organization_id is not null)
      `);
      console.log("  ✓ 2e: supervisors_org_required CHECK constraint added");
    } else {
      console.log("  • 2e: supervisors_org_required CHECK already present");
    }

    // ---------------------------------------------------------------------
    // 2f. Drop the global unique on supervisors.username, add the composite
    //     unique + partial unique for super_admins.
    // ---------------------------------------------------------------------
    // Find any existing single-column unique constraint on username and drop
    // it dynamically — drizzle's auto-generated name is conventional but we
    // don't want to hard-code it.
    const usernameUnique = await tx.execute(sql`
      select conname from pg_constraint
      where conrelid = 'supervisors'::regclass
        and contype = 'u'
        and array_length(conkey, 1) = 1
        and conkey[1] = (
          select attnum from pg_attribute
          where attrelid = 'supervisors'::regclass and attname = 'username'
        )
    `);
    if (usernameUnique.rows.length === 0) {
      console.log("  • 2f: no global unique constraint on supervisors.username (already dropped)");
    } else {
      for (const row of usernameUnique.rows as { conname: string }[]) {
        await tx.execute(sql.raw(`alter table supervisors drop constraint "${row.conname}"`));
        console.log(`  ✓ 2f: dropped global unique constraint "${row.conname}"`);
      }
    }

    await tx.execute(sql`
      create unique index if not exists supervisors_org_username_unique
      on supervisors (organization_id, username)
    `);
    console.log("  ✓ 2f: composite unique index supervisors_org_username_unique");

    await tx.execute(sql`
      create unique index if not exists supervisors_superadmin_username_unique
      on supervisors (username) where organization_id is null
    `);
    console.log("  ✓ 2f: partial unique index supervisors_superadmin_username_unique (for super_admin rows)");
  });

  console.log("✅ Migration complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Migration failed (no changes committed):", err);
  process.exit(1);
});
