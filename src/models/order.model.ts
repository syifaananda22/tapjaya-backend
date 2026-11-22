
import pool from "../config/database";

import type {
  RowDataPacket,
  ResultSetHeader,
} from "mysql2";

// =====================================
// TYPES
// =====================================

export type OrderStatus =
  | "Menunggu"
  | "Diproses"
  | "Siap"
  | "Selesai";

export type OrderFilters = {
  search?: string;
  status?: OrderStatus | "";
  startDate?: string;
  endDate?: string;
};

type OrderRow = RowDataPacket & {
  id: number;
  orderNumber: string;
  date: string;
  time: string;
  customerName: string;
  tableNumber: string | null;
  orderType: "Dine-in" | "Takeaway";
  status: OrderStatus;
  customerNote: string | null;
  adminNote: string | null;
  total: number;
  menu: string | null;
  image: string | null;
};

type OrderItemRow = RowDataPacket & {
  id: number;
  productId: number | null;
  name: string;
  image: string | null;
  quantity: number;
  price: number;
  subtotal: number;
};

// =====================================
// HELPER
// =====================================

function normalizeIdentifier(identifier: string) {
  return identifier.trim().replace(/^#/, "");
}

function mapOrder(row: OrderRow) {
  return {
    ...row,
    id: Number(row.id),
    total: Number(row.total),
  };
}

// =====================================
// GET ALL ORDERS
// =====================================

export async function getOrders(
  filters: OrderFilters = {}
) {
  const conditions: string[] = [];
  const params: string[] = [];

  if (filters.search?.trim()) {
    const keyword = `%${filters.search.trim()}%`;

    conditions.push(`
      (
        o.order_number LIKE ?
        OR o.customer_name LIKE ?
        OR EXISTS (
          SELECT 1
          FROM order_items oi
          WHERE oi.order_id = o.id
            AND oi.product_name LIKE ?
        )
      )
    `);

    params.push(keyword, keyword, keyword);
  }

  if (filters.status) {
    conditions.push("o.status = ?");
    params.push(filters.status);
  }

  if (filters.startDate) {
    conditions.push("o.ordered_at >= ?");
    params.push(`${filters.startDate} 00:00:00`);
  }

  if (filters.endDate) {
    conditions.push(
      "o.ordered_at < DATE_ADD(?, INTERVAL 1 DAY)"
    );
    params.push(filters.endDate);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const [rows] = await pool.execute<OrderRow[]>(
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
        o.admin_note AS adminNote,
        o.total,
        (
          SELECT oi.product_name
          FROM order_items oi
          WHERE oi.order_id = o.id
          ORDER BY oi.id ASC
          LIMIT 1
        ) AS menu,
        (
          SELECT oi.product_image
          FROM order_items oi
          WHERE oi.order_id = o.id
          ORDER BY oi.id ASC
          LIMIT 1
        ) AS image
      FROM orders o
      ${whereClause}
      ORDER BY
        o.ordered_at DESC,
        o.id DESC
    `,
    params
  );

  return rows.map(mapOrder);
}

// =====================================
// GET ORDER DETAIL
// =====================================

export async function getOrderByIdentifier(
  identifier: string
) {
  const normalized =
    normalizeIdentifier(identifier);

  if (!normalized) {
    return null;
  }

  const [rows] = await pool.execute<OrderRow[]>(
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
        o.admin_note AS adminNote,
        o.total,
        (
          SELECT oi.product_name
          FROM order_items oi
          WHERE oi.order_id = o.id
          ORDER BY oi.id ASC
          LIMIT 1
        ) AS menu,
        (
          SELECT oi.product_image
          FROM order_items oi
          WHERE oi.order_id = o.id
          ORDER BY oi.id ASC
          LIMIT 1
        ) AS image
      FROM orders o
      WHERE o.order_number = ?
         OR CAST(o.id AS CHAR) = ?
      LIMIT 1
    `,
    [normalized, normalized]
  );

  if (rows.length === 0) {
    return null;
  }

  const order = rows[0];

  const [items] =
    await pool.execute<OrderItemRow[]>(
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
    ...mapOrder(order),

    items: items.map((item) => ({
      ...item,
      id: Number(item.id),
      productId:
        item.productId === null
          ? null
          : Number(item.productId),
      quantity: Number(item.quantity),
      price: Number(item.price),
      subtotal: Number(item.subtotal),
    })),
  };
}

// =====================================
// UPDATE ORDER STATUS
// =====================================

export async function updateOrderStatus(
  identifier: string,
  status: OrderStatus,
  adminNote?: string
) {
  const normalized =
    normalizeIdentifier(identifier);

  if (!normalized) {
    return false;
  }

  const [result] =
    await pool.execute<ResultSetHeader>(
      `
        UPDATE orders
        SET
          status = ?,
          admin_note = COALESCE(
            ?,
            admin_note
          )
        WHERE order_number = ?
           OR CAST(id AS CHAR) = ?
      `,
      [
        status,
        adminNote?.trim() || null,
        normalized,
        normalized,
      ]
    );

  return result.affectedRows > 0;
}