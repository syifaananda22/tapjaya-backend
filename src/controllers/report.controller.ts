
import type {
  Request,
  Response,
} from "express";

import {
  getOverview,
  type Period,
} from "../models/report.model";

const validPeriods: Period[] = [
  "today",
  "week",
  "month",
  "sixMonths",
  "year",
];

export async function overview(
  req: Request,
  res: Response
) {
  const period = req.query.period;

  if (
    typeof period !== "string" ||
    !validPeriods.includes(
      period as Period
    )
  ) {
    res.status(400).json({
      message: "Periode laporan tidak valid.",
    });
    return;
  }

  try {
    const data = await getOverview(
      period as Period
    );

    res.json({ data });
  } catch (err) {
    console.error(
      "Gagal mengambil laporan:",
      err
    );

    res.status(500).json({
      message:
        "Gagal mengambil data laporan.",
    });
  }
}
