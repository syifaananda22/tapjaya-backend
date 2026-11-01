
import { Router } from "express";

import { verifyToken } from "../middleware/verifyToken";

import { overview } from "../controllers/report.controller";

const router = Router();

router.get(
  "/overview", verifyToken, overview);

export default router;
