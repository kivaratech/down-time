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
 * Primary:  GCS_BUCKET_NAME — just the bucket name, e.g. "downtime-77b0a.appspot.com"
 *           Firebase Storage buckets end in .appspot.com, NOT .firebasestorage.app
 * Fallback: PRIVATE_OBJECT_DIR — legacy path-style var, e.g. "/downtime-77b0a.appspot.com"
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
      "Set it to the GCS bucket name, e.g. GCS_BUCKET_NAME=downtime-77b0a.appspot.com\n" +
      "  NOTE: Firebase Storage bucket names end in .appspot.com — NOT .firebasestorage.app\n" +
      "  You can find the bucket name in the Firebase console under Storage."
  );
}

/**
 * Validate that the configured GCS bucket exists and is accessible.
 * Call this at server startup so misconfigurations fail fast with a clear message.
 */
export async function validateStorageConfig(): Promise<void> {
  const bucketName = getGcsBucketName();
  logger.info({ bucketName }, "[storage] Configured GCS bucket");

  try {
    const [exists] = await objectStorageClient.bucket(bucketName).exists();
    if (!exists) {
      throw new Error(
        `[storage] GCS bucket not found: "${bucketName}"\n` +
          "  Check GCS_BUCKET_NAME — Firebase Storage bucket names end in .appspot.com, not .firebasestorage.app\n" +
          "  Also verify GCS_SERVICE_ACCOUNT_JSON has Storage access to this bucket."
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Rethrow bucket-not-found errors verbatim; wrap permission/network errors
    if (msg.startsWith("[storage] GCS bucket not found")) throw err;
    throw new Error(
      `[storage] Failed to verify GCS bucket "${bucketName}": ${msg}\n` +
        "  Check GCS_SERVICE_ACCOUNT_JSON has the Storage Object Admin role on this bucket."
    );
  }

  logger.info({ bucketName }, "[storage] GCS bucket verified OK");
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

  async getObjectEntityUploadURL(): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;
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

  async uploadPhotoBuffer(buffer: Buffer): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    const objectId = randomUUID();
    const objectName = `uploads/${objectId}`;
    const fullPath = `${privateObjectDir}/${objectName}`;
    const { bucketName } = parseObjectPath(fullPath);
    const file = objectStorageClient.bucket(bucketName).file(objectName);
    await file.save(buffer, { metadata: { contentType: "image/jpeg" } });
    console.log("[storage] uploadPhotoBuffer: saved", objectName, "to", bucketName, "bytes:", buffer.length);
    return objectName;
  }

  async getSignedReadUrl(imageUrl: string): Promise<string | null> {
    try {
      const entityDir = this.getPrivateObjectDir();
      const fullPath = `${entityDir}/${imageUrl}`;
      const { bucketName, objectName } = parseObjectPath(fullPath);
      console.log("[storage] getSignedReadUrl bucket:", bucketName, "object:", objectName);
      const file = objectStorageClient.bucket(bucketName).file(objectName);
      const [exists] = await file.exists();
      if (!exists) {
        console.error("[storage] getSignedReadUrl: object does not exist in GCS:", objectName);
        return null;
      }
      const [url] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 10 * 60 * 1000,
        version: "v4",
      });
      console.log("[storage] getSignedReadUrl: signed URL generated ok for:", objectName);
      return url;
    } catch (err) {
      console.error("[storage] getSignedReadUrl failed for:", imageUrl, "-", (err as Error)?.message ?? String(err));
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

