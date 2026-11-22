
import type { Request, Response } from "express";

import {
  getMobileOrderByNumber,
} from "../../services/mobile/mobileOrder.service";

// =====================================
// GET MOBILE ORDER DETAIL
// =====================================

export async function getMobileOrderDetail(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // =====================================
    // VALIDASI NOMOR PESANAN
    // =====================================

    const value = req.params.orderNumber;

    const orderNumber = Array.isArray(value)
      ? value[0]
      : value;

    if (
      typeof orderNumber !== "string" ||
      !orderNumber.trim()
    ) {
      res.status(400).json({
        success: false,
        message: "Nomor pesanan wajib diisi.",
      });
      return;
    }

    const normalizedOrderNumber =
      orderNumber.trim().replace(/^#/, "");

    // =====================================
    // AMBIL DATA PESANAN DARI SERVICE
    // =====================================

    const data = await getMobileOrderByNumber(
      normalizedOrderNumber
    );

    // =====================================
    // PESANAN TIDAK DITEMUKAN
    // =====================================

    if (!data) {
      res.status(404).json({
        success: false,
        message: "Pesanan tidak ditemukan.",
      });
      return;
    }

    // =====================================
    // RESPONSE BERHASIL
    // =====================================

    res.status(200).json({
      success: true,
      message: "Detail pesanan berhasil diambil.",
      data,
    });
  } catch (error) {
    console.error(
      "Mobile order error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Gagal mengambil detail pesanan.",
    });
  }
}