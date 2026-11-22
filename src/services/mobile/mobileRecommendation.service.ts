
import pool from "../../config/database";
import type { RowDataPacket } from "mysql2";

interface ProductRow extends RowDataPacket {
  id: number;
  name: string;
  category: string;
  description: string | null;
  price: number;
  image: string | null;
}

type RecommendationInput = {
  preferences: string[];
  budget?: number;
};

interface AiRecommendation {
  product_id: number;
  name: string;
  category: string;
  price: number;
  score: number;
  reason: string;
}

interface AiResponse {
  success: boolean;
  total: number;
  recommendations: AiRecommendation[];
}

const FOOD_KEYWORDS =
  /makanan|main course|chicken|ayam|nasi|pizza|burger|pasta|rice|strip|wings|mie|noodle/i;

const DRINK_KEYWORDS =
  /minuman|coffee|kopi|tea|teh|latte|espresso|milk|susu|chocolate|cokelat|signature|manual/i;

const SNACK_KEYWORDS =
  /snack|camilan|cemilan|gyoza|fries|kentang|finger food/i;

function matchesGroup(
  product: ProductRow,
  group: string
): boolean {
  const text =
    `${product.category} ${product.name}`.toLowerCase();

  switch (group.toLowerCase()) {
    case "makanan":
      return FOOD_KEYWORDS.test(text);

    case "minuman":
      return DRINK_KEYWORDS.test(text);

    case "snack":
      return SNACK_KEYWORDS.test(text);

    default:
      return true;
  }
}

export async function getMobileRecommendations(
  input: RecommendationInput
) {
  const aiUrl = process.env.AI_SERVICE_URL;

  if (!aiUrl) {
    throw new Error(
      "AI_SERVICE_URL belum dikonfigurasi."
    );
  }

  const [products] = await pool.execute<ProductRow[]>(
    `
    SELECT
      id,
      name,
      category,
      description,
      price,
      image
    FROM products
    WHERE is_active = 1
      AND stock > 0
    ORDER BY name ASC
    `
  );

  const group =
    input.preferences.find((item) =>
      ["semua", "minuman", "makanan", "snack"]
        .includes(item.toLowerCase())
    ) ?? "Semua";

  const taste =
    input.preferences.find((item) =>
      !["semua", "minuman", "makanan", "snack"]
        .includes(item.toLowerCase())
    ) ?? "";

  const candidates = products.filter(
    (product) =>
      matchesGroup(product, group) &&
      (
        input.budget === undefined ||
        Number(product.price) <= input.budget
      )
  );

  console.log(
    "[AI] Produk aktif:",
    products.length,
    "| Kandidat:",
    candidates.length,
    "| Grup:",
    group,
    "| Rasa:",
    taste,
    "| Budget:",
    input.budget
  );

  if (candidates.length === 0) {
    return {
      total: 0,
      recommendations: [],
    };
  }

  const response = await fetch(
    `${aiUrl.replace(/\/+$/, "")}/recommendations`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        products: candidates.map((product) => ({
          id: Number(product.id),
          name: product.name,
          category: product.category,
          description: product.description ?? "",
          taste: "",
          price: Number(product.price),
          available: true,
        })),
        preference: {
          category: null,
          taste: taste || null,
          min_price: null,
          max_price: input.budget ?? null,
        },
      }),
      signal: AbortSignal.timeout(15000),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Python AI gagal: HTTP ${response.status}`
    );
  }

  const result =
    (await response.json()) as AiResponse;

  if (!Array.isArray(result.recommendations)) {
    throw new Error(
      "Respons rekomendasi Python tidak valid."
    );
  }

  console.log(
    "[AI] Hasil Python:",
    result.recommendations.map(
      (item) => item.name
    )
  );

  return {
    total: result.recommendations.length,
    recommendations: result.recommendations,
  };
}
