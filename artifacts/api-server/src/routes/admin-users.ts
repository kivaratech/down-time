import { Router, type IRouter } from "express";
import { db, supervisorsTable, supervisorSessionsTable, supervisorRestaurantsTable, restaurantsTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { hashPassword, requireOrgAdmin } from "../lib/auth";
import { validateEmailMx } from "../lib/emailValidation";
import { z } from "zod";

const router: IRouter = Router();

/**
 * Returns the supervisor row if it exists AND belongs to the admin's org.
 * Returning null lets the caller respond with 404 — cross-org users look
 * identical to non-existent users (no information leak).
 */
async function findUserInAdminOrg(userId: number, adminOrgId: number) {
  const [u] = await db
    .select({
      id: supervisorsTable.id,
      role: supervisorsTable.role,
      isActive: supervisorsTable.isActive,
    })
    .from(supervisorsTable)
    .where(
      and(
        eq(supervisorsTable.id, userId),
        eq(supervisorsTable.organizationId, adminOrgId),
      ),
    )
    .limit(1);
  return u ?? null;
}

// GET /api/admin/users — list supervisors in the admin's org, with assignments
router.get("/admin/users", async (req, res) => {
  const admin = requireOrgAdmin(req, res);
  if (!admin) return;

  const users = await db
    .select({
      id: supervisorsTable.id,
      name: supervisorsTable.name,
      email: supervisorsTable.email,
      role: supervisorsTable.role,
      specialty: supervisorsTable.specialty,
      isActive: supervisorsTable.isActive,
      createdAt: supervisorsTable.createdAt,
    })
    .from(supervisorsTable)
    .where(eq(supervisorsTable.organizationId, admin.organizationId))
    .orderBy(supervisorsTable.createdAt);

  const userIds = users.map((u) => u.id);
  const assignments = userIds.length > 0
    ? await db
        .select({
          supervisorId: supervisorRestaurantsTable.supervisorId,
          restaurantId: supervisorRestaurantsTable.restaurantId,
        })
        .from(supervisorRestaurantsTable)
        .where(inArray(supervisorRestaurantsTable.supervisorId, userIds))
    : [];

  const assignmentMap: Record<number, number[]> = {};
  for (const a of assignments) {
    if (!assignmentMap[a.supervisorId]) assignmentMap[a.supervisorId] = [];
    assignmentMap[a.supervisorId].push(a.restaurantId);
  }

  const result = users.map((u) => ({ ...u, restaurantIds: assignmentMap[u.id] ?? [] }));
  res.json(result);
});

const CreateUserBody = z.object({
  password: z.string().min(6),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(["supervisor", "admin"]).default("supervisor"),
  specialty: z.enum(["equipment", "technology", "both"]).default("both"),
});

// POST /api/admin/users — create a new supervisor account in the admin's org
router.post("/admin/users", async (req, res) => {
  const admin = requireOrgAdmin(req, res);
  if (!admin) return;

  const body = CreateUserBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request", details: body.error.flatten() });
    return;
  }

  const { password, name, role, specialty } = body.data;
  // Normalize email — login lowercases too, so signup must match.
  const email = body.data.email.trim().toLowerCase();

  // Layer 2: MX record check (catches "gmial.com" etc.).
  const mx = await validateEmailMx(email);
  if (!mx.ok) {
    res.status(400).json({ error: mx.reason });
    return;
  }

  // Email is GLOBALLY unique (one person, one account).
  const [existing] = await db
    .select({ id: supervisorsTable.id })
    .from(supervisorsTable)
    .where(eq(supervisorsTable.email, email))
    .limit(1);

  if (existing) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const passwordHash = hashPassword(password);
  const [newUser] = await db
    .insert(supervisorsTable)
    .values({
      organizationId: admin.organizationId,
      email,
      passwordHash,
      name,
      role,
      // Admins always receive all notifications, so their specialty is
      // irrelevant; pin it to "both" so it's never a confusing stored value.
      specialty: role === "admin" ? "both" : specialty,
    })
    .returning({
      id: supervisorsTable.id,
      name: supervisorsTable.name,
      email: supervisorsTable.email,
      role: supervisorsTable.role,
      specialty: supervisorsTable.specialty,
      isActive: supervisorsTable.isActive,
      createdAt: supervisorsTable.createdAt,
    });

  res.status(201).json({ ...newUser, restaurantIds: [] });
});

