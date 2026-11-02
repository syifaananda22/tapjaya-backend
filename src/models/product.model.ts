
import pool from "../config/database";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  stock: number;
  image: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ProductInput {
  name: string;
  category: string;
  price: number;
  stock: number;
  image?: string | null;
  is_active?: boolean;
}

interface ProductRow extends RowDataPacket {
  id: number;
  name: string;
  category: string;
  price: number;
  stock: number;
  image: string | null;
  is_active: number;
  created_at: Date;
  updated_at: Date;
}

// Mengambil seluruh produk beserta filter
export async function getProducts(filters: {
  search?: string;
  category?: string;
  status?: string;
} = {}) {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.search?.trim()) {
    conditions.push("name LIKE ?");
    params.push(`%${filters.search.trim()}%`);
  }

  if (filters.category?.trim()) {
    conditions.push("category = ?");
    params.push(filters.category);
  }

  if (filters.status === "active") {
    conditions.push("is_active = 1");
  }

  if (filters.status === "inactive") {
    conditions.push("is_active = 0");
  }

  const where = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const [rows] = await pool.execute<ProductRow[]>(
    `SELECT * FROM products
     ${where}
     ORDER BY created_at DESC, id DESC`,
    params
  );

  return rows.map((row) => ({
    ...row,
    id: Number(row.id),
    price: Number(row.price),
    stock: Number(row.stock),
    is_active: Boolean(row.is_active),
  }));
}

// Mengambil satu produk berdasarkan ID
export async function getProductById(id: number) {
  const [rows] = await pool.execute<ProductRow[]>(
    "SELECT * FROM products WHERE id = ? LIMIT 1",
    [id]
  );

  if (!rows.length) return null;

  const row = rows[0];

  return {
    ...row,
    id: Number(row.id),
    price: Number(row.price),
    stock: Number(row.stock),
    is_active: Boolean(row.is_active),
  };
}

// Menambahkan produk baru
export async function createProduct(data: ProductInput) {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO products
      (name, category, price, stock, image, is_active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.name.trim(),
      data.category.trim(),
      data.price,
      data.stock,
      data.image ?? null,
      data.is_active === false ? 0 : 1,
    ]
  );

  return getProductById(result.insertId);
}

// Memperbarui produk
export async function updateProduct(
  id: number,
  data: ProductInput
) {
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE products
     SET name = ?,
         category = ?,
         price = ?,
         stock = ?,
         image = ?,
         is_active = ?
     WHERE id = ?`,
    [
      data.name.trim(),
      data.category.trim(),
      data.price,
      data.stock,
      data.image ?? null,
      data.is_active === false ? 0 : 1,
      id,
    ]
  );

  if (!result.affectedRows) return null;

  return getProductById(id);
}

// Mengubah status aktif atau nonaktif produk
export async function setProductStatus(
  id: number,
  active: boolean
) {
  const [result] = await pool.execute<ResultSetHeader>(
    "UPDATE products SET is_active = ? WHERE id = ?",
    [active ? 1 : 0, id]
  );

  return result.affectedRows > 0;
}

// Menghapus produk secara permanen
export async function deleteProduct(id: number) {
  const [result] = await pool.execute<ResultSetHeader>(
    "DELETE FROM products WHERE id = ?",
    [id]
  );

  return result.affectedRows > 0;
}
