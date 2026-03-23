import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import restaurantsRouter from "./restaurants";
import issuesRouter from "./issues";
import equipmentRouter from "./equipment";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(restaurantsRouter);
router.use(issuesRouter);
router.use(equipmentRouter);

export default router;
