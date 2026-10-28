import { Router } from "express";
import {
  loginAdmin,
  registerAdmin,
} from "../controllers/auth.controller";

const router = Router();

router.post("/login", loginAdmin);
router.post("/admins", registerAdmin);

export default router;
