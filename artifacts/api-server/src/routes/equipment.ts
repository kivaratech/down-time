import { Router, type IRouter } from "express";
import { and, asc, eq, SQL } from "drizzle-orm";
import { db, equipmentItemsTable } from "@workspace/db";
import { requireAuth, requireSupervisor } from "../lib/auth";
import { GetEquipmentQueryParams } from "@workspace/api-zod";
import { z } from "zod/v4";

const router: IRouter = Router();

router.get("/equipment", async (req, res) => {
  const principal = requireAuth(req, res);
  if (!principal) return;

  const query = GetEquipmentQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query parameters", details: query.error.issues });
    return;
  }

  const conditions: SQL<unknown>[] = [];
  // Each org has its own catalog. super_admin bypasses (sees everything),
  // but in practice they'd hit a Phase 3 endpoint scoped to a specific org.
  if (principal.organizationId != null) {
    conditions.push(eq(equipmentItemsTable.organizationId, principal.organizationId));
  }
  if (query.data.area) {
    conditions.push(eq(equipmentItemsTable.area, query.data.area));
  }

  const baseQuery = db.select().from(equipmentItemsTable);
  const rows = conditions.length > 0
    ? await baseQuery.where(and(...conditions)).orderBy(asc(equipmentItemsTable.sortOrder), asc(equipmentItemsTable.name))
    : await baseQuery.orderBy(asc(equipmentItemsTable.sortOrder), asc(equipmentItemsTable.name));

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
  const principal = requireSupervisor(req, res);
  if (!principal) return;
  if (principal.organizationId == null) {
    // super_admin has no org — equipment is per-org, so they'd use a
    // platform endpoint (Phase 3) to manage a specific org's catalog.
    res.status(400).json({ error: "Organization context required" });
    return;
  }

  const body = CreateEquipmentItemBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body", details: body.error.issues });
    return;
  }

  // Compute the next sort order within THIS org for the given area.
  const maxOrder = await db
    .select({ sortOrder: equipmentItemsTable.sortOrder })
    .from(equipmentItemsTable)
    .where(
      and(
        eq(equipmentItemsTable.organizationId, principal.organizationId),
        eq(equipmentItemsTable.area, body.data.area),
      ),
    )
    .orderBy(asc(equipmentItemsTable.sortOrder));

  const nextOrder = maxOrder.length > 0
    ? Math.max(...maxOrder.map((r) => r.sortOrder ?? 0)) + 1
    : 0;

  const [created] = await db
    .insert(equipmentItemsTable)
    .values({
      organizationId: principal.organizationId,
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
  const principal = requireSupervisor(req, res);
  if (!principal) return;

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

  // Verify the item exists in the principal's org before letting them edit.
  // super_admin (org = null) currently can't edit through this route — they'd
  // use a Phase 3 endpoint scoped to a specific org.
  if (principal.organizationId == null) {
    res.status(400).json({ error: "Organization context required" });
    return;
  }
  const [existing] = await db
    .select({ organizationId: equipmentItemsTable.organizationId })
    .from(equipmentItemsTable)
    .where(eq(equipmentItemsTable.id, params.data.id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Equipment item not found" });
    return;
  }
  if (existing.organizationId !== principal.organizationId) {
    res.status(403).json({ error: "Access denied" });
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
  const principal = requireSupervisor(req, res);
  if (!principal) return;

  const params = EquipmentItemIdParam.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid item ID" });
    return;
  }

  if (principal.organizationId == null) {
    res.status(400).json({ error: "Organization context required" });
    return;
  }
  const [existing] = await db
    .select({ organizationId: equipmentItemsTable.organizationId })
    .from(equipmentItemsTable)
    .where(eq(equipmentItemsTable.id, params.data.id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Equipment item not found" });
    return;
  }
  if (existing.organizationId !== principal.organizationId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  await db
    .delete(equipmentItemsTable)
    .where(eq(equipmentItemsTable.id, params.data.id));

  res.status(204).send();
});

router.get("/equipment/items", async (req, res) => {
  const principal = requireSupervisor(req, res);
  if (!principal) return;

  const conditions: SQL<unknown>[] = [];
  if (principal.organizationId != null) {
    conditions.push(eq(equipmentItemsTable.organizationId, principal.organizationId));
  }

  const baseQuery = db.select().from(equipmentItemsTable);
  const rows = conditions.length > 0
    ? await baseQuery.where(and(...conditions)).orderBy(asc(equipmentItemsTable.area), asc(equipmentItemsTable.sortOrder), asc(equipmentItemsTable.name))
    : await baseQuery.orderBy(asc(equipmentItemsTable.area), asc(equipmentItemsTable.sortOrder), asc(equipmentItemsTable.name));

  res.json(rows);
});

export default router;
