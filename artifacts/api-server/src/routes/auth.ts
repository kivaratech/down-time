import { Router, type IRouter } from "express";
import {
  db,
  restaurantsTable,
  supervisorsTable,
  supervisorSessionsTable,
  supervisorDevicesTable,
  deviceSessionsTable,
  pairingCodesTable,
} from "@workspace/db";
import { and, eq, isNull, gt } from "drizzle-orm";
import {
  generateToken,
  hashPassword,
  verifyPassword,
  extractToken,
  getRestaurantFromToken,
  getSupervisorFromToken,
  requireOrgAdmin,
} from "../lib/auth";
import { SupervisorLoginBody } from "@workspace/api-zod";
import crypto from "crypto";

const router: IRouter = Router();

// POST /api/auth/supervisor/login — works for both admin and supervisor roles
router.post("/auth/supervisor/login", async (req, res) => {
  const body = SupervisorLoginBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }
  // Email is globally unique (one person → one account, regardless of org).
  // Normalize to lowercase so login matches signup regardless of caps.
  const emailNormalized = body.data.email.trim().toLowerCase();
  const [supervisor] = await db
    .select()
    .from(supervisorsTable)
    .where(eq(supervisorsTable.email, emailNormalized))
    .limit(1);
  if (!supervisor || !verifyPassword(body.data.password, supervisor.passwordHash)) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  if (!supervisor.isActive) {
    res.status(403).json({ error: "Account is deactivated. Contact your administrator." });
    return;
  }
  const token = generateToken();
  await db.insert(supervisorSessionsTable).values({ token, supervisorId: supervisor.id });
  res.json({
    token,
    supervisor: {
      id: supervisor.id,
      email: supervisor.email,
      name: supervisor.name,
      role: supervisor.role,
      organizationId: supervisor.organizationId,
    },
  });
});

// POST /api/auth/supervisor/logout
router.post("/auth/supervisor/logout", async (req, res) => {
  const token = extractToken(req);
  if (token) {
    await db.delete(supervisorSessionsTable).where(eq(supervisorSessionsTable.token, token));
  }
  res.json({ success: true });
});

// POST /api/auth/supervisor/push-token — register Expo push token
router.post("/auth/supervisor/push-token", async (req, res) => {
  const token = extractToken(req);
  const supervisor = await getSupervisorFromToken(token);
  if (!supervisor) {
    res.status(401).json({ error: "Supervisor authentication required" });
    return;
  }

  const { token: pushToken } = req.body;
  if (!pushToken || typeof pushToken !== "string") {
    res.status(400).json({ error: "Push token is required" });
    return;
  }

  // Upsert into supervisor_devices: one row per (supervisorId, token).
  // Same supervisor on phone+tablet → two rows → notifications fan out to both.
  // Re-registering the same token (loadSession + loginSupervisor in quick
  // succession, or after a no-op restart) is a no-op aside from bumping
  // lastSeenAt. The unique index handles the deduplication.
  await db
    .insert(supervisorDevicesTable)
    .values({
      supervisorId: supervisor.id,
      expoPushToken: pushToken,
    })
    .onConflictDoUpdate({
      target: [supervisorDevicesTable.supervisorId, supervisorDevicesTable.expoPushToken],
      set: { lastSeenAt: new Date() },
    });

  res.json({ success: true });
});

// POST /api/auth/admin/pairing-code — admin generates a pairing code for one of their org's restaurants
router.post("/auth/admin/pairing-code", async (req, res) => {
  const admin = requireOrgAdmin(req, res);
  if (!admin) return;

  const { restaurantId } = req.body;
  if (!restaurantId || typeof restaurantId !== "number") {
    res.status(400).json({ error: "restaurantId (number) is required" });
    return;
  }

  // Restaurant must exist AND belong to admin's org. Cross-org or missing is
  // a 404 — we don't tell the admin whether the ID exists in another org.
  const [restaurant] = await db
    .select()
    .from(restaurantsTable)
    .where(
      and(
        eq(restaurantsTable.id, restaurantId),
        eq(restaurantsTable.organizationId, admin.organizationId),
      ),
    )
    .limit(1);
  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found" });
    return;
  }

  // 6-char uppercase alphanumeric pairing code, expires in 15 minutes
  const code = crypto.randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await db.insert(pairingCodesTable).values({ code, restaurantId, expiresAt });

  res.json({ code, expiresAt, restaurantName: restaurant.name });
});

