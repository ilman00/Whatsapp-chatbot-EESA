import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AdminTokenPayload {
  username: string;
  role: "admin";
}

// Extend Express Request so downstream handlers can read req.admin
declare global {
  namespace Express {
    interface Request {
      admin?: AdminTokenPayload;
    }
  }
}

export function verifyAdminToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, process.env.ADMIN_JWT_SECRET!) as AdminTokenPayload;
    req.admin = payload;
    next();
  } catch {
    res.status(401).json({ success: false, error: "Invalid or expired token" });
  }
}