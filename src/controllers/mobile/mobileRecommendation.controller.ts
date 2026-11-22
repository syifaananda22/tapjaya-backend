
import type {
  Request,
  Response,
} from "express";

import {
  getMobileRecommendations,
} from "../../services/mobile/mobileRecommendation.service";

export async function getRecommendations(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { preferences, budget } =
      req.body ?? {};

    if (
      !Array.isArray(preferences) ||
      preferences.length === 0 ||
      !preferences.every(
        (item: unknown) =>
          typeof item === "string" &&
          item.trim().length > 0
      )
    ) {
      res.status(400).json({
        success: false,
        message:
          "Pilih minimal satu preferensi menu.",
      });
      return;
    }

    if (
      budget !== undefined &&
      (
        typeof budget !== "number" ||
        !Number.isFinite(budget) ||
        budget <= 0
      )
    ) {
      res.status(400).json({
        success: false,
        message:
          "Budget harus berupa angka positif.",
      });
      return;
    }

    const result =
      await getMobileRecommendations({
        preferences: preferences.map(
          (item: string) => item.trim()
        ),
        budget,
      });

    res.status(200).json({
      success: true,
      message:
        result.total > 0
          ? "Rekomendasi menu berhasil diperoleh."
          : "Tidak ditemukan menu yang sesuai.",
      data: result,
    });
  } catch (error) {
    console.error(
      "Mobile recommendation error:",
      error
    );

    res.status(502).json({
      success: false,
      message:
        "Layanan rekomendasi AI tidak tersedia.",
    });
  }
}
