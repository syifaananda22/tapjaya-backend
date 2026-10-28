import type { Request, Response } from "express";
import {
  getDashboardData,
  type DashboardPeriod,
} from "../models/dashboard.model";

const validPeriods: DashboardPeriod[] = [
  "7hari",
  "1bulan",
  "6bulan",
  "1tahun",
];

function isValidDate(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export async function getDashboardSummary(
  req: Request,
  res: Response
) {
  try {
    const requestedPeriod = req.query.period;
    const requestedStartDate = req.query.startDate;
    const requestedEndDate = req.query.endDate;

    if (
      requestedPeriod !== undefined &&
      (
        typeof requestedPeriod !== "string" ||
        !validPeriods.includes(
          requestedPeriod as DashboardPeriod
        )
      )
    ) {
      res.status(400).json({
        message: "Periode dashboard tidak valid.",
      });
      return;
    }

    const hasStartDate = requestedStartDate !== undefined;
    const hasEndDate = requestedEndDate !== undefined;

    if (hasStartDate !== hasEndDate) {
      res.status(400).json({
        message:
          "Tanggal mulai dan tanggal akhir harus diisi bersamaan.",
      });
      return;
    }

    let dateRange:
      | { startDate: string; endDate: string }
      | undefined;

    if (hasStartDate && hasEndDate) {
      if (
        !isValidDate(requestedStartDate) ||
        !isValidDate(requestedEndDate)
      ) {
        res.status(400).json({
          message:
            "Format tanggal tidak valid. Gunakan YYYY-MM-DD.",
        });
        return;
      }

      if (requestedStartDate > requestedEndDate) {
        res.status(400).json({
          message:
            "Tanggal mulai tidak boleh melebihi tanggal akhir.",
        });
        return;
      }

      dateRange = {
        startDate: requestedStartDate,
        endDate: requestedEndDate,
      };
    }

    const period: DashboardPeriod =
      typeof requestedPeriod === "string"
        ? (requestedPeriod as DashboardPeriod)
        : "1bulan";

    const data = await getDashboardData(period, dateRange);

    res.status(200).json({
      message: "Data dashboard berhasil diambil.",
      data,
    });
  } catch (error) {
    console.error(
      "Gagal mengambil data dashboard:",
      error
    );

    res.status(500).json({
      message: "Gagal mengambil data dashboard.",
    });
  }
}