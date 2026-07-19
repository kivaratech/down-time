import { Router, type IRouter } from "express";
import { db, organizationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireOrgAdmin } from "../lib/auth";
import { UpdateOrganizationSettingsBody } from "@workspace/api-zod";

const router: IRouter = Router();

// Fallback when the caller has no org row to read (super_admin, whose
// organizationId is NULL). Matches the column default so the dashboard still
// renders a sensible Aging count instead of erroring.
const DEFAULT_AGING_THRESHOLD_DAYS = 14;

// GET /api/organization/settings — any authenticated member of the org.
// Supervisors need this to render the dashboard Aging tile, so it is not
// admin-gated; only the PATCH is.
router.get("/organization/settings", async (req, res) => {
  const principal = requireAuth(req, res);
  if (!principal) return;

  if (principal.organizationId == null) {
    res.json({ agingThresholdDays: DEFAULT_AGING_THRESHOLD_DAYS });
    return;
  }

  const [org] = await db
    .select({ agingThresholdDays: organizationsTable.agingThresholdDays })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, principal.organizationId))
    .limit(1);

  res.json({
    agingThresholdDays: org?.agingThresholdDays ?? DEFAULT_AGING_THRESHOLD_DAYS,
  });
});

// PATCH /api/organization/settings — admin only, scoped to the admin's own org.
router.patch("/organization/settings", async (req, res) => {
  const admin = requireOrgAdmin(req, res);
  if (!admin) return;

  const parsed = UpdateOrganizationSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Aging threshold must be between 1 and 365 days" });
    return;
  }

  const [updated] = await db
    .update(organizationsTable)
    .set({ agingThresholdDays: parsed.data.agingThresholdDays })
    .where(eq(organizationsTable.id, admin.organizationId))
    .returning({ agingThresholdDays: organizationsTable.agingThresholdDays });

  if (!updated) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }

  res.json({ agingThresholdDays: updated.agingThresholdDays });
});

export default router;
