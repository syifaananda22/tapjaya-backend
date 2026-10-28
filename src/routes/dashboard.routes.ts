
import { Router } from "express";
import { verifyToken } from "../middleware/verifyToken";
import {
  getDashboardSummary,
} from "../controllers/dashboard.controller";

const router = Router();

// Dashboard hanya dapat diakses admin yang sudah login.
router.use(verifyToken);

router.get("/", getDashboardSummary);

export default router;
