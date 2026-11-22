
import type { Request, Response } from "express";

import {
  completeSimulatedPayment,
} from "../../services/mobile/mobilePayment.service";

export async function simulatePaymentSuccess(
  req: Request,
  res: Response
): Promise<void> {
  try {
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

    const result = await completeSimulatedPayment(
      orderNumber
    );

    if (!result.found) {
      res.status(404).json({
        success: false,
        message: "Pesanan tidak ditemukan.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Pembayaran simulasi berhasil.",
      data: result.data,
    });
  } catch (error) {
    console.error(
      "Simulated payment error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Gagal menyelesaikan pembayaran simulasi.",
    });
  }
}
