import { Router, type IRouter } from "express";
import { db, restaurantsTable, supervisorsTable, restaurantSessionsTable, supervisorSessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { generateToken, hashPassword, extractToken, getRestaurantFromToken, getSupervisorFromToken } from "../lib/auth";

const router: IRouter = Router();

router.post("/auth/restaurant/login", async (req, res) => {
  const { pin } = req.body;
  if (!pin) {
    res.status(400).json({ error: "PIN is required" });
    return;
  }
  const [restaurant] = await db
    .select()
    .from(restaurantsTable)
    .where(eq(restaurantsTable.pin, String(pin)))
    .limit(1);
  if (!restaurant) {
    res.status(401).json({ error: "Invalid PIN" });
    return;
  }
  const token = generateToken();
  await db.insert(restaurantSessionsTable).values({ token, restaurantId: restaurant.id });
  res.json({ token, restaurant });
});

router.post("/auth/supervisor/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }
  const [supervisor] = await db
    .select()
    .from(supervisorsTable)
    .where(eq(supervisorsTable.username, String(username)))
    .limit(1);
  if (!supervisor || supervisor.passwordHash !== hashPassword(String(password))) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const token = generateToken();
  await db.insert(supervisorSessionsTable).values({ token, supervisorId: supervisor.id });
  res.json({
    token,
    supervisor: { id: supervisor.id, username: supervisor.username, name: supervisor.name },
  });
});

router.post("/auth/supervisor/logout", async (req, res) => {
  const token = extractToken(req);
  if (token) {
    await db.delete(supervisorSessionsTable).where(eq(supervisorSessionsTable.token, token));
  }
  res.json({ success: true });
});

router.get("/auth/me", async (req, res) => {
  const token = extractToken(req);
  const restaurant = await getRestaurantFromToken(token);
  if (restaurant) {
    res.json({ type: "restaurant", restaurant });
    return;
  }
  const supervisor = await getSupervisorFromToken(token);
  if (supervisor) {
    res.json({
      type: "supervisor",
      supervisor: { id: supervisor.id, username: supervisor.username, name: supervisor.name },
    });
    return;
  }
  res.status(401).json({ error: "Not authenticated" });
});

export default router;
