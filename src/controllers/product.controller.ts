
import type { Request, Response } from "express";
import * as Product from "../models/product.model";

// Batas harga sesuai revisi dosen
const MIN_PRICE = 10000;
const MAX_PRICE = 100000000;

// Memvalidasi input produk
function validateProduct(body: unknown): string | null {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return "Data produk tidak valid.";
  }

  const data = body as Record<string, unknown>;

  // Validasi nama produk
  if (
    typeof data.name !== "string" ||
    !data.name.trim()
  ) {
    return "Nama produk wajib diisi.";
  }

  // Validasi kategori
  if (
    typeof data.category !== "string" ||
    !data.category.trim()
  ) {
    return "Kategori wajib diisi.";
  }

  // Validasi harga produk
  if (
    data.price === null ||
    data.price === undefined ||
    data.price === "" ||
    (typeof data.price !== "string" &&
      typeof data.price !== "number") ||
    !Number.isInteger(Number(data.price)) ||
    Number(data.price) < MIN_PRICE ||
    Number(data.price) > MAX_PRICE
  ) {
    return "Harga minimal Rp10.000 dan maksimal Rp100.000.000.";
  }

  // Validasi stok produk
  if (
    data.stock === null ||
    data.stock === undefined ||
    data.stock === "" ||
    (typeof data.stock !== "string" &&
      typeof data.stock !== "number") ||
    !Number.isInteger(Number(data.stock)) ||
    Number(data.stock) < 0
  ) {
    return "Stok harus berupa bilangan bulat minimal 0.";
  }

  // Validasi gambar
  if (
    data.image != null &&
    typeof data.image !== "string"
  ) {
    return "Format gambar tidak valid.";
  }

  // Validasi status produk
  if (
    data.is_active !== undefined &&
    typeof data.is_active !== "boolean"
  ) {
    return "Status produk tidak valid.";
  }

  return null;
}

// GET /api/products
export async function listProducts(
  req: Request,
  res: Response
) {
  try {
    const data = await Product.getProducts({
      search:
        typeof req.query.search === "string"
          ? req.query.search
          : undefined,

      category:
        typeof req.query.category === "string"
          ? req.query.category
          : undefined,

      status:
        typeof req.query.status === "string"
          ? req.query.status
          : undefined,
    });

    return res.json({ data });
  } catch (error) {
    console.error(
      "Gagal mengambil produk:",
      error
    );

    return res.status(500).json({
      message: "Gagal mengambil produk.",
    });
  }
}

// GET /api/products/:id
export async function getProduct(
  req: Request,
  res: Response
) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "ID produk tidak valid.",
      });
    }

    const data =
      await Product.getProductById(id);

    if (!data) {
      return res.status(404).json({
        message: "Produk tidak ditemukan.",
      });
    }

    return res.json({ data });
  } catch (error) {
    console.error(
      "Gagal mengambil detail produk:",
      error
    );

    return res.status(500).json({
      message: "Gagal mengambil detail produk.",
    });
  }
}

// POST /api/products
export async function addProduct(
  req: Request,
  res: Response
) {
  try {
    const error = validateProduct(req.body);

    if (error) {
      return res.status(400).json({
        message: error,
      });
    }

    const data =
      await Product.createProduct({
        ...req.body,
        price: Number(req.body.price),
        stock: Number(req.body.stock),
      });

    return res.status(201).json({
      message: "Produk berhasil ditambahkan.",
      data,
    });
  } catch (error) {
    console.error(
      "Gagal menambahkan produk:",
      error
    );

    return res.status(500).json({
      message: "Gagal menambahkan produk.",
    });
  }
}

// PUT /api/products/:id
export async function editProduct(
  req: Request,
  res: Response
) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "ID produk tidak valid.",
      });
    }

    const error = validateProduct(req.body);

    if (error) {
      return res.status(400).json({
        message: error,
      });
    }

    const data =
      await Product.updateProduct(id, {
        ...req.body,
        price: Number(req.body.price),
        stock: Number(req.body.stock),
      });

    if (!data) {
      return res.status(404).json({
        message: "Produk tidak ditemukan.",
      });
    }

    return res.json({
      message: "Produk berhasil diperbarui.",
      data,
    });
  } catch (error) {
    console.error(
      "Gagal memperbarui produk:",
      error
    );

    return res.status(500).json({
      message: "Gagal memperbarui produk.",
    });
  }
}

// PATCH /api/products/:id/status
export async function changeProductStatus(
  req: Request,
  res: Response
) {
  try {
    const id = Number(req.params.id);
    const isActive = req.body?.is_active;

    if (
      !Number.isInteger(id) ||
      id <= 0 ||
      typeof isActive !== "boolean"
    ) {
      return res.status(400).json({
        message: "Data status tidak valid.",
      });
    }

    const updated =
      await Product.setProductStatus(
        id,
        isActive
      );

    if (!updated) {
      return res.status(404).json({
        message: "Produk tidak ditemukan.",
      });
    }

    return res.json({
      message:
        "Status produk berhasil diperbarui.",
    });
  } catch (error) {
    console.error(
      "Gagal mengubah status:",
      error
    );

    return res.status(500).json({
      message:
        "Gagal mengubah status produk.",
    });
  }
}

// DELETE /api/products/:id
export async function removeProduct(
  req: Request,
  res: Response
) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "ID produk tidak valid.",
      });
    }

    // Menonaktifkan produk agar
    // riwayat transaksi tetap aman.
    const deleted =
      await Product.setProductStatus(
        id,
        false
      );

    if (!deleted) {
      return res.status(404).json({
        message: "Produk tidak ditemukan.",
      });
    }

    return res.json({
      message:
        "Produk berhasil dinonaktifkan.",
    });
  } catch (error) {
    console.error(
      "Gagal menonaktifkan produk:",
      error
    );

    return res.status(500).json({
      message:
        "Gagal menonaktifkan produk.",
    });
  }
}
