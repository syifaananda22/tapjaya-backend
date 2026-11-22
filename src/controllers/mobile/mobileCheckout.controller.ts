
import type { Request, Response } from "express";

import {
  createMobileCheckout,
  CheckoutError,
} from "../../services/mobile/mobileCheckout.service";

// =====================================
// TYPES
// =====================================

type OrderType = "Dine-in" | "Takeaway";

type ProductSize = "Regular" | "Medium" | "Large";

type NormalizedCheckoutItem = {
  productId: number;
  quantity: number;
  size: ProductSize;
  addonIds: number[];
  extraShot: boolean;
  lessIce: boolean;
  lessSugar: boolean;
  note: string;
};

// =====================================
// NORMALISASI JENIS PESANAN
// =====================================

function normalizeOrderType(
  value: unknown
): OrderType | null {
  if (
    value === "Dine-in" ||
    value === "Makan di Tempat"
  ) {
    return "Dine-in";
  }

  if (
    value === "Takeaway" ||
    value === "Bawa Pulang"
  ) {
    return "Takeaway";
  }

  return null;
}

// =====================================
// NORMALISASI UKURAN PRODUK
// =====================================

function normalizeProductSize(
  value: unknown
): ProductSize | null {
  if (value === undefined || value === null) {
    return "Regular";
  }

  if (typeof value !== "string") {
    return null;
  }

  const size = value.trim().toLowerCase();

  switch (size) {
    case "":
    case "regular":
    case "small":
      return "Regular";

    case "medium":
      return "Medium";

    case "large":
      return "Large";

    default:
      return null;
  }
}

// =====================================
// NORMALISASI BOOLEAN
// =====================================

function normalizeBoolean(
  value: unknown
): boolean | null {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return null;
}

// =====================================
// NORMALISASI ID ADD-ON
// =====================================

function normalizeAddonIds(
  value: unknown
): number[] | null {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const addonIds: number[] = [];
  const uniqueIds = new Set<number>();

  for (const rawId of value) {
    // ID harus berupa bilangan bulat.
    // String angka diterima untuk kompatibilitas.
    if (
      typeof rawId !== "number" &&
      typeof rawId !== "string"
    ) {
      return null;
    }

    if (
      typeof rawId === "string" &&
      !/^[0-9]+$/.test(rawId.trim())
    ) {
      return null;
    }

    const addonId = Number(rawId);

    if (
      !Number.isSafeInteger(addonId) ||
      addonId <= 0
    ) {
      return null;
    }

    if (uniqueIds.has(addonId)) {
      return null;
    }

    uniqueIds.add(addonId);
    addonIds.push(addonId);
  }

  return addonIds.sort((a, b) => a - b);
}

// =====================================
// CREATE MOBILE CHECKOUT
// =====================================

