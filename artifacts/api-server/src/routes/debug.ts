import { Router, type IRouter } from "express";
import { objectStorageClient } from "../lib/objectStorage";

// TEMPORARY diagnostic — verifying GCS WRITE (upload) works. Remove after.
const router: IRouter = Router();

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
  const bucketName = process.env.GCS_BUCKET_NAME?.trim() || "(unset)";
  out.bucketName = bucketName;
  const testName = `_debug/test-${Date.now()}.txt`;

  out.write = await timed(async () => {
    const file = objectStorageClient.bucket(bucketName).file(testName);
    await file.save(Buffer.from("debug write test"), {
      metadata: { contentType: "text/plain" },
    });
    return { wrote: testName };
  });

  out.readback = await timed(async () => {
    const [exists] = await objectStorageClient.bucket(bucketName).file(testName).exists();
    return { exists };
  });

  out.cleanup = await timed(async () => {
    await objectStorageClient
      .bucket(bucketName)
      .file(testName)
      .delete({ ignoreNotFound: true });
    return { deleted: true };
  });

  res.json(out);
});

export default router;
