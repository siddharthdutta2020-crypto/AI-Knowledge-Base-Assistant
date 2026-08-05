import { Request, Response, NextFunction } from "express";
import { verifyAdminToken, AdminTokenPayload } from "../utils/jwt";

export interface AuthenticatedRequest extends Request {
  admin?: AdminTokenPayload;
}

/**
 * Protects admin-only routes (upload/list/delete/reprocess PDFs, dashboard).
 * Public chat routes must NOT use this middleware, per the assignment spec.
 */
export function requireAdminAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or malformed Authorization header" });
    return;
  }

  const token = header.split(" ")[1];

  try {
    const payload = verifyAdminToken(token);
    req.admin = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
