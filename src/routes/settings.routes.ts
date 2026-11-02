import { Router } from "express";
import { verifyToken } from "../middleware/verifyToken";

import {
  getProfile,
  updateProfile,
  changePassword,
  getStore,
  updateStore,
} from "../controllers/settings.controller";

const router = Router();

router.use(verifyToken);

router.get("/profile", getProfile);
router.put("/profile", updateProfile);

router.put("/password", changePassword);

router.get("/store", getStore);
router.put("/store", updateStore);

export default router;