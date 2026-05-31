// Migrates any existing `supervisors.expoPushToken` values into rows in the
// new `supervisor_devices` table. Idempotent — re-running is safe (the unique
// index on (supervisorId, expoPushToken) makes the inserts no-ops if the row
// already exists).
//
// Run order around the per-device-tokens deploy:
//   1. Push schema:   pnpm --filter @workspace/db run push
//   2. Run this:      pnpm --filter @workspace/scripts run backfill-supervisor-devices
//   3. Deploy server: Railway picks up the new code automatically on push to master
//
// After backfill + deploy, every push notification fan-out reads from
// supervisor_devices instead of supervisors.expoPushToken. The old column is
// left in place (vestigial) so the migration is non-destructive; drop it in
// a separate later cleanup once you're confident.
import { db, supervisorsTable, supervisorDevicesTable } from "@workspace/db";
import { isNotNull } from "drizzle-orm";

async function main() {
  const supervisors = await db
    .select({
      id: supervisorsTable.id,
      username: supervisorsTable.username,
      expoPushToken: supervisorsTable.expoPushToken,
    })
    .from(supervisorsTable)
    .where(isNotNull(supervisorsTable.expoPushToken));

  console.log(`Found ${supervisors.length} supervisor(s) with a push token to migrate.`);

  let inserted = 0;
  let alreadyPresent = 0;
  let failed = 0;

  for (const s of supervisors) {
    if (!s.expoPushToken) continue;
    try {
      const result = await db
        .insert(supervisorDevicesTable)
        .values({
          supervisorId: s.id,
          expoPushToken: s.expoPushToken,
        })
        .onConflictDoNothing()
        .returning({ id: supervisorDevicesTable.id });

      if (result.length > 0) {
        console.log(`  ✓ Migrated token for ${s.username} (supervisor id=${s.id})`);
        inserted++;
      } else {
        console.log(`  · Already present for ${s.username} (supervisor id=${s.id})`);
        alreadyPresent++;
      }
    } catch (err) {
      console.error(`  ✗ Failed for ${s.username}: ${err}`);
      failed++;
    }
  }

  console.log(
    `\nDone. ${inserted} inserted, ${alreadyPresent} already present, ${failed} failed.`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
