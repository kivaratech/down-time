import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import { db, equipmentItemsTable } from "@workspace/db";
import { extractToken, getRestaurantFromToken, getSupervisorFromToken } from "../lib/auth";
import { GetEquipmentQueryParams } from "@workspace/api-zod";
import { z } from "zod/v4";

const router: IRouter = Router();

async function requireAnyAuth(req: Parameters<typeof extractToken>[0]) {
  const token = extractToken(req);
  const [restaurant, supervisor] = await Promise.all([
    getRestaurantFromToken(token),
    getSupervisorFromToken(token),
  ]);
  return { restaurant, supervisor };
}

router.get("/equipment", async (req, res) => {
  const { restaurant, supervisor } = await requireAnyAuth(req);
  if (!restaurant && !supervisor) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const query = GetEquipmentQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query parameters", details: query.error.issues });
    return;
  }

  const rows = await db
    .select()
    .from(equipmentItemsTable)
    .where(query.data.area ? eq(equipmentItemsTable.area, query.data.area) : undefined)
    .orderBy(asc(equipmentItemsTable.sortOrder), asc(equipmentItemsTable.name));

  const areaMap = new Map<string, { area: string; category: string; items: object[] }>();
  for (const row of rows) {
    if (!areaMap.has(row.area)) {
      const category = row.area === "Technology" ? "technology" : "equipment";
      areaMap.set(row.area, { area: row.area, category, items: [] });
    }
    areaMap.get(row.area)!.items.push({
      name: row.name,
      subItems: row.subItems?.length ? row.subItems : undefined,
      supportsCustomLabel: row.supportsCustomLabel || undefined,
    });
  }

  res.json({ areas: Array.from(areaMap.values()) });
});

const CreateEquipmentItemBody = z.object({
  area: z.enum(["Front Counter", "Grill", "Back of House", "Technology"]),
  name: z.string().min(1).max(100),
  subItems: z.array(z.string()).optional(),
  supportsCustomLabel: z.boolean().optional(),
});

const UpdateEquipmentItemBody = z.object({
  name: z.string().min(1).max(100).optional(),
  subItems: z.array(z.string()).optional(),
  supportsCustomLabel: z.boolean().optional(),
});

const EquipmentItemIdParam = z.object({ id: z.coerce.number().int().positive() });

router.post("/equipment/items", async (req, res) => {
  const token = extractToken(req);
  const supervisor = await getSupervisorFromToken(token);
  if (!supervisor) {
    res.status(403).json({ error: "Supervisor access required" });
    return;
  }

  const body = CreateEquipmentItemBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body", details: body.error.issues });
    return;
  }

  const maxOrder = await db
    .select({ sortOrder: equipmentItemsTable.sortOrder })
    .from(equipmentItemsTable)
    .where(eq(equipmentItemsTable.area, body.data.area))
    .orderBy(asc(equipmentItemsTable.sortOrder));

  const nextOrder = maxOrder.length > 0
    ? Math.max(...maxOrder.map((r) => r.sortOrder ?? 0)) + 1
    : 0;

  const [created] = await db
    .insert(equipmentItemsTable)
    .values({
      area: body.data.area,
      name: body.data.name,
      subItems: body.data.subItems ?? [],
      supportsCustomLabel: body.data.supportsCustomLabel ?? false,
      sortOrder: nextOrder,
    })
    .returning();

  res.status(201).json(created);
});

router.patch("/equipment/items/:id", async (req, res) => {
  const token = extractToken(req);
  const supervisor = await getSupervisorFromToken(token);
  if (!supervisor) {
    res.status(403).json({ error: "Supervisor access required" });
    return;
  }

  const params = EquipmentItemIdParam.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid item ID" });
    return;
  }

  const body = UpdateEquipmentItemBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body", details: body.error.issues });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (body.data.name !== undefined) updates.name = body.data.name;
  if (body.data.subItems !== undefined) updates.subItems = body.data.subItems;
  if (body.data.supportsCustomLabel !== undefined) updates.supportsCustomLabel = body.data.supportsCustomLabel;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [updated] = await db
    .update(equipmentItemsTable)
    .set(updates)
    .where(eq(equipmentItemsTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Equipment item not found" });
    return;
  }

  res.json(updated);
});

router.delete("/equipment/items/:id", async (req, res) => {
  const token = extractToken(req);
  const supervisor = await getSupervisorFromToken(token);
  if (!supervisor) {
    res.status(403).json({ error: "Supervisor access required" });
    return;
  }

  const params = EquipmentItemIdParam.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid item ID" });
    return;
  }

  const [deleted] = await db
    .delete(equipmentItemsTable)
    .where(eq(equipmentItemsTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Equipment item not found" });
    return;
  }

  res.status(204).send();
});

router.get("/equipment/items", async (req, res) => {
  const token = extractToken(req);
  const supervisor = await getSupervisorFromToken(token);
  if (!supervisor) {
    res.status(403).json({ error: "Supervisor access required" });
    return;
  }

  const rows = await db
    .select()
    .from(equipmentItemsTable)
    .orderBy(asc(equipmentItemsTable.area), asc(equipmentItemsTable.sortOrder), asc(equipmentItemsTable.name));

  res.json(rows);
});

export default router;
