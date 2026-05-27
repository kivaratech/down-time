import { Router, type IRouter } from "express";
import { db, supervisorsTable, supervisorSessionsTable, supervisorRestaurantsTable, restaurantsTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { hashPassword, requireOrgAdmin } from "../lib/auth";
import { z } from "zod";

const router: IRouter = Router();

/**
 * Returns the supervisor row if it exists AND belongs to the admin's org.
 * Returning null lets the caller respond with 404 — cross-org users look
 * identical to non-existent users (no information leak).
 */
async function findUserInAdminOrg(userId: number, adminOrgId: number) {
  const [u] = await db
    .select({ id: supervisorsTable.id, role: supervisorsTable.role })
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
      username: supervisorsTable.username,
      name: supervisorsTable.name,
      email: supervisorsTable.email,
      role: supervisorsTable.role,
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
  username: z.string().min(2).max(50),
  password: z.string().min(6),
  name: z.string().min(1).max(100),
  email: z.string().email().optional(),
  role: z.enum(["supervisor", "admin"]).default("supervisor"),
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

  const { username, password, name, email, role } = body.data;

  // Username is currently globally unique at the DB level. Until Phase 2f
  // swaps that to a composite (organization_id, username), keep this check
  // global so we return a clean 409 instead of a constraint-violation 500.
  const [existing] = await db
    .select({ id: supervisorsTable.id })
    .from(supervisorsTable)
    .where(eq(supervisorsTable.username, username))
    .limit(1);

  if (existing) {
    res.status(409).json({ error: "Username already taken" });
    return;
  }

  const passwordHash = hashPassword(password);
  const [newUser] = await db
    .insert(supervisorsTable)
    .values({
      organizationId: admin.organizationId,
      username,
      passwordHash,
      name,
      email: email ?? null,
      role,
    })
    .returning({
      id: supervisorsTable.id,
      username: supervisorsTable.username,
      name: supervisorsTable.name,
      email: supervisorsTable.email,
      role: supervisorsTable.role,
      isActive: supervisorsTable.isActive,
      createdAt: supervisorsTable.createdAt,
    });

  res.status(201).json({ ...newUser, restaurantIds: [] });
});

const UpdateUserBody = z.object({
  username: z.string().min(2).max(50).optional(),
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().nullable().optional(),
  role: z.enum(["supervisor", "admin"]).optional(),
});

// PATCH /api/admin/users/:id — update name/email/username/role (same org only)
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

  const { username, name, email, role } = body.data;

  if (username) {
    const [conflict] = await db
      .select({ id: supervisorsTable.id })
      .from(supervisorsTable)
      .where(eq(supervisorsTable.username, username))
      .limit(1);
    if (conflict && conflict.id !== id) {
      res.status(409).json({ error: "Username already taken" });
      return;
    }
  }

  const updates: Record<string, any> = {};
  if (username !== undefined) updates.username = username;
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email;
  if (role !== undefined) updates.role = role;

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
      username: supervisorsTable.username,
      name: supervisorsTable.name,
      email: supervisorsTable.email,
      role: supervisorsTable.role,
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

  // Replace all assignments atomically (delete + insert).
  await db.delete(supervisorRestaurantsTable).where(eq(supervisorRestaurantsTable.supervisorId, id));

  if (restaurantIds.length > 0) {
    await db.insert(supervisorRestaurantsTable).values(
      restaurantIds.map((restaurantId) => ({ supervisorId: id, restaurantId }))
    );
  }

  res.json({ restaurantIds });
});

export default router;