// POST /api/auth/device/pair — tablet enters code to create a long-lived device session
router.post("/auth/device/pair", async (req, res) => {
  const { code } = req.body;
  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "Pairing code is required" });
    return;
  }

  const normalized = code.toUpperCase().trim();

  // Atomically claim the code — only succeeds if it exists, is unused, and is not expired.
  // This prevents a TOCTOU race where two concurrent requests both pass separate read/write checks.
  const now = new Date();
  const [marked] = await db
    .update(pairingCodesTable)
    .set({ usedAt: now })
    .where(
      and(
        eq(pairingCodesTable.code, normalized),
        isNull(pairingCodesTable.usedAt),
        gt(pairingCodesTable.expiresAt, now),
      ),
    )
    .returning();

  if (!marked) {
    const [existing] = await db
      .select()
      .from(pairingCodesTable)
      .where(eq(pairingCodesTable.code, normalized))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Invalid pairing code" });
    } else if (existing.usedAt) {
      res.status(409).json({ error: "This pairing code has already been used" });
    } else {
      res.status(410).json({ error: "This pairing code has expired" });
    }
    return;
  }

  // Create long-lived device session
  const sessionToken = generateToken();
  await db.insert(deviceSessionsTable).values({
    token: sessionToken,
    restaurantId: marked.restaurantId,
  });

  const [restaurant] = await db
    .select()
    .from(restaurantsTable)
    .where(eq(restaurantsTable.id, marked.restaurantId))
    .limit(1);

  res.json({
    token: sessionToken,
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      location: restaurant.location,
      createdAt: restaurant.createdAt,
    },
  });
});

// GET /api/auth/admin/device-sessions — list device sessions for admin's org
router.get("/auth/admin/device-sessions", async (req, res) => {
  const admin = requireOrgAdmin(req, res);
  if (!admin) return;

  const sessions = await db
    .select({
      id: deviceSessionsTable.id,
      restaurantId: deviceSessionsTable.restaurantId,
      restaurantName: restaurantsTable.name,
      revokedAt: deviceSessionsTable.revokedAt,
      createdAt: deviceSessionsTable.createdAt,
    })
    .from(deviceSessionsTable)
    .innerJoin(restaurantsTable, eq(deviceSessionsTable.restaurantId, restaurantsTable.id))
    .where(
      and(
        isNull(deviceSessionsTable.revokedAt),
        eq(restaurantsTable.organizationId, admin.organizationId),
      ),
    );

  res.json(sessions);
});

// DELETE /api/auth/admin/device-sessions/:id — revoke a device session (same org only)
router.delete("/auth/admin/device-sessions/:id", async (req, res) => {
  const admin = requireOrgAdmin(req, res);
  if (!admin) return;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid session ID" });
    return;
  }

  // Confirm the session's restaurant is in admin's org before revoking.
  // Cross-org or missing returns 404 (no information leak).
  const [target] = await db
    .select({ id: deviceSessionsTable.id })
    .from(deviceSessionsTable)
    .innerJoin(restaurantsTable, eq(deviceSessionsTable.restaurantId, restaurantsTable.id))
    .where(
      and(
        eq(deviceSessionsTable.id, id),
        eq(restaurantsTable.organizationId, admin.organizationId),
      ),
    )
    .limit(1);
  if (!target) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  await db
    .update(deviceSessionsTable)
    .set({ revokedAt: new Date() })
    .where(eq(deviceSessionsTable.id, id));

  res.json({ success: true });
});

// POST /api/auth/supervisor/change-password — change own password (any logged-in supervisor/admin)
router.post("/auth/supervisor/change-password", async (req, res) => {
  const token = extractToken(req);
  const supervisor = await getSupervisorFromToken(token);
  if (!supervisor) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || typeof currentPassword !== "string") {
    res.status(400).json({ error: "Current password is required" });
    return;
  }
  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
    res.status(400).json({ error: "New password must be at least 6 characters" });
    return;
  }

  if (!verifyPassword(currentPassword, supervisor.passwordHash)) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }

  await db
    .update(supervisorsTable)
    .set({ passwordHash: hashPassword(newPassword) })
    .where(eq(supervisorsTable.id, supervisor.id));

  res.json({ success: true });
});

// GET /api/auth/me — return current user info
router.get("/auth/me", async (req, res) => {
  const token = extractToken(req);

  const restaurant = await getRestaurantFromToken(token);
  if (restaurant) {
    res.json({
      type: "restaurant",
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        location: restaurant.location,
        createdAt: restaurant.createdAt,
      },
    });
    return;
  }

  const supervisor = await getSupervisorFromToken(token);
  if (supervisor) {
    res.json({
      type: "supervisor",
      supervisor: {
        id: supervisor.id,
        email: supervisor.email,
        name: supervisor.name,
        role: supervisor.role,
        organizationId: supervisor.organizationId,
      },
    });
    return;
  }

  res.status(401).json({ error: "Not authenticated" });
});

export default router;