const UpdateUserBody = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  role: z.enum(["supervisor", "admin"]).optional(),
  specialty: z.enum(["equipment", "technology", "both"]).optional(),
});

// PATCH /api/admin/users/:id — update name/email/role (same org only)
router.patch("/admin/users/:id", async (req, res) => {
  const admin = requireOrgAdmin(req, res);
  if (!admin) return;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const target = await findUserInAdminOrg(id, admin.organizationId);
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const body = UpdateUserBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request", details: body.error.flatten() });
    return;
  }

  const { name, role, specialty } = body.data;
  const email = body.data.email ? body.data.email.trim().toLowerCase() : undefined;

  if (email !== undefined) {
    const mx = await validateEmailMx(email);
    if (!mx.ok) {
      res.status(400).json({ error: mx.reason });
      return;
    }
    // Global email uniqueness — same as on create.
    const [conflict] = await db
      .select({ id: supervisorsTable.id })
      .from(supervisorsTable)
      .where(eq(supervisorsTable.email, email))
      .limit(1);
    if (conflict && conflict.id !== id) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }
  }

  const updates: Record<string, any> = {};
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email;
  if (role !== undefined) updates.role = role;
  if (specialty !== undefined) updates.specialty = specialty;
  // Switching a user to admin makes specialty moot (admins get everything) —
  // normalize to "both" so the stored value can't be misleading.
  if (role === "admin") updates.specialty = "both";

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [updated] = await db
    .update(supervisorsTable)
    .set(updates)
    .where(eq(supervisorsTable.id, id))
    .returning({
      id: supervisorsTable.id,
      name: supervisorsTable.name,
      email: supervisorsTable.email,
      role: supervisorsTable.role,
      specialty: supervisorsTable.specialty,
      isActive: supervisorsTable.isActive,
      createdAt: supervisorsTable.createdAt,
    });

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(updated);
});

// POST /api/admin/users/:id/deactivate — soft-deactivate the user and revoke sessions
router.post("/admin/users/:id/deactivate", async (req, res) => {
  const admin = requireOrgAdmin(req, res);
  if (!admin) return;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  if (id === admin.supervisorId) {
    res.status(400).json({ error: "You cannot deactivate your own account" });
    return;
  }

  const target = await findUserInAdminOrg(id, admin.organizationId);
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await db
    .update(supervisorsTable)
    .set({ isActive: false })
    .where(eq(supervisorsTable.id, id));

  await db.delete(supervisorSessionsTable).where(eq(supervisorSessionsTable.supervisorId, id));

  res.json({ success: true });
});

// DELETE /api/admin/users/:id — permanently delete a DEACTIVATED user (same org).
// Two-step on purpose: deactivate first (freeze, reversible), then delete
// (permanent). Blocking delete on active users prevents one accidental tap
// from destroying an account. Deleting frees the user's email for reuse —
// emails are globally unique, so a deactivated row otherwise locks the
// address forever.
router.delete("/admin/users/:id", async (req, res) => {
  const admin = requireOrgAdmin(req, res);
  if (!admin) return;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  if (id === admin.supervisorId) {
    res.status(400).json({ error: "You cannot delete your own account" });
    return;
  }

  const target = await findUserInAdminOrg(id, admin.organizationId);
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (target.isActive) {
    res.status(400).json({ error: "Deactivate the user before deleting them" });
    return;
  }

  // Cascade: sessions and restaurant assignments have no FK action, so
  // delete them explicitly. supervisor_devices has ON DELETE CASCADE and
  // notification_attempts.supervisor_id is ON DELETE SET NULL (keeps the
  // notification history), so both self-clean.
  await db.transaction(async (tx) => {
    await tx
      .delete(supervisorSessionsTable)
      .where(eq(supervisorSessionsTable.supervisorId, id));
    await tx
      .delete(supervisorRestaurantsTable)
      .where(eq(supervisorRestaurantsTable.supervisorId, id));
    await tx.delete(supervisorsTable).where(eq(supervisorsTable.id, id));
  });

  res.json({ success: true });
});

