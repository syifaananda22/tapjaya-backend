
import pool from "../../config/database";

import type {
  ResultSetHeader,
  RowDataPacket,
} from "mysql2";

import { randomBytes } from "crypto";

// =====================================
// TYPES
// =====================================

type ProductSize = "Regular" | "Medium" | "Large";

type CheckoutItem = {
  productId: number;
  quantity: number;
  size?: ProductSize;

  addonIds?: number[];

  // Kompatibilitas dengan Flutter lama.
  extraShot?: boolean;

  lessIce?: boolean;
  lessSugar?: boolean;
  note?: string;
};

type CheckoutInput = {
  customerName: string;
  orderType: "Dine-in" | "Takeaway";
  tableNumber?: string | null;
  customerNote?: string | null;
  items: CheckoutItem[];
};

type ProductRow = RowDataPacket & {
  id: number;
  name: string;
  price: number | string;
  price_medium: number | string | null;
  price_large: number | string | null;
  stock: number;
  image: string | null;
  is_active: number;
};

type AddonRow = RowDataPacket & {
  id: number;
  name: string;
  price: number | string;
  is_active: number;
};

type ValidatedItem = {
  productId: number;
  quantity: number;
  size: ProductSize;
  addonIds: number[];
  extraShot: boolean;
  lessIce: boolean;
  lessSugar: boolean;
  note: string | null;
};

type SavedAddon = {
  addonId: number;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
};

type SavedOrderItem = {
  productId: number;
  name: string;
  image: string | null;
  quantity: number;
  size: ProductSize;
  basePrice: number;
  addonTotal: number;
  price: number;
  subtotal: number;
  extraShot: boolean;
  lessIce: boolean;
  lessSugar: boolean;
  note: string | null;
  addons: SavedAddon[];
};

// =====================================
// CUSTOM ERROR
// =====================================

export class CheckoutError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

// =====================================
// HELPER: NORMALISASI UKURAN
// =====================================

function normalizeSize(
  size: string | undefined
): ProductSize {
  if (size === undefined || size === "Regular") {
    return "Regular";
  }

  if (size === "Medium" || size === "Large") {
    return size;
  }

  throw new CheckoutError(
    "Ukuran produk tidak valid."
  );
}

// =====================================
// HELPER: VALIDASI HARGA
// =====================================

function parsePrice(
  value: number | string | null,
  label: string
): number {
  if (value === null || value === undefined) {
    throw new CheckoutError(
      `${label} tidak tersedia.`
    );
  }

  const price = Number(value);

  if (
    !Number.isSafeInteger(price) ||
    price < 0
  ) {
    throw new CheckoutError(
      `${label} tidak valid.`,
      500
    );
  }

  return price;
}

// =====================================
// HELPER: HARGA BERDASARKAN UKURAN
// =====================================

function getProductPrice(
  product: ProductRow,
  size: ProductSize
): number {
  switch (size) {
    case "Medium":
      if (product.price_medium === null) {
        throw new CheckoutError(
          `Ukuran Medium tidak tersedia untuk ${product.name}.`
        );
      }

      return parsePrice(
        product.price_medium,
        `Harga Medium ${product.name}`
      );

    case "Large":
      if (product.price_large === null) {
        throw new CheckoutError(
          `Ukuran Large tidak tersedia untuk ${product.name}.`
        );
      }

      return parsePrice(
        product.price_large,
        `Harga Large ${product.name}`
      );

    default:
      return parsePrice(
        product.price,
        `Harga Regular ${product.name}`
      );
  }
}

// =====================================
// HELPER: PERKALIAN HARGA
// =====================================

function safeMultiply(
  price: number,
  quantity: number
): number {
  const result = price * quantity;

  if (!Number.isSafeInteger(result)) {
    throw new CheckoutError(
      "Total harga melebihi batas yang didukung."
    );
  }

  return result;
}

// =====================================
// HELPER: PENJUMLAHAN HARGA
// =====================================

function safeAdd(
  first: number,
  second: number
): number {
  const result = first + second;

  if (!Number.isSafeInteger(result)) {
    throw new CheckoutError(
      "Total harga melebihi batas yang didukung."
    );
  }

  return result;
}

// =====================================
// CREATE MOBILE CHECKOUT
// =====================================

