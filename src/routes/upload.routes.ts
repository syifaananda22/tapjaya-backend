
import { Router } from "express";
import type {
  Request,
  Response,
  NextFunction,
} from "express";

import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";

import { verifyToken } from "../middleware/verifyToken";

const router = Router();

const directory = path.resolve(
  process.cwd(),
  "uploads",
  "products"
);

fs.mkdirSync(directory, {
  recursive: true,
});

const extensions: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, done) => {
      done(null, directory);
    },

    filename: (_req, file, done) => {
      done(
        null,
        `${randomUUID()}${extensions[file.mimetype]}`
      );
    },
  }),

  limits: {
    fileSize: 2 * 1024 * 1024,
    files: 1,
  },

  fileFilter: (_req, file, done) => {
    if (!extensions[file.mimetype]) {
      done(
        new Error(
          "Format gambar harus JPG, PNG, atau WEBP."
        )
      );
      return;
    }

    done(null, true);
  },
});

router.post(
  "/products",

  verifyToken,

  (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    upload.single("image")(
      req,
      res,
      (err: unknown) => {
        if (err) {
          res.status(400).json({
            message:
              err instanceof multer.MulterError &&
              err.code === "LIMIT_FILE_SIZE"
                ? "Ukuran gambar maksimal 2 MB."
                : err instanceof Error
                  ? err.message
                  : "Gagal upload gambar.",
          });

          return;
        }

        next();
      }
    );
  },

  (
    req: Request,
    res: Response
  ) => {
    if (!req.file) {
      res.status(400).json({
        message: "Pilih gambar terlebih dahulu.",
      });

      return;
    }

    res.status(201).json({
      message: "Gambar berhasil diupload.",
      image:
        `/uploads/products/${req.file.filename}`,
    });
  }
);

export default router;
