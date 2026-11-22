
import "dotenv/config";

import express from "express";
import cors from "cors";
import path from "path";

// =====================================
// WEB ADMIN ROUTES
// =====================================

import authRoutes from "./routes/auth.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import orderRoutes from "./routes/order.routes";
import productRoutes from "./routes/product.routes";
import uploadRoutes from "./routes/upload.routes";
import reportRoutes from "./routes/report.routes";
import settingsRoutes from "./routes/settings.routes";

// =====================================
// MOBILE ROUTES
// =====================================

import mobileProductRoutes from "./routes/mobile/mobileProduct.routes";
import mobileCheckoutRoutes from "./routes/mobile/mobileCheckout.routes";
import mobileOrderRoutes from "./routes/mobile/mobileOrder.routes";
import mobileRecommendationRoutes from "./routes/mobile/mobileRecommendation.routes";

// =====================================
// MIDDLEWARE
// =====================================

import { verifyToken } from "./middleware/verifyToken";

// =====================================
// INITIALIZATION
// =====================================

const app = express();
const PORT = Number(process.env.PORT || 5000);

// =====================================
// CORS CONFIGURATION
// =====================================

// Mengizinkan frontend lokal di localhost/127.0.0.1
// dengan port apa pun, termasuk Flutter Web.

app.use(
  cors({
    origin: (origin, callback) => {
      // Request tanpa origin, misalnya Flutter native.
      if (!origin) {
        return callback(null, true);
      }

      const isLocalOrigin =
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

      if (isLocalOrigin) {
        return callback(null, true);
      }

      return callback(
        new Error("CORS: Origin tidak diizinkan.")
      );
    },

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
    ],

    credentials: true,
  })
);

// =====================================
// GLOBAL MIDDLEWARE
// =====================================

app.use(express.json({ limit: "2mb" }));

app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb",
  })
);

// =====================================
// STATIC FILES
// =====================================

// Default folder:
// tapjaya-backend/uploads
//
// Dapat diubah melalui environment variable UPLOAD_DIR.

const uploadDirectory = path.resolve(
  process.env.UPLOAD_DIR ||
    path.join(process.cwd(), "uploads")
);

// Akses gambar melalui:
// http://localhost:5000/uploads/nama-file.jpg

app.use(
  "/uploads",
  express.static(uploadDirectory)
);

// =====================================
// GENERAL ROUTES
// =====================================

// Upload gambar produk.
app.use("/api/upload", uploadRoutes);

// Cek koneksi backend.
app.get("/", (_req, res) => {
  return res.status(200).json({
    success: true,
    message: "TAP JAYA Backend berjalan",
  });
});

// =====================================
// WEB ADMIN API
// =====================================

// Autentikasi admin.
app.use("/api/auth", authRoutes);

// Verifikasi token admin.
app.get(
  "/api/auth/me",
  verifyToken,
  (_req, res) => {
    return res.status(200).json({
      success: true,
      message: "Token valid. Akses admin diterima.",
    });
  }
);

// Dashboard.
app.use("/api/dashboard", dashboardRoutes);

// Manajemen pesanan admin.
app.use("/api/orders", orderRoutes);

// Manajemen produk.
app.use("/api/products", productRoutes);

// Laporan keuangan.
app.use("/api/reports", reportRoutes);

// Pengaturan.
app.use("/api/settings", settingsRoutes);

// =====================================
// MOBILE API
// =====================================

// 1. Daftar produk pelanggan.
app.use(
  "/api/mobile/products",
  mobileProductRoutes
);

// 2. Checkout pelanggan.
app.use(
  "/api/mobile/checkout",
  mobileCheckoutRoutes
);

// 3. Detail dan status pesanan.
app.use(
  "/api/mobile/orders",
  mobileOrderRoutes
);

// 4. Rekomendasi menu AI.
app.use(
  "/api/mobile/recommendations",
  mobileRecommendationRoutes
);

// =====================================
// 404 HANDLER
// =====================================

app.use((_req, res) => {
  return res.status(404).json({
    success: false,
    message: "Endpoint tidak ditemukan.",
  });
});

// =====================================
// GLOBAL ERROR HANDLER
// =====================================

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Server error:", error);

    if (
      error instanceof Error &&
      error.message.includes("CORS")
    ) {
      return res.status(403).json({
        success: false,
        message: "Origin tidak diizinkan.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server.",
    });
  }
);

// =====================================
// START SERVER
// =====================================

app.listen(PORT, "0.0.0.0", () => {
  console.log("----------------------------------");
  console.log("TAP JAYA BACKEND BERJALAN");
  console.log("----------------------------------");

  console.log(
    `Server: http://localhost:${PORT}`
  );

  console.log(
    `Upload directory: ${uploadDirectory}`
  );

  console.log(
    `Products: http://localhost:${PORT}/api/mobile/products`
  );

  console.log(
    `Checkout: http://localhost:${PORT}/api/mobile/checkout`
  );

  console.log(
    `Orders: http://localhost:${PORT}/api/mobile/orders`
  );

  console.log(
    `Recommendations: http://localhost:${PORT}/api/mobile/recommendations`
  );

  console.log("----------------------------------");
});
