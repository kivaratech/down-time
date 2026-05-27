import express, { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import {
  ObjectStorageService,
  ObjectNotFoundError,
  parseOrgFromObjectPath,
} from "../lib/objectStorage";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/photo
 *
 * Upload a JPEG photo via the server (proxy to GCS).
 * The client sends the raw JPEG body with Authorization header.
 * The server writes directly to GCS under <orgId>/uploads/<uuid> and returns the objectPath.
 */
router.post("/storage/uploads/photo", express.raw({ type: "*/*", limit: "10mb" }), async (req: Request, res: Response) => {
  const principal = requireAuth(req, res);
  if (!principal) return;
  if (principal.organizationId == null) {
    // super_admin has no org context; they'd use a Phase 3 endpoint scoped
    // to a specific org to upload on behalf of a customer.
    res.status(400).json({ error: "Organization context required" });
    return;
  }

  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    res.status(400).json({ error: "No photo data received" });
    return;
  }

  try {
    const objectPath = await objectStorageService.uploadPhotoBuffer(req.body, principal.organizationId);
    req.log.info({ objectPath, bytes: req.body.length }, "photo uploaded via proxy");
    res.json({ objectPath });
  } catch (error) {
    req.log.error({ err: error }, "Photo proxy upload failed");
    res.status(500).json({ error: "Failed to upload photo" });
  }
});

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  const principal = requireAuth(req, res);
  if (!principal) return;
  if (principal.organizationId == null) {
    res.status(400).json({ error: "Organization context required" });
    return;
  }

  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;

    const uploadURL = await objectStorageService.getObjectEntityUploadURL(principal.organizationId);
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    req.log.info({ objectPath, uploadURLIsHttps: uploadURL.startsWith("https://") }, "upload URL generated");

    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR. Auth required.
 *
 * For Phase 4 (org-prefixed) paths like `<orgId>/uploads/<uuid>`, the
 * principal's organizationId must match the orgId in the path (super_admin
 * bypasses). Legacy flat paths like `uploads/<uuid>` predate Phase 4 and stay
 * readable by any authenticated principal — see parseOrgFromObjectPath for the
 * rationale.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const principal = requireAuth(req, res);
    if (!principal) return;

    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;

    const orgInPath = parseOrgFromObjectPath(wildcardPath);
    if (orgInPath !== null) {
      const isSuperAdmin = principal.kind === "supervisor" && principal.role === "super_admin";
      if (!isSuperAdmin && principal.organizationId !== orgInPath) {
        res.status(403).json({ error: "Access denied" });
        return;
      }
    }
    // Legacy path (no orgId prefix): allow any authenticated principal.

    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
