import app from "./app";
import { logger } from "./lib/logger";
import { seedDatabaseIfEmpty } from "./lib/seed";
import { validateStorageConfig } from "./lib/objectStorage";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start(): Promise<void> {
  // Storage verification is NON-FATAL. A misconfigured/unreachable photo
  // bucket must never take the whole app down — login, issue reporting,
  // status changes, and comments all work without it. If verification fails
  // we log loudly and keep booting; photo upload/view is degraded until the
  // GCS config is fixed, but the restaurants stay online. (Previously a bad
  // bucket name or credential crashed the process and locked everyone out.)
  try {
    await validateStorageConfig();
  } catch (err) {
    logger.error(
      { err },
      "[storage] bucket verification failed — starting anyway; photo upload/view is degraded until GCS config is fixed",
    );
  }

  // Seed already swallows its own errors, but guard defensively so a seed
  // hiccup can't stop the server from listening either.
  try {
    await seedDatabaseIfEmpty();
  } catch (err) {
    logger.error({ err }, "Database seed failed — continuing to listen");
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

start();
