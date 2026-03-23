import { Router, type IRouter } from "express";
import { db, restaurantsTable, supervisorsTable, restaurantSessionsTable, supervisorSessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { generateToken, verifyPassword, extractToken, getRestaurantFromToken, getSupervisorFromToken } from "../lib/auth";
import { RestaurantLoginBody, SupervisorLoginBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/auth/restaurant/login", async (req, res) => {
  const body = RestaurantLoginBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }
  const [restaurant] = await db
    .select()
    .from(restaurantsTable)
    .where(eq(restaurantsTable.username, body.data.username))
    .limit(1);
  if (!restaurant || !verifyPassword(body.data.password, restaurant.passwordHash)) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }
  const token = generateToken();
  await db.insert(restaurantSessionsTable).values({ token, restaurantId: restaurant.id });
  res.json({
    token,
    restaurant: { id: restaurant.id, name: restaurant.name, location: restaurant.location, createdAt: restaurant.createdAt },
  });
});

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
    res.json({
      type: "restaurant",
      restaurant: { id: restaurant.id, name: restaurant.name, location: restaurant.location, createdAt: restaurant.createdAt },
    });
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
