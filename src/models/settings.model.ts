
import pool from "../config/database";
import type {
  RowDataPacket,
  ResultSetHeader,
} from "mysql2";

// Mengambil profil admin berdasarkan ID dari JWT
export async function getAdminProfile(id: number) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, username, email
     FROM admins
     WHERE id = ?`,
    [id]
  );

  return rows[0] ?? null;
}

// Mengubah username dan email admin
export async function updateAdminProfile(
  id: number,
  username: string,
  email: string
) {
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE admins
     SET username = ?, email = ?
     WHERE id = ?`,
    [username, email, id]
  );

  return result.affectedRows > 0;
}

// Mengambil pengaturan informasi toko
export async function getStoreSettings() {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT *
     FROM store_settings
     WHERE id = 1`
  );

  return rows[0] ?? null;
}

// Menyimpan informasi toko
export async function updateStoreSettings(data: {
  storeName: string;
  address: string | null;
  phone: string | null;
  logo: string | null;
}) {
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE store_settings
     SET store_name = ?,
         address = ?,
         phone = ?,
         logo = ?
     WHERE id = 1`,
    [
      data.storeName,
      data.address,
      data.phone,
      data.logo,
    ]
  );

  return result.affectedRows > 0;
}

// Mengganti hash password admin
export async function updatePassword(
  id: number,
  passwordHash: string
) {
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE admins
     SET password_hash = ?
     WHERE id = ?`,
    [passwordHash, id]
  );

  return result.affectedRows > 0;
}

// Mengambil hash password untuk verifikasi
export async function findAdminById(id: number) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, password_hash
     FROM admins
     WHERE id = ?`,
    [id]
  );

  return rows[0] ?? null;
}
