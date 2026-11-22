
import { Router } from "express";

import {
  getRecommendations,
} from "../../controllers/mobile/mobileRecommendation.controller";

const router = Router();

// POST /api/mobile/recommendations
router.post("/", getRecommendations);

export default router;
