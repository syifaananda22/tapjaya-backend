
import {
  Router,
  type Request,
  type Response,
} from "express";

import type {
  RowDataPacket,
  ResultSetHeader,
} from "mysql2";

import pool from "../../config/database";

import {
  getMobileOrderDetail,
} from "../../controllers/mobile/mobileOrder.controller";

const router = Router();

interface OrderRow extends RowDataPacket {
  id: number;
  order_number: string;
}

router.post(
  "/:orderNumber/simulate-payment",
  async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const raw = req.params.orderNumber;

    const orderNumber = (
      Array.isArray(raw) ? raw[0] : raw
    )?.trim().replace(/^#/, "");

    if (!orderNumber) {
      res.status(400).json({
        success: false,
        message: "Nomor pesanan tidak valid.",
      });
      return;
    }

    let connection;

    try {
      connection = await pool.getConnection();

      await connection.beginTransaction();

      const [orders] =
        await connection.execute<OrderRow[]>(
          `
          SELECT id, order_number
          FROM orders
          WHERE order_number = ?
          LIMIT 1
          FOR UPDATE
          `,
          [orderNumber]
        );

      if (orders.length === 0) {
        await connection.rollback();

        res.status(404).json({
          success: false,
          message: "Pesanan tidak ditemukan di MySQL.",
        });
        return;
      }

      const order = orders[0];

      await connection.execute<ResultSetHeader>(
        `
        INSERT INTO order_payments (
          order_id,
          payment_method,
          payment_status,
          payment_mode,
          paid_at
        )
        VALUES (
          ?,
          'qris',
          'paid',
          'simulation',
          NOW()
        )
        ON DUPLICATE KEY UPDATE
          payment_status = 'paid',
          payment_mode = 'simulation',
          paid_at = COALESCE(
            paid_at,
            NOW()
          )
        `,
        [order.id]
      );

      await connection.commit();

      res.status(200).json({
        success: true,
        message:
          "Pembayaran simulasi berhasil.",
        data: {
          orderNumber: order.order_number,
          paymentStatus: "paid",
          paymentMode: "simulation",
        },
      });
    } catch (error) {
      if (connection) {
        await connection.rollback();
      }

      console.error(
        "SIMULATED PAYMENT ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Gagal menyimpan pembayaran.",
      });
    } finally {
      connection?.release();
    }
  }
);

router.get(
  "/:orderNumber",
  getMobileOrderDetail
);

export default router;
