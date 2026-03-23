import { Router, type IRouter } from "express";
import { db, restaurantsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import {
  extractToken,
  getRestaurantFromToken,
  getSupervisorFromToken,
} from "../lib/auth";

const router: IRouter = Router();

router.get("/restaurants", async (req, res) => {
  const token = extractToken(req);
  const supervisor = await getSupervisorFromToken(token);
  if (!supervisor) {
    res.status(401).json({ error: "Supervisor access required" });
    return;
  }
  const restaurants = await db
    .select({ id: restaurantsTable.id, name: restaurantsTable.name, location: restaurantsTable.location, createdAt: restaurantsTable.createdAt })
    .from(restaurantsTable)
    .orderBy(asc(restaurantsTable.name));
  res.json(restaurants);
});

router.get("/restaurants/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid restaurant ID" });
    return;
  }

  const token = extractToken(req);
  const restaurant = await getRestaurantFromToken(token);
  const supervisor = !restaurant ? await getSupervisorFromToken(token) : null;

  if (!restaurant && !supervisor) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  if (restaurant && restaurant.id !== id) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const [row] = await db
    .select({ id: restaurantsTable.id, name: restaurantsTable.name, location: restaurantsTable.location, createdAt: restaurantsTable.createdAt })
    .from(restaurantsTable)
    .where(eq(restaurantsTable.id, id))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Restaurant not found" });
    return;
  }
  res.json(row);
});

export default router;
