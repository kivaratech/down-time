import { Router, type IRouter } from "express";
import { and, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import {
  db,
  organizationsTable,
  restaurantsTable,
  restaurantSessionsTable,
  supervisorsTable,
  supervisorSessionsTable,
  equipmentItemsTable,
  issuesTable,
  commentsTable,
  supervisorRestaurantsTable,
  deviceSessionsTable,
  pairingCodesTable,
} from "@workspace/db";
import {
  EQUIPMENT_TEMPLATES,
  DEFAULT_EQUIPMENT_TEMPLATE_KEY,
  type EquipmentTemplateKey,
} from "@workspace/db/equipment-templates";
import { hashPassword, requireSuperAdmin } from "../lib/auth";
import { deleteObjectsByOrgPrefix } from "../lib/objectStorage";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// 16 random bytes -> 22-character URL-safe string. Used for one-time
// passwords returned by org-creation / add-admin / reset-password.
function generateRandomPassword(): string {
  return crypto.randomBytes(16).toString("base64url");
}

// ---------------------------------------------------------------------------
// GET /api/super-admin/equipment-templates
// Lists built-in templates so the mobile create-org form can render a picker.
// ---------------------------------------------------------------------------
router.get("/super-admin/equipment-templates", async (req, res) => {
  const admin = requireSuperAdmin(req, res);
  if (!admin) return;

  const summaries = Object.values(EQUIPMENT_TEMPLATES).map((t) => ({
    key: t.key,
    label: t.label,
    description: t.description,
    itemCount: t.items.length,
  }));
  res.json(summaries);
});

// ---------------------------------------------------------------------------
// GET /api/super-admin/organizations
// All orgs with summary counts (restaurants / admins / supervisors). Two
// grouped queries beat the N+1 from per-org subqueries.
// ---------------------------------------------------------------------------
router.get("/super-admin/organizations", async (req, res) => {
  const admin = requireSuperAdmin(req, res);
  if (!admin) return;

  const orgs = await db
    .select()
    .from(organizationsTable)
    .orderBy(organizationsTable.createdAt);

  const restaurantRows = await db
    .select({ organizationId: restaurantsTable.organizationId, c: count() })
    .from(restaurantsTable)
    .groupBy(restaurantsTable.organizationId);

  const supervisorRows = await db
    .select({
      organizationId: supervisorsTable.organizationId,
      role: supervisorsTable.role,
      c: count(),
    })
    .from(supervisorsTable)
    .groupBy(supervisorsTable.organizationId, supervisorsTable.role);

  const restaurantCounts: Record<number, number> = {};
  for (const r of restaurantRows) {
    if (r.organizationId != null) restaurantCounts[r.organizationId] = Number(r.c);
  }
  const adminCounts: Record<number, number> = {};
  const supervisorCounts: Record<number, number> = {};
  for (const s of supervisorRows) {
    if (s.organizationId == null) continue; // skip super_admin rows (null org)
    if (s.role === "admin") adminCounts[s.organizationId] = Number(s.c);
    else if (s.role === "supervisor") supervisorCounts[s.organizationId] = Number(s.c);
  }

  res.json(
    orgs.map((o) => ({
      id: o.id,
      name: o.name,
      createdAt: o.createdAt,
      restaurantCount: restaurantCounts[o.id] ?? 0,
      adminCount: adminCounts[o.id] ?? 0,
      supervisorCount: supervisorCounts[o.id] ?? 0,
    })),
  );
});

// ---------------------------------------------------------------------------
// POST /api/super-admin/organizations
// The big one: create org + seed equipment from template + create first admin,
// all in a single transaction. Returns the plaintext admin password exactly
// once — UI must surface it for the operator to copy.
// ---------------------------------------------------------------------------
const CreateOrganizationBody = z.object({
  name: z.string().min(1).max(200),
  adminUsername: z.string().min(2).max(50),
  adminName: z.string().min(1).max(100),
  // .nullish() = .nullable().optional(). Accepts string | null | undefined.
  // The openapi spec marks this field nullable:true and the mobile form
  // sends `... || null` when blank — a plain .optional() would 400 on null.
  adminEmail: z.string().email().nullish(),
  // Permissive zod + runtime check against EQUIPMENT_TEMPLATES so adding a
  // new template only requires updating the registry (and the openapi enum
  // for documentation/codegen). Otherwise we'd have to update three places.
  templateKey: z.string().optional(),
});

router.post("/super-admin/organizations", async (req, res) => {
  const admin = requireSuperAdmin(req, res);
  if (!admin) return;

  const body = CreateOrganizationBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request", details: body.error.flatten() });
    return;
  }

  const { name, adminUsername, adminName, adminEmail, templateKey } = body.data;
  const key = (templateKey ?? DEFAULT_EQUIPMENT_TEMPLATE_KEY) as EquipmentTemplateKey;
  const template = EQUIPMENT_TEMPLATES[key];
  if (!template) {
    res.status(400).json({
      error: `Unknown templateKey: ${key}. Valid: ${Object.keys(EQUIPMENT_TEMPLATES).join(", ")}`,
    });
    return;
  }

  const password = generateRandomPassword();
  const passwordHash = hashPassword(password);

  try {
    const result = await db.transaction(async (tx) => {
      const [org] = await tx
        .insert(organizationsTable)
        .values({ name })
        .returning();

      if (template.items.length > 0) {
        await tx.insert(equipmentItemsTable).values(
          template.items.map((item) => ({ ...item, organizationId: org.id })),
        );
      }

      const [newAdmin] = await tx
        .insert(supervisorsTable)
        .values({
          organizationId: org.id,
          username: adminUsername,
          passwordHash,
          name: adminName,
          email: adminEmail ?? null,
          role: "admin",
        })
        .returning();

      return { org, admin: newAdmin };
    });

    res.status(201).json({
      organization: {
        id: result.org.id,
        name: result.org.name,
        createdAt: result.org.createdAt,
      },
      admin: {
        id: result.admin.id,
        username: result.admin.username,
        name: result.admin.name,
        password,
      },
    });
  } catch (err: unknown) {
    // 23505 = postgres unique_violation. Effectively impossible for a brand-new
    // org (the supervisor unique index is per (organizationId, username)) but
    // handle defensively in case of races or future schema changes.
    if (typeof err === "object" && err !== null && (err as { code?: string }).code === "23505") {
      res.status(409).json({ error: "Username already taken" });
      return;
    }
    throw err;
  }
});

