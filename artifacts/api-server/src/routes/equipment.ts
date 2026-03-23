import { Router, type IRouter } from "express";
import { EQUIPMENT_CATALOG } from "../lib/equipment";
import { extractToken, getRestaurantFromToken, getSupervisorFromToken } from "../lib/auth";
import { GetEquipmentQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/equipment", async (req, res) => {
  const token = extractToken(req);
  const [restaurant, supervisor] = await Promise.all([
    getRestaurantFromToken(token),
    getSupervisorFromToken(token),
  ]);
  if (!restaurant && !supervisor) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const query = GetEquipmentQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query parameters", details: query.error.issues });
    return;
  }
  const { area } = query.data;
  if (area) {
    const filtered = EQUIPMENT_CATALOG.filter((a) => a.area === area);
    res.json({ areas: filtered });
    return;
  }
  res.json({ areas: EQUIPMENT_CATALOG });
});

export default router;
