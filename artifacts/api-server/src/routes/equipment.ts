import { Router, type IRouter } from "express";
import { EQUIPMENT_CATALOG } from "../lib/equipment";

const router: IRouter = Router();

router.get("/equipment", (req, res) => {
  const area = req.query.area as string | undefined;
  if (area) {
    const filtered = EQUIPMENT_CATALOG.filter((a) => a.area === area);
    res.json({ areas: filtered });
    return;
  }
  res.json({ areas: EQUIPMENT_CATALOG });
});

export default router;