// ---------------------------------------------------------------------------
// GET /api/super-admin/organizations/:id
// Full org detail: restaurants, admins, and supervisors. Used by the mobile
// per-org detail screen.
// ---------------------------------------------------------------------------
router.get("/super-admin/organizations/:id", async (req, res) => {
  const admin = requireSuperAdmin(req, res);
  if (!admin) return;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid organization ID" });
    return;
  }

  const [org] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.id, id))
    .limit(1);
  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }

  const restaurants = await db
    .select({
      id: restaurantsTable.id,
      name: restaurantsTable.name,
      location: restaurantsTable.location,
      createdAt: restaurantsTable.createdAt,
    })
    .from(restaurantsTable)
    .where(eq(restaurantsTable.organizationId, id))
    .orderBy(restaurantsTable.createdAt);

  const users = await db
    .select({
      id: supervisorsTable.id,
      username: supervisorsTable.username,
      name: supervisorsTable.name,
      email: supervisorsTable.email,
      role: supervisorsTable.role,
      isActive: supervisorsTable.isActive,
      createdAt: supervisorsTable.createdAt,
    })
    .from(supervisorsTable)
    .where(eq(supervisorsTable.organizationId, id))
    .orderBy(supervisorsTable.createdAt);

  const orgAdmins = users.filter((u) => u.role === "admin");
  const orgSupervisors = users.filter((u) => u.role === "supervisor");

  res.json({
    id: org.id,
    name: org.name,
    createdAt: org.createdAt,
    restaurants,
    admins: orgAdmins,
    supervisors: orgSupervisors,
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/super-admin/organizations/:id
// Rename an organization. Restaurants/supervisors/issues follow automatically
// because every FK to the org is on organizationId (numeric), not on the name.
// ---------------------------------------------------------------------------
const RenameOrganizationBody = z.object({
  name: z.string().min(1).max(200),
});

router.patch("/super-admin/organizations/:id", async (req, res) => {
  const admin = requireSuperAdmin(req, res);
  if (!admin) return;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid organization ID" });
    return;
  }

  const body = RenameOrganizationBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request", details: body.error.flatten() });
    return;
  }

  const [updated] = await db
    .update(organizationsTable)
    .set({ name: body.data.name.trim() })
    .where(eq(organizationsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }

  res.json({
    id: updated.id,
    name: updated.name,
    createdAt: updated.createdAt,
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/super-admin/organizations/:id
// Hard delete with application-level cascade in one transaction. The Phase 1+
// FK constraints don't declare ON DELETE CASCADE — handling it here avoids a
// schema migration. If a new table is added that FKs to organizations OR to
// any of its child tables (restaurants/supervisors/issues/equipment_items),
// register it here.
// ---------------------------------------------------------------------------
router.delete("/super-admin/organizations/:id", async (req, res) => {
  const admin = requireSuperAdmin(req, res);
  if (!admin) return;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid organization ID" });
    return;
  }

  const [org] = await db
    .select({ id: organizationsTable.id })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, id))
    .limit(1);
  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }

  await db.transaction(async (tx) => {
    const restaurants = await tx
      .select({ id: restaurantsTable.id })
      .from(restaurantsTable)
      .where(eq(restaurantsTable.organizationId, id));
    const restaurantIds = restaurants.map((r) => r.id);

    const supervisors = await tx
      .select({ id: supervisorsTable.id })
      .from(supervisorsTable)
      .where(eq(supervisorsTable.organizationId, id));
    const supervisorIds = supervisors.map((s) => s.id);

    const issues = await tx
      .select({ id: issuesTable.id })
      .from(issuesTable)
      .where(eq(issuesTable.organizationId, id));
    const issueIds = issues.map((i) => i.id);

    // Leaves first — anything that FKs into a child table of organizations.
    if (issueIds.length > 0) {
      await tx.delete(commentsTable).where(inArray(commentsTable.issueId, issueIds));
    }
    if (supervisorIds.length > 0) {
      await tx
        .delete(supervisorRestaurantsTable)
        .where(inArray(supervisorRestaurantsTable.supervisorId, supervisorIds));
      await tx
        .delete(supervisorSessionsTable)
        .where(inArray(supervisorSessionsTable.supervisorId, supervisorIds));
    }
    if (restaurantIds.length > 0) {
      await tx
        .delete(deviceSessionsTable)
        .where(inArray(deviceSessionsTable.restaurantId, restaurantIds));
      await tx
        .delete(pairingCodesTable)
        .where(inArray(pairingCodesTable.restaurantId, restaurantIds));
      // Legacy table — predates device_sessions; FK on restaurant_id has no
      // ON DELETE CASCADE, so leftover rows would block the restaurants
      // delete below and roll back the entire transaction.
      await tx
        .delete(restaurantSessionsTable)
        .where(inArray(restaurantSessionsTable.restaurantId, restaurantIds));
    }

    // Mid-level rows owned directly by the organization.
    await tx.delete(issuesTable).where(eq(issuesTable.organizationId, id));
    await tx.delete(equipmentItemsTable).where(eq(equipmentItemsTable.organizationId, id));
    await tx.delete(restaurantsTable).where(eq(restaurantsTable.organizationId, id));
    await tx.delete(supervisorsTable).where(eq(supervisorsTable.organizationId, id));

    // Org itself last.
    await tx.delete(organizationsTable).where(eq(organizationsTable.id, id));
  });

  // After the DB cascade commits, clean up the org's GCS prefix so deleted
  // tenants don't leave orphaned photo blobs (storage cost + the small risk
  // of cross-tenant exposure if the numeric orgId is ever recycled).
  // Best-effort: the DB delete already succeeded, so we never fail the
  // response on a GCS hiccup — just log and move on.
  try {
    const photoCount = await deleteObjectsByOrgPrefix(id);
    if (photoCount > 0) {
      logger.info({ orgId: id, photoCount }, "deleted GCS photos for deleted org");
    }
  } catch (err) {
    logger.warn(
      { orgId: id, err },
      "GCS cleanup failed after org delete; orphaned blobs may remain under <orgId>/",
    );
  }

  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// POST /api/super-admin/organizations/:id/restaurants
// Add a restaurant to an org. (Org admins can't add restaurants themselves
// today — by design, gating per-restaurant scope on super-admin.)
// ---------------------------------------------------------------------------
const CreateOrgRestaurantBody = z.object({
  name: z.string().min(1).max(200),
  location: z.string(),
});

router.post("/super-admin/organizations/:id/restaurants", async (req, res) => {
  const admin = requireSuperAdmin(req, res);
  if (!admin) return;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid organization ID" });
    return;
  }

  const body = CreateOrgRestaurantBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request", details: body.error.flatten() });
    return;
  }

  const [org] = await db
    .select({ id: organizationsTable.id })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, id))
    .limit(1);
  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }

  const [restaurant] = await db
    .insert(restaurantsTable)
    .values({
      organizationId: id,
      name: body.data.name,
      location: body.data.location,
    })
    .returning();

  res.status(201).json({
    id: restaurant.id,
    name: restaurant.name,
    location: restaurant.location,
    createdAt: restaurant.createdAt,
  });
});

