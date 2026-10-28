import pool from "../config/database";
import type { RowDataPacket } from "mysql2";

export type DashboardPeriod =
    | "7hari"
    | "1bulan"
    | "6bulan"
    | "1tahun";

export type DashboardDateRange = {
    startDate: string;
    endDate: string;
};

type StatsRow = RowDataPacket & {
    totalOrders: number | string;
    totalRevenue: number | string;
    completedOrders: number | string;
};

type CountRow = RowDataPacket & {
    lowStockProducts: number | string;
};

type RevenueRow = RowDataPacket & {
    label: string;
    income: number | string;
};

type CategoryRow = RowDataPacket & {
    name: string;
    revenue: number | string;
};

type BestMenuRow = RowDataPacket & {
    id: number | string;
    name: string;
    image: string | null;
    sold: number | string;
    revenue: number | string;
};

type LatestOrderRow = RowDataPacket & {
    id: string;
    time: string;
    menu: string | null;
    image: string | null;
    total: number | string;
    status: string;
};

type RevenueGrouping = {
    label: string;
    group: string;
    order: string;
};

function getPeriodCondition(period: DashboardPeriod): string {
    switch (period) {
        case "7hari":
            return `
        o.ordered_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
      `;

        case "1bulan":
            return `
        o.ordered_at >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)
      `;

        case "6bulan":
            return `
        o.ordered_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      `;

        case "1tahun":
            return `
        o.ordered_at >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)
      `;
    }
}

function getRevenueGrouping(
    period: DashboardPeriod,
    dateRange?: DashboardDateRange
): RevenueGrouping {
    // Jika admin memilih tanggal sendiri,
    // otomatis sesuaikan pengelompokan grafik.
    if (dateRange) {
        const start = Date.parse(
            `${dateRange.startDate}T00:00:00Z`
        );

        const end = Date.parse(
            `${dateRange.endDate}T00:00:00Z`
        );

        const totalDays =
            Math.round((end - start) / 86_400_000) + 1;

        if (totalDays <= 31) {
            return {
                label: "DATE_FORMAT(MIN(o.ordered_at), '%e %b')",
                group: "DATE(o.ordered_at)",
                order: "DATE(o.ordered_at)",
            };
        }

        if (totalDays <= 183) {
            return {
                label: `
          CONCAT(
            'Minggu mulai ',
            DATE_FORMAT(MIN(o.ordered_at), '%e %b')
          )
        `,
                group: "YEARWEEK(o.ordered_at, 1)",
                order: "YEARWEEK(o.ordered_at, 1)",
            };
        }

        return {
            label: "DATE_FORMAT(MIN(o.ordered_at), '%b %Y')",
            group: "YEAR(o.ordered_at), MONTH(o.ordered_at)",
            order: "YEAR(o.ordered_at), MONTH(o.ordered_at)",
        };
    }

    // Periode cepat yang sudah ada.
    switch (period) {
        case "7hari":
            return {
                label: "DATE_FORMAT(MIN(o.ordered_at), '%e %b')",
                group: "DATE(o.ordered_at)",
                order: "DATE(o.ordered_at)",
            };

        case "1bulan":
            return {
                label: `
          CONCAT(
            'Minggu ',
            FLOOR(
              DATEDIFF(
                DATE(MIN(o.ordered_at)),
                DATE_SUB(CURDATE(), INTERVAL 1 MONTH)
              ) / 7
            ) + 1
          )
        `,
                group: `
          FLOOR(
            DATEDIFF(
              DATE(o.ordered_at),
              DATE_SUB(CURDATE(), INTERVAL 1 MONTH)
            ) / 7
          )
        `,
                order: `
          FLOOR(
            DATEDIFF(
              DATE(o.ordered_at),
              DATE_SUB(CURDATE(), INTERVAL 1 MONTH)
            ) / 7
          )
        `,
            };

        case "6bulan":
        case "1tahun":
            return {
                label: "DATE_FORMAT(MIN(o.ordered_at), '%b %Y')",
                group: "YEAR(o.ordered_at), MONTH(o.ordered_at)",
                order: "YEAR(o.ordered_at), MONTH(o.ordered_at)",
            };
    }
}