// POST /api/admin/users/:id/activate — re-enable a deactivated supervisor (same org)
router.post("/admin/users/:id/activate", async (req, res) => {
  const admin = requireOrgAdmin(req, res);
  if (!admin) return;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const target = await findUserInAdminOrg(id, admin.organizationId);
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await db
    .update(supervisorsTable)
    .set({ isActive: true })
    .where(eq(supervisorsTable.id, id));

  res.json({ success: true });
});

const ResetPasswordBody = z.object({
  newPassword: z.string().min(6),
});

// POST /api/admin/users/:id/reset-password — same-org only
router.post("/admin/users/:id/reset-password", async (req, res) => {
  const admin = requireOrgAdmin(req, res);
  if (!admin) return;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const target = await findUserInAdminOrg(id, admin.organizationId);
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const body = ResetPasswordBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "New password must be at least 6 characters" });
    return;
  }

  const passwordHash = hashPassword(body.data.newPassword);

  await db
    .update(supervisorsTable)
    .set({ passwordHash })
    .where(eq(supervisorsTable.id, id));

  await db.delete(supervisorSessionsTable).where(eq(supervisorSessionsTable.supervisorId, id));

  res.json({ success: true });
});

// GET /api/admin/users/:id/restaurants — get assigned restaurant IDs (same org only)
router.get("/admin/users/:id/restaurants", async (req, res) => {
  const admin = requireOrgAdmin(req, res);
  if (!admin) return;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const target = await findUserInAdminOrg(id, admin.organizationId);
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const rows = await db
    .select({ restaurantId: supervisorRestaurantsTable.restaurantId })
    .from(supervisorRestaurantsTable)
    .where(eq(supervisorRestaurantsTable.supervisorId, id));

  res.json({ restaurantIds: rows.map((r) => r.restaurantId) });
});

const UpdateRestaurantsBody = z.object({
  restaurantIds: z.array(z.number().int().positive()),
});

// PUT /api/admin/users/:id/restaurants — replace assignments (same org both sides)
router.put("/admin/users/:id/restaurants", async (req, res) => {
  const admin = requireOrgAdmin(req, res);
  if (!admin) return;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const target = await findUserInAdminOrg(id, admin.organizationId);
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const body = UpdateRestaurantsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request", details: body.error.flatten() });
    return;
  }

  const { restaurantIds } = body.data;

  // Verify every restaurant exists AND belongs to the admin's org. This blocks
  // an admin from assigning their user to a restaurant in another org.
  if (restaurantIds.length > 0) {
    const found = await db
      .select({ id: restaurantsTable.id })
      .from(restaurantsTable)
      .where(
        and(
          inArray(restaurantsTable.id, restaurantIds),
          eq(restaurantsTable.organizationId, admin.organizationId),
        ),
      );
    if (found.length !== restaurantIds.length) {
      res.status(400).json({ error: "One or more restaurant IDs are invalid" });
      return;
    }
  }

  // Replace all assignments atomically (delete + insert) in a single
  // transaction so a failure mid-replace can't leave the user with no
  // assignments (the delete committing without the insert).
  await db.transaction(async (tx) => {
    await tx.delete(supervisorRestaurantsTable).where(eq(supervisorRestaurantsTable.supervisorId, id));

    if (restaurantIds.length > 0) {
      await tx.insert(supervisorRestaurantsTable).values(
        restaurantIds.map((restaurantId) => ({ supervisorId: id, restaurantId }))
      );
    }
  });

  res.json({ restaurantIds });
});

export default router;
