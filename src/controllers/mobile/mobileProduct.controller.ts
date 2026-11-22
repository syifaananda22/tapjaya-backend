
import type {
  Request,
  Response,
} from "express";

import * as Product from "../../models/product.model";

// =====================================
// KATEGORI KATALOG PELANGGAN
// =====================================

const CUSTOMER_CATEGORIES = [
  "coffee",
  "non coffee",
  "makanan",
  "snack",
];

// =====================================
// NORMALISASI KATEGORI
// =====================================

function normalizeCategory(
  category: unknown
): string {
  return String(category ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// =====================================
// GET /api/mobile/products
// =====================================

export async function getMobileProducts(
  _req: Request,
  res: Response
) {
  try {
    // =====================================
    // AMBIL PRODUK AKTIF
    // =====================================

    const products =
      await Product.getProducts({
        status: "active",
      });

    // =====================================
    // FILTER KATEGORI PELANGGAN
    // =====================================

    const customerProducts =
      products.filter((product) => {
        const category =
          normalizeCategory(
            product.category
          );

        return CUSTOMER_CATEGORIES.includes(
          category
        );
      });

    // =====================================
    // AMBIL ADD-ON DARI MYSQL
    // =====================================

    const productIds =
      customerProducts.map(
        (product) => product.id
      );

    const addonMap =
      await Product.getActiveProductAddons(
        productIds
      );

    // =====================================
    // GABUNGKAN PRODUK DAN ADD-ON
    // =====================================

    const productsWithAddons =
      customerProducts.map((product) => ({
        ...product,
        addons:
          addonMap.get(product.id) ?? [],
      }));

    // =====================================
    // RESPONSE
    // =====================================

    return res.status(200).json({
      success: true,
      message:
        "Data produk dan add-on berhasil diambil.",
      total: productsWithAddons.length,
      data: productsWithAddons,
    });
  } catch (error) {
    console.error(
      "Gagal mengambil produk mobile:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Gagal mengambil data produk dan add-on.",
    });
  }
}
