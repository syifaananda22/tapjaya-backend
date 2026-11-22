
import type { Request, Response } from "express";

import {
  getOrders,
  getOrderByIdentifier,
  updateOrderStatus,
  type OrderStatus,
} from "../models/order.model";

// =====================================
// VALID ORDER STATUSES
// =====================================

const validStatuses: OrderStatus[] = [
  "Menunggu",
  "Diproses",
  "Siap",
  "Selesai",
];

// =====================================
// HELPER: ORDER IDENTIFIER
// =====================================

function getOrderIdentifier(
  req: Request,
  res: Response
): string | null {
  const value = req.params.identifier;

  const identifier = Array.isArray(value)
    ? value[0]
    : value;

  if (
    typeof identifier !== "string" ||
    !identifier.trim()
  ) {
    res.status(400).json({
      success: false,
      message: "Nomor pesanan tidak valid.",
    });

    return null;
  }

  return identifier.trim();
}

// =====================================
// HELPER: DATE VALIDATION
// =====================================

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

// =====================================
// GET ALL ORDERS
// GET /api/orders
// =====================================

export async function listOrders(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const {
      search,
      status,
      startDate,
      endDate,
    } = req.query;

    // Validasi filter status.
    if (
      status !== undefined &&
      (
        typeof status !== "string" ||
        (
          status !== "" &&
          !validStatuses.includes(
            status as OrderStatus
          )
        )
      )
    ) {
      res.status(400).json({
        success: false,
        message: "Filter status tidak valid.",
      });
      return;
    }

    // Validasi tanggal mulai.
    if (
      startDate !== undefined &&
      (
        typeof startDate !== "string" ||
        !isValidDate(startDate)
      )
    ) {
      res.status(400).json({
        success: false,
        message: "Tanggal mulai tidak valid.",
      });
      return;
    }

    // Validasi tanggal akhir.
    if (
      endDate !== undefined &&
      (
        typeof endDate !== "string" ||
        !isValidDate(endDate)
      )
    ) {
      res.status(400).json({
        success: false,
        message: "Tanggal akhir tidak valid.",
      });
      return;
    }

    if (
      typeof startDate === "string" &&
      typeof endDate === "string" &&
      startDate > endDate
    ) {
      res.status(400).json({
        success: false,
        message:
          "Tanggal mulai tidak boleh melebihi tanggal akhir.",
      });
      return;
    }

    const data = await getOrders({
      search:
        typeof search === "string"
          ? search.trim()
          : undefined,

      status:
        typeof status === "string"
          ? status as OrderStatus | ""
          : "",

      startDate:
        typeof startDate === "string"
          ? startDate
          : undefined,

      endDate:
        typeof endDate === "string"
          ? endDate
          : undefined,
    });

    res.status(200).json({
      data,
    });
  } catch (error) {
    console.error(
      "Gagal mengambil pesanan:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Gagal mengambil data pesanan.",
    });
  }
}

// =====================================
// GET ORDER DETAIL
// GET /api/orders/:identifier
// =====================================

export async function getOrderDetail(
  req: Request,
  res: Response
): Promise<void> {
  const identifier =
    getOrderIdentifier(req, res);

  if (!identifier) {
    return;
  }

  try {
    const data =
      await getOrderByIdentifier(identifier);

    if (!data) {
      res.status(404).json({
        success: false,
        message: "Pesanan tidak ditemukan.",
      });
      return;
    }

    res.status(200).json({
      data,
    });
  } catch (error) {
    console.error(
      "Gagal mengambil detail pesanan:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Gagal mengambil detail pesanan.",
    });
  }
}

// =====================================
// UPDATE ORDER STATUS
// PATCH /api/orders/:identifier/status
// =====================================

export async function changeOrderStatus(
  req: Request,
  res: Response
): Promise<void> {
  const identifier =
    getOrderIdentifier(req, res);

  if (!identifier) {
    return;
  }

  try {
    const {
      status,
      adminNote,
    } = req.body ?? {};

    // Validasi status pesanan.
    if (
      typeof status !== "string" ||
      !validStatuses.includes(
        status as OrderStatus
      )
    ) {
      res.status(400).json({
        success: false,
        message: "Status pesanan tidak valid.",
      });
      return;
    }

    // Validasi catatan admin.
    if (
      adminNote !== undefined &&
      (
        typeof adminNote !== "string"
      )
    ) {
      res.status(400).json({
        success: false,
        message:
          "Catatan admin harus berupa teks.",
      });
      return;
    }

    // Pastikan pesanan tersedia.
    const existing =
      await getOrderByIdentifier(identifier);

    if (!existing) {
      res.status(404).json({
        success: false,
        message: "Pesanan tidak ditemukan.",
      });
      return;
    }

    // Perbarui status pada database.
    const updated =
      await updateOrderStatus(
        identifier,
        status as OrderStatus,
        adminNote
      );

    if (!updated) {
      res.status(500).json({
        success: false,
        message:
          "Status pesanan gagal diperbarui.",
      });
      return;
    }

    // Ambil kembali data terbaru.
    const data =
      await getOrderByIdentifier(identifier);

    res.status(200).json({
      message:
        "Status pesanan berhasil diperbarui.",
      data,
    });
  } catch (error) {
    console.error(
      "Gagal memperbarui status pesanan:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Gagal memperbarui status pesanan.",
    });
  }
}