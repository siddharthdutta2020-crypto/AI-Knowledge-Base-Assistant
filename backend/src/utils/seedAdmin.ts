import "dotenv/config";
import bcrypt from "bcryptjs";
import { connectDB } from "../config/db";
import User from "../models/User";
import mongoose from "mongoose";

/**
 * Run once: `ts-node src/utils/seedAdmin.ts`
 * Creates the initial admin user using ADMIN_EMAIL / ADMIN_PASSWORD from .env.
 */
async function seed() {
  await connectDB();

  const email = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || "";

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env");
  }

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`[seed] Admin user ${email} already exists, skipping.`);
    await mongoose.disconnect();
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  await User.create({ email, password: hashed });

  console.log(`[seed] Admin user created: ${email}`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("[seed] failed", err);
  process.exit(1);
});
