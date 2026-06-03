// One-shot: wipe ALL issues (and their dependent rows) for a specific
// organization. Used to clear smoke-test data before real customer use.
//
// What it deletes, in order:
//   1. notification_attempts whose issueId belongs to the org
//   2. comments whose issueId belongs to the org
//   3. issues themselves
//
// What it does NOT touch:
//   - Photos in Google Cloud Storage that were attached to those issues
//     become orphan blobs. Negligible storage cost. To clean those up
//     manually: go to GCS console, navigate to `<orgId>/uploads/`,
//     bulk-select + delete. Or write a separate cleanup script later.
//   - Restaurants, equipment items, supervisors, sessions, etc. All
//     org structure is preserved — only the issue history is wiped.
//
// Usage:
//   pnpm --filter @workspace/scripts exec tsx \
//     --env-file=../.env ./src/wipe-org-issues.ts [orgId]
//
// orgId defaults to 1 (Gandar Management). Pass another integer to
// target a different org.

import {
  commentsTable,
  db,
  issuesTable,
  notificationAttemptsTable,
  organizationsTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

const DEFAULT_ORG_ID = 1;

async function main() {
  const argOrg = process.argv[2];
  const orgId = argOrg ? Number(argOrg) : DEFAULT_ORG_ID;
  if (!Number.isInteger(orgId) || orgId <= 0) {
    console.error(`Invalid orgId: ${argOrg}. Pass a positive integer.`);
    process.exit(1);
  }

  const [org] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.id, orgId))
    .limit(1);

  if (!org) {
    console.error(`No organization found with id=${orgId}. Aborting.`);
    process.exit(1);
  }

  console.log(`Targeting org id=${org.id} "${org.name}"\n`);

  const issues = await db
    .select({ id: issuesTable.id, status: issuesTable.status })
    .from(issuesTable)
    .where(eq(issuesTable.organizationId, orgId));

  if (issues.length === 0) {
    console.log("No issues to wipe — already clean.");
    process.exit(0);
  }

  const byStatus: Record<string, number> = {};
  for (const i of issues) byStatus[i.status] = (byStatus[i.status] ?? 0) + 1;

  console.log(`Found ${issues.length} issue(s) to wipe:`);
  for (const [status, count] of Object.entries(byStatus)) {
    console.log(`  - ${count} ${status}`);
  }
  console.log();

  const issueIds = issues.map((i) => i.id);

  const notifs = await db
    .delete(notificationAttemptsTable)
    .where(inArray(notificationAttemptsTable.issueId, issueIds))
    .returning({ id: notificationAttemptsTable.id });
  console.log(`✓ Deleted ${notifs.length} notification_attempts row(s)`);

  const comments = await db
    .delete(commentsTable)
    .where(inArray(commentsTable.issueId, issueIds))
    .returning({ id: commentsTable.id });
  console.log(`✓ Deleted ${comments.length} comment(s)`);

  const wiped = await db
    .delete(issuesTable)
    .where(eq(issuesTable.organizationId, orgId))
    .returning({ id: issuesTable.id });
  console.log(`✓ Deleted ${wiped.length} issue(s)`);

  console.log(
    `\nDone. Org "${org.name}" is now issue-free. Photos that were attached to wiped issues remain in GCS as orphan blobs (negligible cost).`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
