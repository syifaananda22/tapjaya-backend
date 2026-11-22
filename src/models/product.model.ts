
import pool from "../config/database";
import type {
  RowDataPacket,
  ResultSetHeader,
} from "mysql2";

// =====================================
// PRODUCT TYPES
// =====================================

export interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  price_medium: number | null;
  price_large: number | null;
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

export interface ProductAddon {
  id: number;
  name: string;
  price: number;
}

interface ProductRow extends RowDataPacket {
  id: number;
  name: string;
  category: string;
  price: number | string;
  price_medium: number | string | null;
  price_large: number | string | null;
  stock: number;
  image: string | null;
  is_active: number;
  created_at: Date;
  updated_at: Date;
}

interface ProductAddonRow extends RowDataPacket {
  product_id: number;
  id: number;
  name: string;
  price: number | string;
}

// =====================================
// NORMALISASI PRODUCT ROW
// =====================================

function mapProduct(row: ProductRow): Product {
  return {
    ...row,
    id: Number(row.id),
    price: Number(row.price),
    price_medium:
      row.price_medium == null
        ? null
        : Number(row.price_medium),
    price_large:
      row.price_large == null
        ? null
        : Number(row.price_large),
    stock: Number(row.stock),
    is_active: Boolean(row.is_active),
  };
}

// =====================================
// GET ALL PRODUCTS
// =====================================

export async function getProducts(
  filters: {
    search?: string;
    category?: string;
    status?: string;
  } = {}
): Promise<Product[]> {
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
    `SELECT *
     FROM products
     ${where}
     ORDER BY created_at DESC, id DESC`,
    params
  );

  return rows.map(mapProduct);
}

// =====================================
// GET PRODUCT BY ID
// =====================================

export async function getProductById(
  id: number
): Promise<Product | null> {
  const [rows] = await pool.execute<ProductRow[]>(
    `SELECT *
     FROM products
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  if (rows.length === 0) {
    return null;
  }

  return mapProduct(rows[0]);
}

// =====================================
// GET ACTIVE PRODUCT ADD-ONS
// =====================================

// Mengambil add-on aktif yang benar-benar
// terhubung dengan produk melalui tabel
// product_addon_options.
//
// Jika productIds kosong, hasilnya kosong.
// Tidak ada ID atau harga yang ditulis manual.

export async function getActiveProductAddons(
  productIds: number[]
): Promise<Map<number, ProductAddon[]>> {
  const uniqueIds = [
    ...new Set(
      productIds.filter(
        (id) =>
          Number.isInteger(id) &&
          id > 0
      )
    ),
  ];

  const addonMap = new Map<
    number,
    ProductAddon[]
  >();

  for (const id of uniqueIds) {
    addonMap.set(id, []);
  }

  if (uniqueIds.length === 0) {
    return addonMap;
  }

  const placeholders = uniqueIds
    .map(() => "?")
    .join(", ");

  const [rows] =
    await pool.query<ProductAddonRow[]>(
      `SELECT
         pa.product_id,
         a.id,
         a.name,
         a.price
       FROM product_addon_options AS pa
       INNER JOIN product_addons AS a
         ON a.id = pa.addon_id
       WHERE pa.product_id IN (${placeholders})
         AND a.is_active = 1
       ORDER BY
         pa.product_id ASC,
         a.id ASC`,
      uniqueIds
    );

  for (const row of rows) {
    const productId = Number(row.product_id);

    const addon: ProductAddon = {
      id: Number(row.id),
      name: String(row.name),
      price: Number(row.price),
    };

    const existing = addonMap.get(productId);

    if (existing) {
      existing.push(addon);
    } else {
      addonMap.set(productId, [addon]);
    }
  }

  return addonMap;
}

// =====================================
// CREATE PRODUCT
// =====================================

export async function createProduct(
  data: ProductInput
) {
  const [result] =
    await pool.execute<ResultSetHeader>(
      `INSERT INTO products
        (
          name,
          category,
          price,
          stock,
          image,
          is_active
        )
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

// =====================================
// UPDATE PRODUCT
// =====================================

export async function updateProduct(
  id: number,
  data: ProductInput
) {
  const [result] =
    await pool.execute<ResultSetHeader>(
      `UPDATE products
       SET
         name = ?,
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

  if (!result.affectedRows) {
    return null;
  }

  return getProductById(id);
}

// =====================================
// SET PRODUCT STATUS
// =====================================

export async function setProductStatus(
  id: number,
  active: boolean
) {
  const [result] =
    await pool.execute<ResultSetHeader>(
      `UPDATE products
       SET is_active = ?
       WHERE id = ?`,
      [
        active ? 1 : 0,
        id,
      ]
    );

  return result.affectedRows > 0;
}

// =====================================
// DELETE PRODUCT
// =====================================

export async function deleteProduct(
  id: number
) {
  const [result] =
    await pool.execute<ResultSetHeader>(
      `DELETE FROM products
       WHERE id = ?`,
      [id]
    );

  return result.affectedRows > 0;
}