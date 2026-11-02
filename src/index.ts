
import "dotenv/config";

import express from "express";
import cors from "cors";
import path from "path";

import authRoutes from "./routes/auth.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import orderRoutes from "./routes/order.routes";
import productRoutes from "./routes/product.routes";
import uploadRoutes from "./routes/upload.routes";
import reportRoutes from "./routes/report.routes";
import settingsRoutes from "./routes/settings.routes";

import { verifyToken } from "./middleware/verifyToken";

const app = express();
const PORT = Number(process.env.PORT || 5000);

// CORS harus berada sebelum seluruh route.
app.use(
  cors({
    origin: "http://localhost:3000",
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
    ],
  })
);

app.use(express.json());

// Akses gambar produk
app.use(
  "/uploads",
  express.static(
    path.resolve(process.cwd(), "uploads")
  )
);

// Upload produk
app.use("/api/upload", uploadRoutes);

// Cek server
app.get("/", (_req, res) => {
  res.json({
    message: "TAP JAYA Backend berjalan",
  });
});

// Login dan autentikasi
app.use("/api/auth", authRoutes);

app.get(
  "/api/auth/me",
  verifyToken,
  (_req, res) => {
    res.json({
      message: "Token valid. Akses admin diterima.",
    });
  }
);

// Dashboard
app.use("/api/dashboard", dashboardRoutes);

// Pesanan
app.use("/api/orders", orderRoutes);

// Produk
app.use("/api/products", productRoutes);

// Laporan keuangan
app.use("/api/reports", reportRoutes);

// Pengaturan
app.use("/api/settings", settingsRoutes);

// Jalankan backend
app.listen(PORT, () => {
  console.log(
    `Backend berjalan di http://localhost:${PORT}`
  );
});
