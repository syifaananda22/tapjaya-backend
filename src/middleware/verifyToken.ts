
import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

export function verifyToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    res.status(401).json({
      message: "Token tidak tersedia.",
    });
    return;
  }

  const token = authorization.slice(7);
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    res.status(500).json({
      message: "Konfigurasi server belum lengkap.",
    });
    return;
  }

  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ["HS256"],
    });

    if (
      typeof payload === "string" ||
      !payload.sub ||
      (payload as JwtPayload).role !== "admin"
    ) {
      res.status(403).json({
        message: "Akses ditolak.",
      });
      return;
    }

    next();
  } catch {
    res.status(401).json({
      message: "Token tidak valid atau sudah kedaluwarsa.",
    });
  }
}
