
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
    findAdminByIdentifier,
    createAdmin,
} from "../models/admin.model";

// LOGIN ADMIN
export async function loginAdmin(
    req: Request,
    res: Response
): Promise<void> {
    try {
        const { email, password } = req.body ?? {};

        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            !email.trim() ||
            !password.trim()
        ) {
            res.status(400).json({
                message: "Email/username dan password wajib diisi.",
            });
            return;
        }

        const identifier = email.trim().toLowerCase();
        const admin = await findAdminByIdentifier(identifier);

        if (
            !admin ||
            !(await bcrypt.compare(password, admin.passwordHash))
        ) {
            res.status(401).json({
                message: "Email/username atau password salah.",
            });
            return;
        }

        const secret = process.env.JWT_SECRET;

        if (!secret) {
            res.status(500).json({
                message: "Konfigurasi server belum lengkap.",
            });
            return;
        }

        const token = jwt.sign(
            {
                sub: String(admin.id),
                role: "admin",
            },
            secret,
            {
                expiresIn: "1h",
                algorithm: "HS256",
            }
        );

        res.status(200).json({
            message: "Login berhasil",
            token,
            tokenType: "Bearer",
            expiresIn: 3600,
            admin: {
                id: admin.id,
                username: admin.username,
                email: admin.email,
            },
        });
    } catch (error) {
        console.error("Login error:", error);

        res.status(500).json({
            message: "Terjadi kesalahan pada server.",
        });
    }
}

// TAMBAH ADMIN
export async function registerAdmin(
    req: Request,
    res: Response
): Promise<void> {
    try {
        const setupKey = process.env.ADMIN_SETUP_KEY;

        if (
            !setupKey ||
            req.header("x-admin-setup-key") !== setupKey
        ) {
            res.status(403).json({
                message: "Tidak diizinkan menambah admin.",
            });
            return;
        }

        const { username, email, password } = req.body ?? {};

        if (
            typeof username !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string" ||
            !username.trim() ||
            !email.trim() ||
            password.length < 8
        ) {
            res.status(400).json({
                message: "Data tidak valid. Password minimal 8 karakter.",
            });
            return;
        }

        const normalizedUsername = username.trim().toLowerCase();
        const normalizedEmail = email.trim().toLowerCase();

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            res.status(400).json({
                message: "Format email tidak valid.",
            });
            return;
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const admin = await createAdmin(
            normalizedUsername,
            normalizedEmail,
            passwordHash
        );

        res.status(201).json({
            message: "Admin berhasil ditambahkan.",
            admin: {
                id: admin.id,
                username: admin.username,
                email: admin.email,
            },
        });
    } catch (error) {
        if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "ER_DUP_ENTRY"
        ) {
            res.status(409).json({
                message: "Username atau email sudah digunakan.",
            });
            return;
        }

        console.error("Register admin error:", error);

        res.status(500).json({
            message: "Terjadi kesalahan pada server.",
        });
    }
}
