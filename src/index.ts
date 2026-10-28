
import "dotenv/config";
import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import orderRoutes from "./routes/order.routes";
import { verifyToken } from "./middleware/verifyToken";

const app = express();
const PORT = Number(process.env.PORT || 5000);

app.use(
  cors({
    origin: "http://localhost:3000",
  })
);

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    message: "TAP JAYA Backend berjalan",
  });
});

// Login dan autentikasi admin
app.use("/api/auth", authRoutes);

app.get("/api/auth/me", verifyToken, (_req, res) => {
  res.json({
    message: "Token valid. Akses admin diterima.",
  });
});

// Dashboard admin
app.use("/api/dashboard", dashboardRoutes);

// Manajemen pesanan
app.use("/api/orders", orderRoutes);

app.listen(PORT, () => {
  console.log(`Backend berjalan di http://localhost:${PORT}`);
});
