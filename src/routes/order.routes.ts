
import { Router } from "express";
import { verifyToken } from "../middleware/verifyToken";
import {
    listOrders,
    getOrderDetail,
    changeOrderStatus,
} from "../controllers/order.controller";

const router = Router();

// Semua endpoint pesanan wajib menggunakan JWT.
router.use(verifyToken);

// GET /api/orders
// Mengambil daftar pesanan.
router.get("/", listOrders);

// GET /api/orders/:identifier
// Mengambil detail pesanan.
router.get("/:identifier", getOrderDetail);

// PATCH /api/orders/:identifier/status
// Memperbarui status pesanan.
router.patch("/:identifier/status", changeOrderStatus);

export default router;
