
import { Router } from "express";

import {
  getMobileProducts,
} from "../../controllers/mobile/mobileProduct.controller";

const router = Router();

// GET /api/mobile/products
router.get("/", getMobileProducts);

export default router;