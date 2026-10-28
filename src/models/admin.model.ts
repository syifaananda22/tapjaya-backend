
import pool from "../config/database";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

interface AdminRow extends RowDataPacket {
    id: number;
    username: string;
    email: string;
    password_hash: string;
}

export interface Admin {
    id: number;
    username: string;
    email: string;
    passwordHash: string;
}

function mapAdmin(row: AdminRow): Admin {
    return {
        id: row.id,
        username: row.username,
        email: row.email,
        passwordHash: row.password_hash,
    };
}

export async function findAdminByIdentifier(
    identifier: string
): Promise<Admin | null> {
    const [rows] = await pool.execute<AdminRow[]>(
        `SELECT id, username, email, password_hash
     FROM admins
     WHERE email = ? OR username = ?
     LIMIT 1`,
        [identifier, identifier]
    );

    if (rows.length === 0) {
        return null;
    }

    return mapAdmin(rows[0]);
}

export async function createAdmin(
    username: string,
    email: string,
    passwordHash: string
): Promise<Admin> {
    const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO admins (username, email, password_hash)
     VALUES (?, ?, ?)`,
        [username, email, passwordHash]
    );

    return {
        id: result.insertId,
        username,
        email,
        passwordHash,
    };
}
