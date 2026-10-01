import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import accountRouter from "./account";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(projectsRouter);
router.use(accountRouter);
router.use(adminRouter);

export default router;