// ---------------------------------------------------------------------------
// POST /api/super-admin/organizations/:id/admins
// Add another admin to an existing org. Returns plaintext password once.
// ---------------------------------------------------------------------------
const CreateOrgAdminBody = z.object({
  username: z.string().min(2).max(50),
  name: z.string().min(1).max(100),
  // .nullish() matches the openapi nullable:true field and the mobile form
  // which sends `email: form.email.trim() || null` when blank.
  email: z.string().email().nullish(),
});

router.post("/super-admin/organizations/:id/admins", async (req, res) => {
  const admin = requireSuperAdmin(req, res);
  if (!admin) return;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid organization ID" });
    return;
  }

  const body = CreateOrgAdminBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request", details: body.error.flatten() });
    return;
  }

  const [org] = await db
    .select({ id: organizationsTable.id })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, id))
    .limit(1);
  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }

  // Per-org uniqueness check (matches the composite (organizationId, username)
  // unique index added in Phase 2 PR-3).
  const [existing] = await db
    .select({ id: supervisorsTable.id })
    .from(supervisorsTable)
    .where(
      and(
        eq(supervisorsTable.organizationId, id),
        eq(supervisorsTable.username, body.data.username),
      ),
    )
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "Username already taken in this organization" });
    return;
  }

  const password = generateRandomPassword();
  const passwordHash = hashPassword(password);

  let newAdmin: typeof supervisorsTable.$inferSelect;
  try {
    const [created] = await db
      .insert(supervisorsTable)
      .values({
        organizationId: id,
        username: body.data.username,
        passwordHash,
        name: body.data.name,
        email: body.data.email ?? null,
        role: "admin",
      })
      .returning();
    newAdmin = created;
  } catch (err: unknown) {
    // 23505 = postgres unique_violation. The pre-check above is racy under
    // concurrent identical requests — without this catch the second request
    // crashes with a generic 500 instead of the friendlier 409.
    if (
      typeof err === "object" &&
      err !== null &&
      (err as { code?: string }).code === "23505"
    ) {
      res.status(409).json({ error: "Username already taken in this organization" });
      return;
    }
    throw err;
  }

  res.status(201).json({
    id: newAdmin.id,
    username: newAdmin.username,
    name: newAdmin.name,
    password,
  });
});

