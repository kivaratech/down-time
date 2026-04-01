import { Router, type IRouter } from "express";
import {
  db,
  restaurantsTable,
  supervisorsTable,
  supervisorSessionsTable,
  deviceSessionsTable,
  pairingCodesTable,
} from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import {
  generateToken,
  hashPassword,
  verifyPassword,
  extractToken,
  getRestaurantFromToken,
  getSupervisorFromToken,
} from "../lib/auth";
import { SupervisorLoginBody } from "@workspace/api-zod";
import { sendPasswordResetEmail } from "../lib/email";
import crypto from "crypto";

const router: IRouter = Router();

// POST /api/auth/supervisor/login — works for both admin and supervisor roles
router.post("/auth/supervisor/login", async (req, res) => {
  const body = SupervisorLoginBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }
  const [supervisor] = await db
    .select()
    .from(supervisorsTable)
    .where(eq(supervisorsTable.username, body.data.username))
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
      username: supervisor.username,
      name: supervisor.name,
      role: supervisor.role,
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

  await db
    .update(supervisorsTable)
    .set({ expoPushToken: pushToken })
    .where(eq(supervisorsTable.id, supervisor.id));

  res.json({ success: true });
});

// POST /api/auth/supervisor/change-password — change password while logged in
router.post("/auth/supervisor/change-password", async (req, res) => {
  const token = extractToken(req);
  const supervisor = await getSupervisorFromToken(token);
  if (!supervisor) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Current and new password are required" });
    return;
  }
  if (typeof newPassword !== "string" || newPassword.length < 6) {
    res.status(400).json({ error: "New password must be at least 6 characters" });
    return;
  }

  if (!verifyPassword(currentPassword, supervisor.passwordHash)) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }

  const passwordHash = hashPassword(newPassword);
  await db
    .update(supervisorsTable)
    .set({ passwordHash })
    .where(eq(supervisorsTable.id, supervisor.id));

  res.json({ success: true });
});

// POST /api/auth/forgot-password — request a reset code via email
router.post("/auth/forgot-password", async (req, res) => {
  const { email } = req.body;

  // Always respond the same way to avoid email enumeration
  const genericResponse = { success: true, message: "If an account with that email exists, a reset code has been sent." };

  if (!email || typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "A valid email address is required" });
    return;
  }

  const [supervisor] = await db
    .select()
    .from(supervisorsTable)
    .where(eq(supervisorsTable.email, email.toLowerCase().trim()))
    .limit(1);

  if (!supervisor || !supervisor.isActive) {
    // Don't reveal whether the account exists
    res.json(genericResponse);
    return;
  }

  // Generate 6-digit numeric code
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

  await db
    .update(supervisorsTable)
    .set({ passwordResetToken: code, passwordResetExpiresAt: expiresAt })
    .where(eq(supervisorsTable.id, supervisor.id));

  try {
    await sendPasswordResetEmail(email.toLowerCase().trim(), supervisor.name, code);
  } catch (err) {
    console.error("[AUTH] Failed to send reset email:", err);
    res.status(500).json({ error: "Failed to send reset email. Please try again." });
    return;
  }

  res.json(genericResponse);
});

// POST /api/auth/reset-password — verify code and set new password
router.post("/auth/reset-password", async (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    res.status(400).json({ error: "Email, code, and new password are required" });
    return;
  }
  if (typeof newPassword !== "string" || newPassword.length < 6) {
    res.status(400).json({ error: "New password must be at least 6 characters" });
    return;
  }
  if (typeof code !== "string" || code.trim().length === 0) {
    res.status(400).json({ error: "Reset code is required" });
    return;
  }

  const [supervisor] = await db
    .select()
    .from(supervisorsTable)
    .where(eq(supervisorsTable.email, email.toLowerCase().trim()))
    .limit(1);

  if (!supervisor || !supervisor.isActive) {
    res.status(400).json({ error: "Invalid reset code or email" });
    return;
  }

  if (!supervisor.passwordResetToken || supervisor.passwordResetToken !== code.trim()) {
    res.status(400).json({ error: "Invalid or expired reset code" });
    return;
  }

  if (!supervisor.passwordResetExpiresAt || new Date() > supervisor.passwordResetExpiresAt) {
    res.status(400).json({ error: "Reset code has expired. Please request a new one." });
    return;
  }

  const passwordHash = hashPassword(newPassword);

  // Update password, clear reset token, sign out all existing sessions
  await db
    .update(supervisorsTable)
    .set({ passwordHash, passwordResetToken: null, passwordResetExpiresAt: null })
    .where(eq(supervisorsTable.id, supervisor.id));

  await db.delete(supervisorSessionsTable).where(eq(supervisorSessionsTable.supervisorId, supervisor.id));

  res.json({ success: true });
});

// POST /api/auth/admin/pairing-code — admin generates a pairing code for a restaurant
router.post("/auth/admin/pairing-code", async (req, res) => {
  const token = extractToken(req);
  const supervisor = await getSupervisorFromToken(token);
  if (!supervisor || supervisor.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const { restaurantId } = req.body;
  if (!restaurantId || typeof restaurantId !== "number") {
    res.status(400).json({ error: "restaurantId (number) is required" });
    return;
  }

  const [restaurant] = await db
    .select()
    .from(restaurantsTable)
    .where(eq(restaurantsTable.id, restaurantId))
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

  const [pairingCode] = await db
    .select()
    .from(pairingCodesTable)
    .where(eq(pairingCodesTable.code, normalized))
    .limit(1);

  if (!pairingCode) {
    res.status(404).json({ error: "Invalid pairing code" });
    return;
  }

  if (pairingCode.usedAt) {
    res.status(409).json({ error: "This pairing code has already been used" });
    return;
  }

  if (new Date() > pairingCode.expiresAt) {
    res.status(410).json({ error: "This pairing code has expired" });
    return;
  }

  // Mark code as used (one-time only)
  await db
    .update(pairingCodesTable)
    .set({ usedAt: new Date() })
    .where(eq(pairingCodesTable.id, pairingCode.id));

  // Create long-lived device session
  const sessionToken = generateToken();
  await db.insert(deviceSessionsTable).values({
    token: sessionToken,
    restaurantId: pairingCode.restaurantId,
  });

  const [restaurant] = await db
    .select()
    .from(restaurantsTable)
    .where(eq(restaurantsTable.id, pairingCode.restaurantId))
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

// GET /api/auth/admin/device-sessions — list all device sessions (admin only)
router.get("/auth/admin/device-sessions", async (req, res) => {
  const token = extractToken(req);
  const supervisor = await getSupervisorFromToken(token);
  if (!supervisor || supervisor.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

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
    .where(isNull(deviceSessionsTable.revokedAt));

  res.json(sessions);
});

// DELETE /api/auth/admin/device-sessions/:id — revoke a device session
router.delete("/auth/admin/device-sessions/:id", async (req, res) => {
  const token = extractToken(req);
  const supervisor = await getSupervisorFromToken(token);
  if (!supervisor || supervisor.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid session ID" });
    return;
  }

  await db
    .update(deviceSessionsTable)
    .set({ revokedAt: new Date() })
    .where(eq(deviceSessionsTable.id, id));

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
        username: supervisor.username,
        name: supervisor.name,
        role: supervisor.role,
      },
    });
    return;
  }

  res.status(401).json({ error: "Not authenticated" });
});

export default router;
