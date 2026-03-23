import { Router, type IRouter } from "express";
import { db, restaurantsTable, issuesTable } from "@workspace/db";
import { eq, and, ne, desc, asc, sql } from "drizzle-orm";
import { extractToken, getSupervisorFromToken } from "../lib/auth";

const router: IRouter = Router();

router.get("/restaurants", async (req, res) => {
  const token = extractToken(req);
  const supervisor = await getSupervisorFromToken(token);
  if (!supervisor) {
    res.status(401).json({ error: "Supervisor access required" });
    return;
  }
  const restaurants = await db.select().from(restaurantsTable).orderBy(asc(restaurantsTable.name));
  res.json(restaurants);
});

router.get("/restaurants/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid restaurant ID" });
    return;
  }
  const [restaurant] = await db
    .select()
    .from(restaurantsTable)
    .where(eq(restaurantsTable.id, id))
    .limit(1);
  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found" });
    return;
  }
  res.json(restaurant);
});

export default router;