// ---------------------------------------------------------------------------
// POST /api/super-admin/organizations/:id/users/:userId/reset-password
// Generate a fresh random password for any user (admin OR supervisor) in the
// org, and revoke their existing sessions so they have to re-authenticate.
// Useful for recovering a locked-out customer admin.
// ---------------------------------------------------------------------------
router.post(
  "/super-admin/organizations/:id/users/:userId/reset-password",
  async (req, res) => {
    const admin = requireSuperAdmin(req, res);
    if (!admin) return;

    const orgId = parseInt(req.params.id, 10);
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(orgId) || isNaN(userId)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const [target] = await db
      .select({ id: supervisorsTable.id })
      .from(supervisorsTable)
      .where(
        and(
          eq(supervisorsTable.id, userId),
          eq(supervisorsTable.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!target) {
      res.status(404).json({ error: "User not found in this organization" });
      return;
    }

    const password = generateRandomPassword();
    const passwordHash = hashPassword(password);

    await db
      .update(supervisorsTable)
      .set({ passwordHash })
      .where(eq(supervisorsTable.id, userId));

    // Revoke all sessions so the user must re-authenticate with the new password.
    await db
      .delete(supervisorSessionsTable)
      .where(eq(supervisorSessionsTable.supervisorId, userId));

    res.json({ password });
  },
);

export default router;
