import { db } from "@workspace/db";
import { supervisorsTable, supervisorSessionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

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

const RESETS = [
  { username: "admin", password: "admin123" },
  { username: "supervisor", password: "pass123" },
];

for (const { username, password } of RESETS) {
  const [row] = await db
    .select({ id: supervisorsTable.id })
    .from(supervisorsTable)
    .where(eq(supervisorsTable.username, username))
    .limit(1);

  if (!row) {
    console.log(`  ⚠ No account found for "${username}" — skipping`);
    continue;
  }

  await db
    .update(supervisorsTable)
    .set({ passwordHash: hashPassword(password) })
    .where(eq(supervisorsTable.id, row.id));

  await db
    .delete(supervisorSessionsTable)
    .where(eq(supervisorSessionsTable.supervisorId, row.id));

  console.log(`  ✓ Reset password + cleared sessions for "${username}"`);
}

console.log("\nDone. Log in fresh with the credentials above.");
process.exit(0);
