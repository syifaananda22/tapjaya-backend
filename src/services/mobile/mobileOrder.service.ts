
import pool from "../../config/database";
import type { RowDataPacket } from "mysql2";

type MobileOrderStatus =
  | "Menunggu"
  | "Diproses"
  | "Siap"
  | "Selesai";

interface MobileOrderRow extends RowDataPacket {
  id: number;
  orderNumber: string;
  date: string;
  time: string;
  customerName: string;
  tableNumber: string | null;
  orderType: "Dine-in" | "Takeaway";
  status: MobileOrderStatus;
  customerNote: string | null;
  total: number | string;
  paymentStatus: "pending" | "paid";
  paymentMethod: string | null;
  paymentMode: string | null;
}

interface MobileOrderItemRow extends RowDataPacket {
  id: number;
  productId: number | null;
  name: string;
  image: string | null;
  quantity: number;
  price: number | string;
  subtotal: number | string;
}

export async function getMobileOrderByNumber(
  orderNumber: string
) {
  const normalizedOrderNumber = orderNumber
    .trim()
    .replace(/^#/, "");

  if (!normalizedOrderNumber) {
    return null;
  }

  const [rows] =
    await pool.execute<MobileOrderRow[]>(
      `
        SELECT
          o.id,
          o.order_number AS orderNumber,
          DATE_FORMAT(
            o.ordered_at,
            '%Y-%m-%d'
          ) AS date,
          DATE_FORMAT(
            o.ordered_at,
            '%H:%i'
          ) AS time,
          o.customer_name AS customerName,
          o.table_number AS tableNumber,
          o.order_type AS orderType,
          o.status,
          o.customer_note AS customerNote,
          o.total,
          COALESCE(
            p.payment_status,
            'pending'
          ) AS paymentStatus,
          p.payment_method AS paymentMethod,
          p.payment_mode AS paymentMode
        FROM orders o
        LEFT JOIN order_payments p
          ON p.order_id = o.id
        WHERE o.order_number = ?
        LIMIT 1
      `,
      [normalizedOrderNumber]
    );

  if (rows.length === 0) {
    return null;
  }

  const order = rows[0];

  const [items] =
    await pool.execute<MobileOrderItemRow[]>(
      `
        SELECT
          id,
          product_id AS productId,
          product_name AS name,
          product_image AS image,
          quantity,
          unit_price AS price,
          subtotal
        FROM order_items
        WHERE order_id = ?
        ORDER BY id ASC
      `,
      [order.id]
    );

  return {
    id: Number(order.id),
    orderNumber: order.orderNumber,
    date: order.date,
    time: order.time,
    customerName: order.customerName,
    tableNumber: order.tableNumber,
    orderType: order.orderType,
    status: order.status,
    customerNote: order.customerNote,
    total: Number(order.total),

    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    paymentMode: order.paymentMode,

    items: items.map((item) => ({
      id: Number(item.id),
      productId:
        item.productId === null
          ? null
          : Number(item.productId),
      name: item.name,
      image: item.image,
      quantity: Number(item.quantity),
      price: Number(item.price),
      subtotal: Number(item.subtotal),
    })),
  };
}
