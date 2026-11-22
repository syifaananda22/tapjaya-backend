
import pool from "../../config/database";
import type {
  ResultSetHeader,
  RowDataPacket,
} from "mysql2";

interface OrderRow extends RowDataPacket {
  id: number;
  orderNumber: string;
  status: string;
  total: string | number;
}

interface PaymentRow extends RowDataPacket {
  paymentStatus: "pending" | "paid";
  paymentMethod: string;
  paymentMode: string;
  paidAt: Date | null;
}

function normalizeOrderNumber(value: string): string {
  return value.trim().replace(/^#/, "");
}

export async function completeSimulatedPayment(
  orderNumber: string
) {
  const normalized = normalizeOrderNumber(orderNumber);

  if (!normalized) {
    throw new Error("Nomor pesanan wajib diisi.");
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [orders] = await connection.execute<OrderRow[]>(
      `
        SELECT
          id,
          order_number AS orderNumber,
          status,
          total
        FROM orders
        WHERE order_number = ?
        LIMIT 1
        FOR UPDATE
      `,
      [normalized]
    );

    if (orders.length === 0) {
      await connection.rollback();

      return {
        found: false as const,
        data: null,
      };
    }

    const order = orders[0];

    // Buat catatan pembayaran jika belum tersedia.
    // Jika sudah tersedia, jangan membuat duplikat.
    await connection.execute<ResultSetHeader>(
      `
        INSERT INTO order_payments (
          order_id,
          payment_method,
          payment_status,
          payment_mode
        )
        VALUES (?, 'qris', 'pending', 'simulation')
        ON DUPLICATE KEY UPDATE
          order_id = order_id
      `,
      [order.id]
    );

    // Pembayaran simulasi selesai.
    // Pemanggilan berulang tetap aman.
    await connection.execute<ResultSetHeader>(
      `
        UPDATE order_payments
        SET
          payment_status = 'paid',
          paid_at = COALESCE(paid_at, NOW())
        WHERE order_id = ?
          AND payment_mode = 'simulation'
      `,
      [order.id]
    );

    const [payments] =
      await connection.execute<PaymentRow[]>(
        `
          SELECT
            payment_status AS paymentStatus,
            payment_method AS paymentMethod,
            payment_mode AS paymentMode,
            paid_at AS paidAt
          FROM order_payments
          WHERE order_id = ?
          LIMIT 1
        `,
        [order.id]
      );

    const payment = payments[0];

    if (
      !payment ||
      payment.paymentStatus !== "paid"
    ) {
      throw new Error(
        "Pembayaran simulasi tidak dapat diselesaikan."
      );
    }

    await connection.commit();

    return {
      found: true as const,
      data: {
        orderNumber: order.orderNumber,
        orderStatus: order.status,
        total: Number(order.total),
        paymentStatus: payment.paymentStatus,
        paymentMethod: payment.paymentMethod,
        paymentMode: payment.paymentMode,
        paidAt: payment.paidAt,
      },
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
