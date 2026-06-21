import { Storage, File } from "@google-cloud/storage";
import { Readable } from "stream";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";
import { logger } from "./logger";

function createStorageClient(): Storage {
  const keyJson = process.env.GCS_SERVICE_ACCOUNT_JSON;
  if (!keyJson) {
    throw new Error(
      "[storage] GCS_SERVICE_ACCOUNT_JSON env var is not set. " +
        "Generate a service account key in the Firebase console (Project Settings → Service Accounts) " +
        "and paste the full JSON as this env var."
    );
  }
  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(keyJson);
  } catch {
    throw new Error(
      "[storage] GCS_SERVICE_ACCOUNT_JSON is not valid JSON. " +
        "Check that the env var contains the full contents of the service account key file."
    );
  }
  return new Storage({ credentials, projectId: credentials.project_id as string });
}

export const objectStorageClient = createStorageClient();

/**
 * Resolve the GCS bucket name from env vars.
 *
 * Primary:  GCS_BUCKET_NAME — just the bucket name. For THIS project it is
 *           "downtime-77b0a.firebasestorage.app". NOTE: there are two Firebase
 *           bucket naming schemes — newer projects (this one) use
 *           "<project>.firebasestorage.app"; older ones use "<project>.appspot.com".
 *           Use whichever bucket actually EXISTS (check Firebase console →
 *           Storage). Don't assume the suffix — a wrong one verifies as
 *           "bucket not found".
 * Fallback: PRIVATE_OBJECT_DIR — legacy path-style var, e.g. "/downtime-77b0a.firebasestorage.app"
 *           The first path segment is used as the bucket name.
 */
function getGcsBucketName(): string {
  const explicit = process.env.GCS_BUCKET_NAME?.trim();
  if (explicit) return explicit;

  const dir = process.env.PRIVATE_OBJECT_DIR?.trim();
  if (dir) {
    const normalized = dir.startsWith("/") ? dir : `/${dir}`;
    const bucket = normalized.split("/")[1];
    if (bucket) return bucket;
  }

  throw new Error(
    "[storage] GCS_BUCKET_NAME env var is not set. " +
      "Set it to the GCS bucket name, e.g. GCS_BUCKET_NAME=downtime-77b0a.firebasestorage.app\n" +
      "  Find the exact bucket name in the Firebase console under Storage — newer\n" +
      "  projects use .firebasestorage.app, older ones .appspot.com."
  );
}

/**
 * Validate that the configured GCS bucket exists and is accessible.
 * Call this at server startup so misconfigurations fail fast with a clear message.
 *
 * Retries transient failures (network blips, "Premature close" on the Google
 * OAuth token fetch) with a short backoff before giving up — a flaky moment
 * reaching Google shouldn't leave photo storage broken until the next deploy.
 * A genuine "bucket not found" is a real config error and is NOT retried.
 */
export async function validateStorageConfig(): Promise<void> {
  const bucketName = getGcsBucketName();
  logger.info({ bucketName }, "[storage] Configured GCS bucket");

  const maxAttempts = 3;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const [exists] = await objectStorageClient.bucket(bucketName).exists();
      if (!exists) {
        throw new Error(
          `[storage] GCS bucket not found: "${bucketName}"\n` +
            "  Check GCS_BUCKET_NAME against the exact bucket in Firebase console → Storage\n" +
            "  (this project uses .firebasestorage.app; some older projects use .appspot.com).\n" +
            "  Also verify GCS_SERVICE_ACCOUNT_JSON has Storage access to this bucket."
        );
      }
      logger.info({ bucketName }, "[storage] GCS bucket verified OK");
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // A real "bucket not found" is a config error — fail immediately, no retry.
      if (msg.startsWith("[storage] GCS bucket not found")) throw err;

      lastErr = err;
      if (attempt < maxAttempts) {
        const delayMs = attempt * 1500; // 1.5s, 3s
        logger.warn(
          { bucketName, attempt, maxAttempts, err: msg },
          `[storage] verification attempt ${attempt} failed — retrying in ${delayMs}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(
    `[storage] Failed to verify GCS bucket "${bucketName}" after ${maxAttempts} attempts: ${msg}\n` +
      "  Check GCS_SERVICE_ACCOUNT_JSON has the Storage Object Admin role on this bucket."
  );
}

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' " +
          "tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths)."
      );
    }
    return paths;
  }

  getPrivateObjectDir(): string {
    // Always returns "/<bucketName>" — objects are stored in the root of the bucket.
    return `/${getGcsBucketName()}`;
  }

  async searchPublicObject(filePath: string): Promise<File | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;

      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }

    return null;
  }

  async downloadObject(file: File, cacheTtlSec: number = 3600): Promise<Response> {
    const [metadata] = await file.getMetadata();
    const aclPolicy = await getObjectAclPolicy(file);
    const isPublic = aclPolicy?.visibility === "public";

    const nodeStream = file.createReadStream();
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    const headers: Record<string, string> = {
      "Content-Type": (metadata.contentType as string) || "application/octet-stream",
      "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
    };
    if (metadata.size) {
      headers["Content-Length"] = String(metadata.size);
    }

    return new Response(webStream, { headers });
  }

  async getObjectEntityUploadURL(orgId: number): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    const objectId = randomUUID();
    // Phase 4: uploads land under <orgId>/uploads/<uuid> so the read endpoint
    // can verify access without a DB lookup.
    const fullPath = `${privateObjectDir}/${orgId}/uploads/${objectId}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);

    const file = objectStorageClient.bucket(bucketName).file(objectName);
    const [url] = await file.getSignedUrl({
      action: "write",
      expires: Date.now() + 900_000,
      contentType: "image/jpeg",
      version: "v4",
    });
    return url;
  }

  async getObjectEntityFile(objectPath: string): Promise<File> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return objectFile;
  }

  async uploadPhotoBuffer(buffer: Buffer, orgId: number): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    const objectId = randomUUID();
    // Phase 4: uploads land under <orgId>/uploads/<uuid>. The read endpoint
    // parses this prefix and rejects fetches from a different org's session.
    const objectName = `${orgId}/uploads/${objectId}`;
    const fullPath = `${privateObjectDir}/${objectName}`;
    const { bucketName } = parseObjectPath(fullPath);
    const file = objectStorageClient.bucket(bucketName).file(objectName);
    await file.save(buffer, { metadata: { contentType: "image/jpeg" } });
    logger.info({ objectName, bucketName, bytes: buffer.length }, "[storage] photo uploaded");
    return objectName;
  }

  async getSignedReadUrl(imageUrl: string): Promise<string | null> {
    try {
      const entityDir = this.getPrivateObjectDir();
      const fullPath = `${entityDir}/${imageUrl}`;
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const file = objectStorageClient.bucket(bucketName).file(objectName);
      const [exists] = await file.exists();
      if (!exists) {
        logger.warn({ objectName }, "[storage] object not found in GCS");
        return null;
      }
      const [url] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 10 * 60 * 1000,
        version: "v4",
      });
      return url;
    } catch (err) {
      logger.error({ imageUrl, err }, "[storage] getSignedReadUrl failed");
      return null;
    }
  }

  // Skips the existence check — use for list endpoints where signing many objects
  // in parallel would otherwise require N extra GCS network calls. The client
  // handles a bad URL gracefully via onError.
  async getSignedReadUrlFast(imageUrl: string): Promise<string | null> {
    try {
      const { bucketName, objectName } = parseObjectPath(`${this.getPrivateObjectDir()}/${imageUrl}`);
      const [url] = await objectStorageClient.bucket(bucketName).file(objectName).getSignedUrl({
        action: "read",
        expires: Date.now() + 10 * 60 * 1000,
        version: "v4",
      });
      return url;
    } catch {
      return null;
    }
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }

    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;

    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir.endsWith("/")) {
      objectEntityDir = `${objectEntityDir}/`;
    }

    if (!rawObjectPath.startsWith(objectEntityDir)) {
      return rawObjectPath;
    }

    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: File;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}

