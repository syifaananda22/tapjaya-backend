
import { Router } from "express";
import { verifyToken } from "../middleware/verifyToken";

import {
  listProducts,
  getProduct,
  addProduct,
  editProduct,
  changeProductStatus,
  removeProduct,
} from "../controllers/product.controller";

const router = Router();

// Seluruh endpoint produk khusus admin
router.use(verifyToken);

router.get("/", listProducts);
router.get("/:id", getProduct);
router.post("/", addProduct);
router.put("/:id", editProduct);
router.patch("/:id/status", changeProductStatus);
router.delete("/:id", removeProduct);

export default router;
