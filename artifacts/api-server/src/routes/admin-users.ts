import { Router, type IRouter } from "express";
import { db, supervisorsTable, supervisorSessionsTable } from "@workspace/db";
import { eq, ne } from "drizzle-orm";
import { extractToken, getSupervisorFromToken, hashPassword, verifyPassword } from "../lib/auth";
import { z } from "zod";

const router: IRouter = Router();

async function requireAdmin(req: any, res: any) {
  const token = extractToken(req);
  const supervisor = await getSupervisorFromToken(token);
  if (!supervisor || supervisor.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return null;
  }
  return supervisor;
}

// GET /api/admin/users — list all supervisors
router.get("/admin/users", async (req, res) => {
  const admin = await requireAdmin(req, res);
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
    .orderBy(supervisorsTable.createdAt);

  res.json(users);
});

const CreateUserBody = z.object({
  username: z.string().min(2).max(50),
  password: z.string().min(6),
  name: z.string().min(1).max(100),
  email: z.string().email().optional(),
  role: z.enum(["supervisor", "admin"]).default("supervisor"),
});

// POST /api/admin/users — create a new supervisor account
router.post("/admin/users", async (req, res) => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const body = CreateUserBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request", details: body.error.flatten() });
    return;
  }

  const { username, password, name, email, role } = body.data;

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
    .values({ username, passwordHash, name, email: email ?? null, role })
    .returning({
      id: supervisorsTable.id,
      username: supervisorsTable.username,
      name: supervisorsTable.name,
      email: supervisorsTable.email,
      role: supervisorsTable.role,
      isActive: supervisorsTable.isActive,
      createdAt: supervisorsTable.createdAt,
    });

  res.status(201).json(newUser);
});

const UpdateUserBody = z.object({
  username: z.string().min(2).max(50).optional(),
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().nullable().optional(),
  role: z.enum(["supervisor", "admin"]).optional(),
});

// PATCH /api/admin/users/:id — update name/email/username/role
router.patch("/admin/users/:id", async (req, res) => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user ID" });
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

// POST /api/admin/users/:id/deactivate — delete the user
router.post("/admin/users/:id/deactivate", async (req, res) => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  if (id === admin.id) {
    res.status(400).json({ error: "You cannot delete your own account" });
    return;
  }

  // Delete all sessions for this user
  await db
    .delete(supervisorSessionsTable)
    .where(eq(supervisorSessionsTable.supervisorId, id));

  // Delete the user
  await db
    .delete(supervisorsTable)
    .where(eq(supervisorsTable.id, id));

  res.json({ success: true });
});

// POST /api/admin/users/:id/activate
router.post("/admin/users/:id/activate", async (req, res) => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user ID" });
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

// POST /api/admin/users/:id/reset-password
router.post("/admin/users/:id/reset-password", async (req, res) => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const body = ResetPasswordBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "New password must be at least 6 characters" });
    return;
  }

  const passwordHash = hashPassword(body.data.newPassword);

  const [updated] = await db
    .update(supervisorsTable)
    .set({ passwordHash })
    .where(eq(supervisorsTable.id, id))
    .returning({ id: supervisorsTable.id });

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await db
    .delete(supervisorSessionsTable)
    .where(eq(supervisorSessionsTable.supervisorId, id));

  res.json({ success: true });
});

export default router;
