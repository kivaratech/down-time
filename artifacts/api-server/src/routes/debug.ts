import { Router, type IRouter } from "express";
import { ObjectStorageService, objectStorageClient } from "../lib/objectStorage";

// TEMPORARY diagnostic — verifying GCS upload via the real code path. Remove after.
const router: IRouter = Router();
const svc = new ObjectStorageService();

async function timed<T>(
  fn: () => Promise<T>,
): Promise<{ ok: boolean; ms: number; value?: T; error?: string }> {
  const start = Date.now();
  try {
    const value = await fn();
    return { ok: true, ms: Date.now() - start, value };
  } catch (err) {
    const e = err as { name?: string; message?: string; code?: unknown };
    return {
      ok: false,
      ms: Date.now() - start,
      error: `${e?.name ?? "Error"}: ${e?.message ?? String(err)}${e?.code != null ? ` (code=${String(e.code)})` : ""}`,
    };
  }
}

router.get("/_debug/upload", async (_req, res) => {
  const out: Record<string, unknown> = {};
  let uploadedPath: string | null = null;

  // Exercise the REAL uploadPhotoBuffer (signed PUT + native fetch).
  out.upload = await timed(async () => {
    uploadedPath = await svc.uploadPhotoBuffer(Buffer.from("debug upload test"), 999999);
    return { path: uploadedPath };
  });

  // Confirm it landed, then clean it up.
  if (uploadedPath) {
    const bucketName = process.env.GCS_BUCKET_NAME?.trim() || "";
    out.readback = await timed(async () => {
      const [exists] = await objectStorageClient.bucket(bucketName).file(uploadedPath!).exists();
      return { exists };
    });
    out.cleanup = await timed(async () => {
      await objectStorageClient.bucket(bucketName).file(uploadedPath!).delete({ ignoreNotFound: true });
      return { deleted: true };
    });
  }

  res.json(out);
});

export default router;
