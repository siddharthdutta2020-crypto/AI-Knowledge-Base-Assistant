import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import User from "../models/User";
import { signAdminToken } from "../utils/jwt";

const router = Router();

/**
 * POST /api/auth/login
 * Admin login. Public route (no token required to hit this one, obviously).
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = signAdminToken({ userId: user.id, email: user.email });

    return res.json({ token, email: user.email });
  } catch (err) {
    console.error("[auth] login error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