export async function mobileCheckout(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const {
      customerName,
      orderType,
      tableNumber,
      customerNote,
      items,
      orderItems,
    } = req.body ?? {};

    // =====================================
    // VALIDASI NAMA PELANGGAN
    // =====================================

    if (
      typeof customerName !== "string" ||
      !customerName.trim()
    ) {
      res.status(400).json({
        success: false,
        message: "Nama pelanggan wajib diisi.",
      });
      return;
    }

    if (customerName.trim().length > 100) {
      res.status(400).json({
        success: false,
        message:
          "Nama pelanggan maksimal 100 karakter.",
      });
      return;
    }

    // =====================================
    // VALIDASI JENIS PESANAN
    // =====================================

    const normalizedOrderType =
      normalizeOrderType(orderType);

    if (!normalizedOrderType) {
      res.status(400).json({
        success: false,
        message:
          "Jenis pesanan harus Dine-in atau Takeaway.",
      });
      return;
    }

    // =====================================
    // VALIDASI NOMOR MEJA
    // =====================================

    if (
      tableNumber !== undefined &&
      tableNumber !== null &&
      typeof tableNumber !== "string" &&
      typeof tableNumber !== "number"
    ) {
      res.status(400).json({
        success: false,
        message: "Nomor meja tidak valid.",
      });
      return;
    }

    const normalizedTableNumber =
      tableNumber == null
        ? ""
        : String(tableNumber).trim();

    if (
      normalizedOrderType === "Dine-in" &&
      !normalizedTableNumber
    ) {
      res.status(400).json({
        success: false,
        message:
          "Nomor meja wajib diisi untuk Dine-in.",
      });
      return;
    }

    if (
      normalizedTableNumber.length > 20
    ) {
      res.status(400).json({
        success: false,
        message:
          "Nomor meja maksimal 20 karakter.",
      });
      return;
    }

    // =====================================
    // VALIDASI CATATAN PELANGGAN
    // =====================================

    if (
      customerNote !== undefined &&
      customerNote !== null &&
      typeof customerNote !== "string"
    ) {
      res.status(400).json({
        success: false,
        message:
          "Catatan pelanggan harus berupa teks.",
      });
      return;
    }

    // =====================================
    // VALIDASI ITEM PESANAN
    // =====================================

    const submittedItems = items ?? orderItems;

    if (
      !Array.isArray(submittedItems) ||
      submittedItems.length === 0
    ) {
      res.status(400).json({
        success: false,
        message:
          "Keranjang pesanan tidak boleh kosong.",
      });
      return;
    }

    const normalizedItems: NormalizedCheckoutItem[] =
      [];

    // Digunakan untuk menggabungkan item
    // yang benar-benar memiliki konfigurasi sama.
    const itemIndexes = new Map<string, number>();

    for (const rawItem of submittedItems) {
      if (
        rawItem === null ||
        typeof rawItem !== "object" ||
        Array.isArray(rawItem)
      ) {
        res.status(400).json({
          success: false,
          message:
            "Format item pesanan tidak valid.",
        });
        return;
      }

      // =====================================
      // VALIDASI ID DAN QUANTITY
      // =====================================

      const rawProductId =
        rawItem.productId ?? rawItem.id;

      const rawQuantity = rawItem.quantity;

      if (
        (typeof rawProductId !== "number" &&
          typeof rawProductId !== "string") ||
        (typeof rawQuantity !== "number" &&
          typeof rawQuantity !== "string")
      ) {
        res.status(400).json({
          success: false,
          message:
            "ID produk atau jumlah pesanan tidak valid.",
        });
        return;
      }

      const productId = Number(rawProductId);
      const quantity = Number(rawQuantity);

      if (
        !Number.isSafeInteger(productId) ||
        productId <= 0 ||
        !Number.isSafeInteger(quantity) ||
        quantity <= 0
      ) {
        res.status(400).json({
          success: false,
          message:
            "ID produk atau jumlah pesanan tidak valid.",
        });
        return;
      }

      // =====================================
      // VALIDASI UKURAN
      // =====================================

      const size = normalizeProductSize(
        rawItem.size
      );

      if (!size) {
        res.status(400).json({
          success: false,
          message:
            "Ukuran produk harus Regular, Medium, atau Large.",
        });
        return;
      }

      // =====================================
      // VALIDASI ADD-ON
      // =====================================

      const addonIds = normalizeAddonIds(
        rawItem.addonIds
      );

      if (addonIds === null) {
        res.status(400).json({
          success: false,
          message:
            "Daftar add-on tidak valid atau memiliki ID duplikat.",
        });
        return;
      }

      // =====================================
      // VALIDASI KUSTOMISASI
      // =====================================

      const extraShot = normalizeBoolean(
        rawItem.extraShot
      );

      const lessIce = normalizeBoolean(
        rawItem.lessIce
      );

      const lessSugar = normalizeBoolean(
        rawItem.lessSugar
      );

      if (
        extraShot === null ||
        lessIce === null ||
        lessSugar === null
      ) {
        res.status(400).json({
          success: false,
          message:
            "Format pilihan kustomisasi tidak valid.",
        });
        return;
      }

      if (
        rawItem.note !== undefined &&
        rawItem.note !== null &&
        typeof rawItem.note !== "string"
      ) {
        res.status(400).json({
          success: false,
          message:
            "Catatan produk harus berupa teks.",
        });
        return;
      }

      const note =
        typeof rawItem.note === "string"
          ? rawItem.note.trim()
          : "";

      if (note.length > 1000) {
        res.status(400).json({
          success: false,
          message:
            "Catatan produk maksimal 1000 karakter.",
        });
        return;
      }

      // =====================================
      // IDENTITAS KONFIGURASI ITEM
      // =====================================

      // Produk dan ukuran yang sama tetap
      // menjadi item berbeda jika add-on,
      // kustomisasi, atau catatannya berbeda.

      const itemKey = JSON.stringify({
        productId,
        size,
        addonIds,
        extraShot,
        lessIce,
        lessSugar,
        note,
      });

      const existingIndex =
        itemIndexes.get(itemKey);

      if (existingIndex !== undefined) {
        // Item dengan konfigurasi identik
        // digabungkan jumlahnya.
        const existingItem =
          normalizedItems[existingIndex];

        const combinedQuantity =
          existingItem.quantity + quantity;

        if (
          !Number.isSafeInteger(combinedQuantity)
        ) {
          res.status(400).json({
            success: false,
            message:
              "Jumlah produk melebihi batas yang didukung.",
          });
          return;
        }

        existingItem.quantity =
          combinedQuantity;
      } else {
        itemIndexes.set(
          itemKey,
          normalizedItems.length
        );

        normalizedItems.push({
          productId,
          quantity,
          size,
          addonIds,
          extraShot,
          lessIce,
          lessSugar,
          note,
        });
      }
    }

    // =====================================
    // SIMPAN PESANAN MELALUI SERVICE
    // =====================================

    const data = await createMobileCheckout({
      customerName: customerName.trim(),

      orderType: normalizedOrderType,

      tableNumber:
        normalizedOrderType === "Dine-in"
          ? normalizedTableNumber
          : null,

      customerNote:
        typeof customerNote === "string"
          ? customerNote.trim()
          : null,

      items: normalizedItems,
    });

    // =====================================
    // RESPONSE BERHASIL
    // =====================================

    res.status(201).json({
      success: true,
      message: "Pesanan berhasil dibuat.",
      data,
    });
  } catch (error) {
    // =====================================
    // ERROR DARI SERVICE
    // =====================================

    if (error instanceof CheckoutError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }

    // =====================================
    // ERROR TIDAK TERDUGA
    // =====================================

    console.error(
      "Mobile checkout error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Terjadi kesalahan saat membuat pesanan.",
    });
  }
}