export async function getDashboardData(
    period: DashboardPeriod = "1bulan",
    dateRange?: DashboardDateRange
) {
    // Semua query penjualan menggunakan filter yang sama.
    const dateCondition = dateRange
        ? `
        o.ordered_at >= ?
        AND o.ordered_at < DATE_ADD(?, INTERVAL 1 DAY)
      `
        : getPeriodCondition(period);

    const dateParams: string[] = dateRange
        ? [dateRange.startDate, dateRange.endDate]
        : [];

    // 1. Statistik utama.
    const [statsRows] = await pool.execute<StatsRow[]>(
        `
      SELECT
        COUNT(*) AS totalOrders,
        COALESCE(
          SUM(
            CASE
              WHEN o.status = 'Selesai' THEN o.total
              ELSE 0
            END
          ),
          0
        ) AS totalRevenue,
        COALESCE(
          SUM(o.status = 'Selesai'),
          0
        ) AS completedOrders
      FROM orders o
      WHERE ${dateCondition}
        AND o.ordered_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
    `,
        dateParams
    );

    // 2. Stok menipis: kondisi stok saat ini.
    const [stockRows] = await pool.execute<CountRow[]>(
        `
      SELECT COUNT(*) AS lowStockProducts
      FROM products
      WHERE is_active = 1
        AND stock <= 5
    `
    );

    // 3. Grafik pendapatan dari pesanan selesai.
    const grouping = getRevenueGrouping(period, dateRange);

    const [revenueRows] = await pool.execute<RevenueRow[]>(
        `
      SELECT
        ${grouping.label} AS label,
        COALESCE(SUM(o.total), 0) AS income
      FROM orders o
      WHERE ${dateCondition}
        AND o.ordered_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
        AND o.status = 'Selesai'
      GROUP BY ${grouping.group}
      ORDER BY ${grouping.order}
    `,
        dateParams
    );

    // 4. Distribusi kategori menu berdasarkan pendapatan.
    const [categoryRows] = await pool.execute<CategoryRow[]>(
        `
      SELECT
        COALESCE(p.category, 'Lainnya') AS name,
        COALESCE(SUM(oi.subtotal), 0) AS revenue
      FROM order_items oi
      INNER JOIN orders o
        ON o.id = oi.order_id
      LEFT JOIN products p
        ON p.id = oi.product_id
      WHERE ${dateCondition}
        AND o.ordered_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
        AND o.status = 'Selesai'
      GROUP BY COALESCE(p.category, 'Lainnya')
      ORDER BY revenue DESC
    `,
        dateParams
    );

    const totalCategoryRevenue = categoryRows.reduce(
        (sum, row) => sum + Number(row.revenue),
        0
    );

    const categoryData = categoryRows.map((row) => ({
        name: row.name,
        value:
            totalCategoryRevenue > 0
                ? Number(
                    (
                        (Number(row.revenue) /
                            totalCategoryRevenue) *
                        100
                    ).toFixed(1)
                )
                : 0,
    }));

    // 5. Menu terlaris.
    const [bestMenuRows] = await pool.execute<BestMenuRow[]>(
        `
      SELECT
        COALESCE(p.id, 0) AS id,
        oi.product_name AS name,
        COALESCE(oi.product_image, p.image) AS image,
        SUM(oi.quantity) AS sold,
        SUM(oi.subtotal) AS revenue
      FROM order_items oi
      INNER JOIN orders o
        ON o.id = oi.order_id
      LEFT JOIN products p
        ON p.id = oi.product_id
      WHERE ${dateCondition}
        AND o.ordered_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
        AND o.status = 'Selesai'
      GROUP BY
        COALESCE(p.id, 0),
        oi.product_name,
        COALESCE(oi.product_image, p.image)
      ORDER BY sold DESC, revenue DESC
      LIMIT 5
    `,
        dateParams
    );

    // 6. Pesanan terbaru, termasuk yang belum selesai.
    const [latestOrderRows] =
        await pool.execute<LatestOrderRow[]>(
            `
        SELECT
          o.order_number AS id,
          DATE_FORMAT(o.ordered_at, '%H:%i') AS time,

          (
            SELECT oi.product_name
            FROM order_items oi
            WHERE oi.order_id = o.id
            ORDER BY oi.id ASC
            LIMIT 1
          ) AS menu,

          (
            SELECT COALESCE(oi.product_image, p.image)
            FROM order_items oi
            LEFT JOIN products p
              ON p.id = oi.product_id
            WHERE oi.order_id = o.id
            ORDER BY oi.id ASC
            LIMIT 1
          ) AS image,

          o.total,
          o.status
        FROM orders o
        WHERE ${dateCondition}
          AND o.ordered_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
        ORDER BY o.ordered_at DESC, o.id DESC
        LIMIT 5
      `,
            dateParams
        );

    const stats = statsRows[0];
    const stock = stockRows[0];

    return {
        period,
        dateRange: dateRange ?? null,

        stats: {
            totalOrders: Number(stats.totalOrders),
            totalRevenue: Number(stats.totalRevenue),
            completedOrders: Number(stats.completedOrders),
            lowStockProducts: Number(stock.lowStockProducts),
        },

        revenueData: revenueRows.map((row) => ({
            label: row.label,
            income: Number(row.income),
        })),

        categoryData,

        bestMenus: bestMenuRows.map((row) => ({
            id: Number(row.id),
            name: row.name,
            image: row.image ?? "",
            sold: Number(row.sold),
            revenue: Number(row.revenue),
        })),

        latestOrders: latestOrderRows.map((row) => ({
            id: row.id.startsWith("#")
                ? row.id
                : `#${row.id}`,
            time: row.time,
            menu: row.menu ?? "Tidak ada menu",
            image: row.image ?? "",
            total: Number(row.total),
            status: row.status,
        })),
    };
}