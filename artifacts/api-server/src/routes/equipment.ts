import { Router, type IRouter } from "express";
import { EQUIPMENT_CATALOG } from "../lib/equipment";
import { GetEquipmentQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/equipment", (req, res) => {
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
