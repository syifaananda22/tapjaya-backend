import { Router } from "express";
import { mobileCheckout } from "../../controllers/mobile/mobileCheckout.controller";

const router = Router();

router.post("/", mobileCheckout);

export default router;