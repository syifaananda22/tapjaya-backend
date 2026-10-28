
import type { Request, Response } from "express";
import {
  getOrders,
  getOrderByIdentifier,
  updateOrderStatus,
  type OrderStatus,
} from "../models/order.model";

const validStatuses: OrderStatus[] = [
  "Menunggu",
  "Diproses",
  "Siap",
  "Selesai",
];

// Memastikan identifier selalu berupa string.
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
      message: "Nomor pesanan tidak valid.",
    });
    return null;
  }

  return identifier.trim();
}

// GET /api/orders
// Mengambil daftar pesanan beserta filter.
export async function listOrders(
  req: Request,
  res: Response
) {
  try {
    const { search, status, startDate, endDate } =
      req.query;

    if (
      typeof status === "string" &&
      !validStatuses.includes(status as OrderStatus)
    ) {
      res.status(400).json({
        message: "Filter status tidak valid.",
      });
      return;
    }

    const data = await getOrders({
      search:
        typeof search === "string" ? search : undefined,

      status:
        typeof status === "string"
          ? (status as OrderStatus)
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

    res.status(200).json({ data });
  } catch (error) {
    console.error("Gagal mengambil pesanan:", error);

    res.status(500).json({
      message: "Gagal mengambil data pesanan.",
    });
  }
}

// GET /api/orders/:identifier
// Mengambil detail pesanan beserta item menunya.
export async function getOrderDetail(
  req: Request,
  res: Response
) {
  const identifier = getOrderIdentifier(req, res);

  if (!identifier) return;

  try {
    const data = await getOrderByIdentifier(identifier);

    if (!data) {
      res.status(404).json({
        message: "Pesanan tidak ditemukan.",
      });
      return;
    }

    res.status(200).json({ data });
  } catch (error) {
    console.error(
      "Gagal mengambil detail pesanan:",
      error
    );

    res.status(500).json({
      message: "Gagal mengambil detail pesanan.",
    });
  }
}

// PATCH /api/orders/:identifier/status
// Memperbarui status dan catatan admin.
export async function changeOrderStatus(
  req: Request,
  res: Response
) {
  const identifier = getOrderIdentifier(req, res);

  if (!identifier) return;

  try {
    const { status, adminNote } = req.body ?? {};

    if (
      typeof status !== "string" ||
      !validStatuses.includes(status as OrderStatus)
    ) {
      res.status(400).json({
        message: "Status pesanan tidak valid.",
      });
      return;
    }

    if (
      adminNote !== undefined &&
      typeof adminNote !== "string"
    ) {
      res.status(400).json({
        message: "Catatan admin harus berupa teks.",
      });
      return;
    }

    const existing =
      await getOrderByIdentifier(identifier);

    if (!existing) {
      res.status(404).json({
        message: "Pesanan tidak ditemukan.",
      });
      return;
    }

    const updated = await updateOrderStatus(
      identifier,
      status as OrderStatus,
      adminNote
    );

    if (!updated) {
      res.status(500).json({
        message: "Status pesanan gagal diperbarui.",
      });
      return;
    }

    const data =
      await getOrderByIdentifier(identifier);

    res.status(200).json({
      message: "Status pesanan berhasil diperbarui.",
      data,
    });
  } catch (error) {
    console.error(
      "Gagal memperbarui status pesanan:",
      error
    );

    res.status(500).json({
      message: "Gagal memperbarui status pesanan.",
    });
  }
}