/**
 * Delete every GCS object under the `<orgId>/` prefix. Used by the
 * super-admin org-delete cascade so a deleted org doesn't leave orphaned
 * blobs (storage cost) or photos that could be re-exposed if the numeric
 * org id were ever recycled.
 *
 * Idempotent — if the prefix is empty, this is a no-op.
 *
 * Best-effort by design: the caller should log+swallow errors rather than
 * fail the response, because the DB cascade has already committed by the
 * time this runs and we don't want a GCS hiccup turning a successful delete
 * into a misleading 500. Returns the number of object names that existed
 * under the prefix (before deletion was attempted).
 */
export async function deleteObjectsByOrgPrefix(orgId: number): Promise<number> {
  if (!Number.isInteger(orgId) || orgId <= 0) {
    throw new Error(`deleteObjectsByOrgPrefix: invalid orgId ${orgId}`);
  }
  const bucketName = getGcsBucketName();
  const bucket = objectStorageClient.bucket(bucketName);
  const prefix = `${orgId}/`;
  const [files] = await bucket.getFiles({ prefix });
  if (files.length === 0) return 0;
  await bucket.deleteFiles({ prefix });
  return files.length;
}

/**
 * Delete a single GCS object by its key (e.g. `1/uploads/abc-def-...`).
 * Called by the issue-delete handler so a deleted issue's photo doesn't
 * sit in storage as an orphan blob (matches user expectation and the
 * privacy policy's promise around per-issue data removal).
 *
 * Best-effort: returns `true` on success or if the file didn't exist
 * (idempotent), `false` if the delete call threw. The caller should
 * log a warning on `false` but not fail the surrounding DB operation —
 * the issue row has already been deleted by the time this runs.
 */
export async function deleteObjectByKey(objectKey: string): Promise<boolean> {
  if (!objectKey) return false;
  const bucketName = getGcsBucketName();
  const bucket = objectStorageClient.bucket(bucketName);
  try {
    await bucket.file(objectKey).delete({ ignoreNotFound: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Extracts the organization id from a stored object path.
 *
 * - New (Phase 4) paths look like `<orgId>/uploads/<uuid>` and return the orgId.
 * - Legacy flat paths `uploads/<uuid>` predate Phase 4 — they return null and
 *   the caller must allow them through (we can't determine ownership from the
 *   path alone). UUIDs are unguessable so the residual exposure is small;
 *   over time these naturally age out as issues resolve.
 */
export function parseOrgFromObjectPath(objectName: string): number | null {
  // Strip a leading slash if present so both "1/uploads/..." and "/1/uploads/..." work.
  const stripped = objectName.startsWith("/") ? objectName.slice(1) : objectName;
  const parts = stripped.split("/");
  if (parts.length < 2) return null;
  if (parts[0] === "uploads") return null; // legacy flat path
  const n = Number(parts[0]);
  if (Number.isInteger(n) && n > 0 && parts[1] === "uploads") return n;
  return null;
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}

