
import pool from "../config/database";
import type { RowDataPacket } from "mysql2";

export type Period =
  | "today"
  | "week"
  | "month"
  | "sixMonths"
  | "year";

type Range = {
  start: string;
  end: string;
};

function dayString(date: Date) {
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function shift(
  date: Date,
  unit: "day" | "month",
  offset: number
) {
  const d = new Date(date);

  if (unit === "day") {
    d.setDate(d.getDate() + offset);
  } else {
    d.setMonth(d.getMonth() + offset);
  }

  return d;
}

function periods(
  period: Period
): {
  current: Range;
  previous: Range;
  comparison: string;
  dates: Date[];
} {
  const parts = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }
  ).formatToParts(new Date());

  const n = (key: string) =>
    Number(
      parts.find(
        (x) => x.type === key
      )?.value
    );

  const today = new Date(
    n("year"),
    n("month") - 1,
    n("day"),
    12
  );

  let begin = new Date(today);
  let end = shift(today, "day", 1);

  let previousBegin: Date;
  let previousEnd: Date;

  let comparison =
    "dari periode sebelumnya";

  let dates: Date[] = [];

  if (period === "today") {
    previousBegin = shift(
      begin,
      "day",
      -1
    );

    previousEnd = begin;
    comparison = "dari kemarin";
    dates = [begin];
  } else if (period === "week") {
    begin = shift(
      today,
      "day",
      -((today.getDay() + 6) % 7)
    );

    end = shift(begin, "day", 7);

    previousBegin = shift(
      begin,
      "day",
      -7
    );

    previousEnd = begin;

    comparison = "dari minggu lalu";

    dates = Array.from(
      { length: 7 },
      (_, i) => shift(begin, "day", i)
    );
  } else if (period === "month") {
    begin = new Date(
      today.getFullYear(),
      today.getMonth(),
      1,
      12
    );

    end = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      1,
      12
    );

    previousBegin = new Date(
      today.getFullYear(),
      today.getMonth() - 1,
      1,
      12
    );

    previousEnd = begin;

    comparison = "dari bulan lalu";

    dates = Array.from(
      {
        length: Math.round(
          (end.getTime() - begin.getTime()) /
            86400000
        ),
      },
      (_, i) => shift(begin, "day", i)
    );
  } else if (period === "sixMonths") {
    begin = new Date(
      today.getFullYear(),
      today.getMonth() - 5,
      1,
      12
    );

    end = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      1,
      12
    );

    previousBegin = new Date(
      today.getFullYear(),
      today.getMonth() - 11,
      1,
      12
    );

    previousEnd = begin;

    comparison =
      "dari 6 bulan sebelumnya";

    dates = Array.from(
      { length: 6 },
      (_, i) =>
        new Date(
          begin.getFullYear(),
          begin.getMonth() + i,
          1,
          12
        )
    );
  } else {
    begin = new Date(
      today.getFullYear(),
      0,
      1,
      12
    );

    end = new Date(
      today.getFullYear() + 1,
      0,
      1,
      12
    );

    previousBegin = new Date(
      today.getFullYear() - 1,
      0,
      1,
      12
    );

    previousEnd = begin;

    comparison = "dari tahun lalu";

    dates = Array.from(
      { length: 12 },
      (_, i) =>
        new Date(
          begin.getFullYear(),
          i,
          1,
          12
        )
    );
  }

  return {
    current: {
      start: dayString(begin),
      end: dayString(end),
    },
    previous: {
      start: dayString(previousBegin),
      end: dayString(previousEnd),
    },
    comparison,
    dates,
  };
}

async function summary(range: Range) {
  const [rows] =
    await pool.execute<RowDataPacket[]>(
      `SELECT
         COUNT(*) AS totalOrders,
         COALESCE(SUM(total), 0) AS totalRevenue
       FROM orders
       WHERE status = 'Selesai'
         AND ordered_at >= ?
         AND ordered_at < ?`,
      [range.start, range.end]
    );

  const totalOrders = Number(
    rows[0].totalOrders
  );

  const totalRevenue = Number(
    rows[0].totalRevenue
  );

  return {
    totalOrders,
    totalRevenue,
    averageOrder: totalOrders
      ? totalRevenue / totalOrders
      : 0,
  };
}

function change(
  current: number,
  previous: number
): number | null {
  if (!previous) {
    return current === 0 ? 0 : null;
  }

  return (
    ((current - previous) / previous) * 100
  );
}