export async function createMobileCheckout(
  input: CheckoutInput
) {
  // =====================================
  // VALIDASI PELANGGAN
  // =====================================

  if (
    typeof input.customerName !== "string" ||
    !input.customerName.trim()
  ) {
    throw new CheckoutError(
      "Nama pelanggan wajib diisi."
    );
  }

  if (
    input.orderType !== "Dine-in" &&
    input.orderType !== "Takeaway"
  ) {
    throw new CheckoutError(
      "Jenis pesanan tidak valid."
    );
  }

  const tableNumber =
    input.orderType === "Dine-in"
      ? input.tableNumber?.trim() || null
      : null;

  if (
    input.orderType === "Dine-in" &&
    !tableNumber
  ) {
    throw new CheckoutError(
      "Nomor meja wajib diisi."
    );
  }

  if (
    !Array.isArray(input.items) ||
    input.items.length === 0
  ) {
    throw new CheckoutError(
      "Keranjang pesanan tidak boleh kosong."
    );
  }

  // =====================================
  // VALIDASI ITEM
  // =====================================

  const validatedItems: ValidatedItem[] = [];

  for (const item of input.items) {
    if (
      !item ||
      !Number.isSafeInteger(item.productId) ||
      item.productId <= 0 ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity <= 0
    ) {
      throw new CheckoutError(
        "ID produk atau jumlah pesanan tidak valid."
      );
    }

    const size = normalizeSize(item.size);

    if (
      item.addonIds !== undefined &&
      !Array.isArray(item.addonIds)
    ) {
      throw new CheckoutError(
        "Format daftar add-on tidak valid."
      );
    }

    const addonIds = item.addonIds ?? [];

    const uniqueAddonIds = new Set<number>();

    for (const addonId of addonIds) {
      if (
        !Number.isSafeInteger(addonId) ||
        addonId <= 0
      ) {
        throw new CheckoutError(
          "ID add-on tidak valid."
        );
      }

      if (uniqueAddonIds.has(addonId)) {
        throw new CheckoutError(
          "Add-on yang sama tidak boleh dipilih dua kali."
        );
      }

      uniqueAddonIds.add(addonId);
    }

    if (
      item.extraShot !== undefined &&
      typeof item.extraShot !== "boolean"
    ) {
      throw new CheckoutError(
        "Pilihan Extra Shot tidak valid."
      );
    }

    if (
      item.lessIce !== undefined &&
      typeof item.lessIce !== "boolean"
    ) {
      throw new CheckoutError(
        "Pilihan Less Ice tidak valid."
      );
    }

    if (
      item.lessSugar !== undefined &&
      typeof item.lessSugar !== "boolean"
    ) {
      throw new CheckoutError(
        "Pilihan Less Sugar tidak valid."
      );
    }

    if (
      item.note !== undefined &&
      typeof item.note !== "string"
    ) {
      throw new CheckoutError(
        "Catatan produk tidak valid."
      );
    }

    const note = item.note?.trim() || null;

    if (note && note.length > 1000) {
      throw new CheckoutError(
        "Catatan produk terlalu panjang."
      );
    }

    validatedItems.push({
      productId: item.productId,
      quantity: item.quantity,
      size,
      addonIds: [...uniqueAddonIds],
      extraShot: item.extraShot === true,
      lessIce: item.lessIce === true,
      lessSugar: item.lessSugar === true,
      note,
    });
  }

  // =====================================
  // MULAI TRANSAKSI
  // =====================================

  const connection = await pool.getConnection();

  let transactionStarted = false;

  try {
    await connection.beginTransaction();
    transactionStarted = true;

    // Maksimal 20 karakter sesuai orders.order_number.
    const orderNumber =
      `TJ${randomBytes(9)
        .toString("hex")
        .toUpperCase()}`;

    let total = 0;

    const orderItems: SavedOrderItem[] = [];

    // =====================================
    // GABUNGKAN KEBUTUHAN STOK
    // =====================================

    const quantitiesByProduct = new Map<
      number,
      number
    >();

    for (const item of validatedItems) {
      const previousQuantity =
        quantitiesByProduct.get(item.productId) ?? 0;

      const nextQuantity =
        previousQuantity + item.quantity;

      if (!Number.isSafeInteger(nextQuantity)) {
        throw new CheckoutError(
          "Jumlah pesanan terlalu besar."
        );
      }

      quantitiesByProduct.set(
        item.productId,
        nextQuantity
      );
    }

    const sortedProductIds = [
      ...quantitiesByProduct.keys(),
    ].sort((a, b) => a - b);

    // =====================================
    // AMBIL DAN KUNCI PRODUK
    // =====================================

    const productsById = new Map<
      number,
      ProductRow
    >();

    for (const productId of sortedProductIds) {
      const [rows] =
        await connection.query<ProductRow[]>(
          `SELECT
             id,
             name,
             price,
             price_medium,
             price_large,
             stock,
             image,
             is_active
           FROM products
           WHERE id = ?
           FOR UPDATE`,
          [productId]
        );

      if (rows.length === 0) {
        throw new CheckoutError(
          `Produk ID ${productId} tidak ditemukan.`,
          404
        );
      }

      const product = rows[0];

      if (!Number(product.is_active)) {
        throw new CheckoutError(
          `Produk ${product.name} tidak aktif.`
        );
      }

      const stock = Number(product.stock);

      if (
        !Number.isSafeInteger(stock) ||
        stock < 0
      ) {
        throw new CheckoutError(
          `Stok ${product.name} tidak valid.`,
          500
        );
      }

      const requiredQuantity =
        quantitiesByProduct.get(productId)!;

      if (stock < requiredQuantity) {
        throw new CheckoutError(
          `Stok ${product.name} tidak mencukupi.`
        );
      }

      productsById.set(productId, product);
    }

    // =====================================
    // AMBIL ADD-ON YANG DIIZINKAN
    // =====================================

    const addonsByProduct = new Map<
      number,
      Map<number, AddonRow>
    >();

    for (const productId of sortedProductIds) {
      const [addonRows] =
        await connection.query<AddonRow[]>(
          `SELECT
             a.id,
             a.name,
             a.price,
             a.is_active
           FROM product_addon_options AS pa
           INNER JOIN product_addons AS a
             ON a.id = pa.addon_id
           WHERE pa.product_id = ?
             AND a.is_active = 1
           ORDER BY a.id
           FOR UPDATE`,
          [productId]
        );

      const addonMap = new Map<
        number,
        AddonRow
      >();

      for (const addon of addonRows) {
        addonMap.set(
          Number(addon.id),
          addon
        );
      }

      addonsByProduct.set(
        productId,
        addonMap
      );
    }

    // =====================================
    // HITUNG HARGA SETIAP ITEM
    // =====================================

    for (const item of validatedItems) {
      const product = productsById.get(
        item.productId
      )!;

      const availableAddons =
        addonsByProduct.get(item.productId)!;

      const basePrice = getProductPrice(
        product,
        item.size
      );

      const selectedAddonIds = [
        ...item.addonIds,
      ];

      // =====================================
      // KOMPATIBILITAS EXTRA SHOT LAMA
      // =====================================

      // Jika Flutter mengirim extraShot=true,
      // cari Extra Shot Espresso yang tersedia
      // untuk produk ini.
      //
      // Jika ID-nya sudah ada di addonIds,
      // jangan tambahkan dua kali.

      if (item.extraShot) {
        const extraShotAddon = [
          ...availableAddons.values(),
        ].find(
          (addon) =>
            addon.name === "Extra Shot Espresso"
        );

        if (!extraShotAddon) {
          throw new CheckoutError(
            `Extra Shot Espresso tidak tersedia untuk ${product.name}.`
          );
        }

        if (
          !selectedAddonIds.includes(
            Number(extraShotAddon.id)
          )
        ) {
          selectedAddonIds.push(
            Number(extraShotAddon.id)
          );
        }
      }

      // =====================================
      // HITUNG ADD-ON
      // =====================================

      let addonTotal = 0;

      const savedAddons: SavedAddon[] = [];

      let hasExtraShot = false;

      for (const addonId of selectedAddonIds) {
        const addon = availableAddons.get(
          addonId
        );

        if (!addon) {
          throw new CheckoutError(
            `Add-on ID ${addonId} tidak tersedia untuk ${product.name}.`
          );
        }

        const addonPrice = parsePrice(
          addon.price,
          `Harga add-on ${addon.name}`
        );

        addonTotal = safeAdd(
          addonTotal,
          addonPrice
        );

        if (
          addon.name === "Extra Shot Espresso"
        ) {
          hasExtraShot = true;
        }

        savedAddons.push({
          addonId: Number(addon.id),
          name: addon.name,
          price: addonPrice,

          // Satu pilihan add-on per unit produk.
          quantity: 1,

          // Harga tambahan per unit produk.
          subtotal: addonPrice,
        });
      }

      // =====================================
      // HITUNG TOTAL ITEM
      // =====================================

      const unitPrice = safeAdd(
        basePrice,
        addonTotal
      );

      const subtotal = safeMultiply(
        unitPrice,
        item.quantity
      );

      total = safeAdd(
        total,
        subtotal
      );

      if (product.name.length > 150) {
        throw new CheckoutError(
          `Nama produk ${product.name} terlalu panjang.`
        );
      }

      orderItems.push({
        productId: Number(product.id),
        name: product.name,
        image: product.image,
        quantity: item.quantity,
        size: item.size,
        basePrice,
        addonTotal,
        price: unitPrice,
        subtotal,
        extraShot: hasExtraShot,
        lessIce: item.lessIce,
        lessSugar: item.lessSugar,
        note: item.note,
        addons: savedAddons,
      });
    }

    // =====================================
    // KURANGI STOK PRODUK
    // =====================================

    for (const productId of sortedProductIds) {
      const quantity =
        quantitiesByProduct.get(productId)!;

      const [updateResult] =
        await connection.execute<ResultSetHeader>(
          `UPDATE products
           SET stock = stock - ?
           WHERE id = ?
             AND stock >= ?`,
          [
            quantity,
            productId,
            quantity,
          ]
        );

      if (updateResult.affectedRows !== 1) {
        throw new CheckoutError(
          `Gagal memperbarui stok produk ID ${productId}.`
        );
      }
    }

    // =====================================
    // SIMPAN PESANAN UTAMA
    // =====================================

    const [orderResult] =
      await connection.execute<ResultSetHeader>(
        `INSERT INTO orders (
           order_number,
           ordered_at,
           customer_name,
           table_number,
           order_type,
           status,
           customer_note,
           total
         )
         VALUES (
           ?,
           NOW(),
           ?,
           ?,
           ?,
           'Menunggu',
           ?,
           ?
         )`,
        [
          orderNumber,
          input.customerName.trim(),
          tableNumber,
          input.orderType,
          input.customerNote?.trim() || null,
          total,
        ]
      );

    // =====================================
    // SIMPAN ITEM DAN ADD-ON
    // =====================================

    for (const item of orderItems) {
      const [itemResult] =
        await connection.execute<ResultSetHeader>(
          `INSERT INTO order_items (
             order_id,
             product_id,
             product_name,
             product_image,
             quantity,
             unit_price,
             subtotal,
             size,
             extra_shot,
             less_ice,
             less_sugar,
             item_note,
             addon_total
           )
           VALUES (
             ?, ?, ?, ?, ?, ?, ?,
             ?, ?, ?, ?, ?, ?
           )`,
          [
            orderResult.insertId,
            item.productId,
            item.name,
            item.image,
            item.quantity,
            item.price,
            item.subtotal,
            item.size,
            item.extraShot ? 1 : 0,
            item.lessIce ? 1 : 0,
            item.lessSugar ? 1 : 0,
            item.note,
            item.addonTotal,
          ]
        );

      // =====================================
      // SIMPAN RINCIAN ADD-ON
      // =====================================

      for (const addon of item.addons) {
        await connection.execute(
          `INSERT INTO order_item_addons (
             order_item_id,
             addon_id,
             addon_name,
             addon_price,
             quantity,
             subtotal
           )
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            itemResult.insertId,
            addon.addonId,
            addon.name,
            addon.price,
            addon.quantity,
            addon.subtotal,
          ]
        );
      }
    }

    // =====================================
    // COMMIT
    // =====================================

    await connection.commit();
    transactionStarted = false;

    // =====================================
    // RESPONSE UNTUK FLUTTER
    // =====================================

    return {
      orderId: orderResult.insertId,
      orderNumber,
      customerName: input.customerName.trim(),
      orderType: input.orderType,
      tableNumber,
      status: "Menunggu",
      total,
      items: orderItems,

      // Pembayaran QRIS masih simulasi.
      paymentStatus: "pending",
      qrUrl: "",
      expiresAt: null,
    };
  } catch (error) {
    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "Gagal melakukan rollback checkout:",
          rollbackError
        );
      }
    }

    throw error;
  } finally {
    connection.release();
  }
}