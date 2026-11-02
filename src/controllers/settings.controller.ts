
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import * as Settings from "../models/settings.model";

// Ambil ID admin dari token login.
// Tidak menerima ID admin bebas dari frontend.
function getAdminId(req: Request): number | null {
  const authorization = req.headers.authorization;

  if (
    !authorization ||
    !authorization.startsWith("Bearer ") ||
    !process.env.JWT_SECRET
  ) {
    return null;
  }

  const token = authorization.slice(7);

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    if (
      typeof payload === "string" ||
      !payload.sub ||
      payload.role !== "admin"
    ) {
      return null;
    }

    const id = Number(payload.sub);

    return Number.isInteger(id) && id > 0
      ? id
      : null;
  } catch {
    return null;
  }
}

// GET /api/settings/profile
export async function getProfile(
  req: Request,
  res: Response
) {
  try {
    const id = getAdminId(req);

    if (!id) {
      return res.status(401).json({
        message: "Akses ditolak.",
      });
    }

    const data = await Settings.getAdminProfile(id);

    if (!data) {
      return res.status(404).json({
        message: "Admin tidak ditemukan.",
      });
    }

    return res.json({ data });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Gagal mengambil profil.",
    });
  }
}

// PUT /api/settings/profile
export async function updateProfile(
  req: Request,
  res: Response
) {
  try {
    const id = getAdminId(req);

    if (!id) {
      return res.status(401).json({
        message: "Akses ditolak.",
      });
    }

    const { username, email } = req.body ?? {};

    if (
      typeof username !== "string" ||
      !username.trim() ||
      username.trim().length > 50
    ) {
      return res.status(400).json({
        message: "Username tidak valid.",
      });
    }

    if (
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return res.status(400).json({
        message: "Email tidak valid.",
      });
    }

    const updated = await Settings.updateAdminProfile(
      id,
      username.trim(),
      email.trim().toLowerCase()
    );

    if (!updated) {
      return res.status(404).json({
        message: "Admin tidak ditemukan.",
      });
    }

    const data = await Settings.getAdminProfile(id);

    return res.json({
      message: "Profil berhasil diperbarui.",
      data,
    });
  } catch (error: unknown) {
    const dbError = error as { code?: string };

    if (dbError.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "Username atau email sudah digunakan.",
      });
    }

    console.error(error);

    return res.status(500).json({
      message: "Gagal memperbarui profil.",
    });
  }
}

// PUT /api/settings/password
export async function changePassword(
  req: Request,
  res: Response
) {
  try {
    const id = getAdminId(req);

    if (!id) {
      return res.status(401).json({
        message: "Akses ditolak.",
      });
    }

    const {
      currentPassword,
      newPassword,
      confirmPassword,
    } = req.body ?? {};

    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string" ||
      typeof confirmPassword !== "string"
    ) {
      return res.status(400).json({
        message: "Data password tidak lengkap.",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        message: "Password baru minimal 8 karakter.",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: "Konfirmasi password tidak cocok.",
      });
    }

    const admin = await Settings.findAdminById(id);

    if (!admin) {
      return res.status(404).json({
        message: "Admin tidak ditemukan.",
      });
    }

    const valid = await bcrypt.compare(
      currentPassword,
      String(admin.password_hash)
    );

    if (!valid) {
      return res.status(400).json({
        message: "Password lama salah.",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        message: "Password baru harus berbeda dari password lama.",
      });
    }

    const passwordHash = await bcrypt.hash(
      newPassword,
      10
    );

    await Settings.updatePassword(
      id,
      passwordHash
    );

    return res.json({
      message: "Password berhasil diperbarui.",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Gagal mengubah password.",
    });
  }
}

// GET /api/settings/store
export async function getStore(
  req: Request,
  res: Response
) {
  try {
    const data = await Settings.getStoreSettings();

    if (!data) {
      return res.status(404).json({
        message: "Informasi toko tidak ditemukan.",
      });
    }

    return res.json({ data });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Gagal mengambil informasi toko.",
    });
  }
}

// PUT /api/settings/store
export async function updateStore(
  req: Request,
  res: Response
) {
  try {
    const {
      storeName,
      address,
      phone,
      logo,
    } = req.body ?? {};

    if (
      typeof storeName !== "string" ||
      !storeName.trim() ||
      storeName.trim().length > 150
    ) {
      return res.status(400).json({
        message: "Nama toko tidak valid.",
      });
    }

    if (
      (address != null && typeof address !== "string") ||
      (phone != null && typeof phone !== "string") ||
      (logo != null && typeof logo !== "string")
    ) {
      return res.status(400).json({
        message: "Format informasi toko tidak valid.",
      });
    }

    if (
      (typeof phone === "string" && phone.length > 30) ||
      (typeof logo === "string" && logo.length > 255)
    ) {
      return res.status(400).json({
        message: "Nomor telepon atau path logo terlalu panjang.",
      });
    }

    const updated = await Settings.updateStoreSettings({
      storeName: storeName.trim(),
      address: typeof address === "string"
        ? address.trim()
        : null,
      phone: typeof phone === "string"
        ? phone.trim()
        : null,
      logo: typeof logo === "string"
        ? logo.trim()
        : null,
    });

    if (!updated) {
      return res.status(404).json({
        message: "Pengaturan toko tidak ditemukan.",
      });
    }

    const data = await Settings.getStoreSettings();

    return res.json({
      message: "Informasi toko berhasil diperbarui.",
      data,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Gagal memperbarui informasi toko.",
    });
  }
}
