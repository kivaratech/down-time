import { Router, type IRouter } from "express";
import { db, restaurantsTable, supervisorRestaurantsTable } from "@workspace/db";
import { eq, and, asc, inArray, SQL } from "drizzle-orm";
import {
  requireAuth,
  requireSupervisor,
  principalCanAccessRestaurant,
} from "../lib/auth";
import { GetRestaurantParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/restaurants", async (req, res) => {
  const principal = requireSupervisor(req, res);
  if (!principal) return;

  const cols = {
    id: restaurantsTable.id,
    name: restaurantsTable.name,
    location: restaurantsTable.location,
    createdAt: restaurantsTable.createdAt,
  };

  const conditions: SQL<unknown>[] = [];
  // Org scoping — super_admin (organizationId === null) sees everything.
  if (principal.organizationId != null) {
    conditions.push(eq(restaurantsTable.organizationId, principal.organizationId));
  }

  // Non-admin, non-super_admin supervisors are further constrained to their assignments.
  if (principal.role !== "admin" && principal.role !== "super_admin") {
    const assignments = await db
      .select({ restaurantId: supervisorRestaurantsTable.restaurantId })
      .from(supervisorRestaurantsTable)
      .where(eq(supervisorRestaurantsTable.supervisorId, principal.supervisorId));

    const ids = assignments.map((a) => a.restaurantId);
    if (ids.length === 0) {
      res.json([]);
      return;
    }
    conditions.push(inArray(restaurantsTable.id, ids));
  }

  const baseQuery = db.select(cols).from(restaurantsTable);
  const restaurants = conditions.length > 0
    ? await baseQuery.where(and(...conditions)).orderBy(asc(restaurantsTable.name))
    : await baseQuery.orderBy(asc(restaurantsTable.name));
  res.json(restaurants);
});

router.get("/restaurants/:id", async (req, res) => {
  const params = GetRestaurantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid restaurant ID" });
    return;
  }
  const id = params.data.id;

  const principal = requireAuth(req, res);
  if (!principal) return;

  if (!(await principalCanAccessRestaurant(principal, id))) {
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
