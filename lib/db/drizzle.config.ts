import { defineConfig } from "drizzle-kit";
import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Load DATABASE_URL from the project-root .env if it isn't already in the
// process environment. CI / Railway set DATABASE_URL directly, so this
// only kicks in for local `pnpm --filter @workspace/db run push` runs.
// Uses Node 22+'s built-in loadEnvFile so we don't add a dotenv dep.
const here = path.dirname(fileURLToPath(import.meta.url));
const rootEnv = path.resolve(here, "..", "..", ".env");
if (!process.env.DATABASE_URL && existsSync(rootEnv)) {
  loadEnvFile(rootEnv);
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
