import { Router, type IRouter } from "express";
import { promises as dns } from "node:dns";

// ───────────────────────────────────────────────────────────────────────────
// TEMPORARY diagnostic router. Added to pinpoint why the server can't reach
// Google's OAuth token endpoint ("Premature close"), which broke GCS photo
// storage. Probes the network path WITHOUT credentials so we can tell a
// network/TLS failure apart from a credential/library failure. Unauthenticated
// but returns only connectivity diagnostics (no secrets). REMOVE once the GCS
// connectivity issue is resolved.
// ───────────────────────────────────────────────────────────────────────────

const router: IRouter = Router();

async function timed<T>(
  fn: () => Promise<T>,
): Promise<{ ok: boolean; ms: number; value?: T; error?: string }> {
  const start = Date.now();
  try {
    const value = await fn();
    return { ok: true, ms: Date.now() - start, value };
  } catch (err) {
    return {
      ok: false,
      ms: Date.now() - start,
      error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    };
  }
}

async function probeFetch(url: string, init?: RequestInit) {
  return timed(async () => {
    const r = await fetch(url, init);
    // Read the body — "Premature close" surfaces during the body read, so we
    // must consume it to reproduce the failure the GCS client hits.
    const text = await r
      .text()
      .catch((e) => `<<body read failed: ${e instanceof Error ? e.message : String(e)}>>`);
    return { status: r.status, bodyLen: text.length, bodySnippet: text.slice(0, 160) };
  });
}

router.get("/_debug/net", async (_req, res) => {
  const out: Record<string, unknown> = {
    node: process.version,
  };

  out.dns_googleapis_v4 = await timed(() => dns.resolve4("www.googleapis.com"));
  out.dns_googleapis_v6 = await timed(() => dns.resolve6("www.googleapis.com"));
  out.dns_oauth2_v4 = await timed(() => dns.resolve4("oauth2.googleapis.com"));

  // Control: general HTTPS to a non-Google host.
  out.https_example = await probeFetch("https://example.com/");
  // Control: a host we know works in production (Expo push).
  out.https_exphost = await probeFetch("https://exp.host/");
  // The actual suspects:
  out.https_google_root = await probeFetch("https://www.googleapis.com/");
  out.https_token_www = await probeFetch("https://www.googleapis.com/oauth2/v4/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=invalid_probe",
  });
  out.https_token_new = await probeFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=invalid_probe",
  });

  res.json(out);
});

export default router;