export async function getOverview(
  period: Period
) {
  const p = periods(period);

  const [current, previous] =
    await Promise.all([
      summary(p.current),
      summary(p.previous),
    ]);

  const group =
    period === "today"
      ? "DATE_FORMAT(o.ordered_at, '%H')"
      : period === "sixMonths" ||
          period === "year"
        ? "DATE_FORMAT(o.ordered_at, '%Y-%m')"
        : "DATE_FORMAT(o.ordered_at, '%Y-%m-%d')";

  // Grafik pendapatan dan jumlah pesanan
  const [chartRows] =
    await pool.execute<RowDataPacket[]>(
      `SELECT
         ${group} AS bucket,
         COUNT(*) AS orders,
         COALESCE(SUM(o.total), 0) AS revenue
       FROM orders o
       WHERE o.status = 'Selesai'
         AND o.ordered_at >= ?
         AND o.ordered_at < ?
       GROUP BY bucket
       ORDER BY bucket`,
      [
        p.current.start,
        p.current.end,
      ]
    );

  const mapped = new Map(
    chartRows.map((r) => [
      String(r.bucket),
      {
        revenue: Number(r.revenue),
        orders: Number(r.orders),
      },
    ])
  );

  const chart =
    period === "today"
      ? Array.from(
          { length: 24 },
          (_, i) => {
            const key = String(i).padStart(
              2,
              "0"
            );

            return {
              label: `${key}:00`,
              ...(mapped.get(key) ?? {
                revenue: 0,
                orders: 0,
              }),
            };
          }
        )
      : p.dates.map((date) => {
          const key =
            period === "sixMonths" ||
            period === "year"
              ? dayString(date).slice(0, 7)
              : dayString(date);

          const label =
            period === "sixMonths" ||
            period === "year"
              ? date.toLocaleDateString(
                  "id-ID",
                  { month: "short" }
                )
              : period === "week"
                ? date.toLocaleDateString(
                    "id-ID",
                    { weekday: "short" }
                  )
                : date.toLocaleDateString(
                    "id-ID",
                    {
                      day: "numeric",
                      month: "short",
                    }
                  );

          return {
            label,
            ...(mapped.get(key) ?? {
              revenue: 0,
              orders: 0,
            }),
          };
        });

  // Menu terlaris dari transaksi selesai
  const [topRows] =
    await pool.execute<RowDataPacket[]>(
      `SELECT
         oi.product_name AS name,
         SUM(oi.quantity) AS sold,
         COALESCE(SUM(oi.subtotal), 0) AS revenue,
         MAX(p.id) AS id,
         MAX(p.image) AS image
       FROM order_items oi
       JOIN orders o
         ON o.id = oi.order_id
       LEFT JOIN products p
         ON p.id = oi.product_id
       WHERE o.status = 'Selesai'
         AND o.ordered_at >= ?
         AND o.ordered_at < ?
       GROUP BY oi.product_name
       ORDER BY sold DESC, revenue DESC
       LIMIT 5`,
      [
        p.current.start,
        p.current.end,
      ]
    );

  const bestMenus = topRows.map(
    (r, i) => ({
      id: Number(r.id ?? i + 1),
      name: String(r.name),
      sold: Number(r.sold),
      revenue: Number(r.revenue),
      image: r.image
        ? String(r.image)
        : null,
    })
  );

  // Pendapatan per kategori
  const [categoryRows] =
    await pool.execute<RowDataPacket[]>(
      `SELECT
         COALESCE(p.category, 'Lainnya') AS name,
         COALESCE(SUM(oi.subtotal), 0) AS revenue
       FROM order_items oi
       JOIN orders o
         ON o.id = oi.order_id
       LEFT JOIN products p
         ON p.id = oi.product_id
       WHERE o.status = 'Selesai'
         AND o.ordered_at >= ?
         AND o.ordered_at < ?
       GROUP BY COALESCE(p.category, 'Lainnya')`,
      [
        p.current.start,
        p.current.end,
      ]
    );

  const revenueMap = new Map(
    categoryRows.map((r) => [
      String(r.name),
      Number(r.revenue),
    ])
  );

  const categoryTotal = Array.from(
    revenueMap.values()
  ).reduce((a, b) => a + b, 0);

  const mainCategories = [
    "Makanan",
    "Minuman",
    "Kopi",
    "Snack",
  ];

  const names = [
    ...mainCategories,
    ...Array.from(
      revenueMap.keys()
    ).filter(
      (name) =>
        !mainCategories.includes(name)
    ),
  ];

  const categories = names.map(
    (name) => ({
      name,
      value: categoryTotal
        ? (
            (revenueMap.get(name) ?? 0) /
            categoryTotal
          ) * 100
        : 0,
    })
  );

  return {
    ...current,
    comparison: p.comparison,

    revenueChange: change(
      current.totalRevenue,
      previous.totalRevenue
    ),

    orderChange: change(
      current.totalOrders,
      previous.totalOrders
    ),

    averageChange: change(
      current.averageOrder,
      previous.averageOrder
    ),

    chart,
    bestMenus,
    categories,
  };
}
