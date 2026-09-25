/**
 * Seed script - creates the owner account from environment variables.
 *
 * Rules (requirement 5):
 *   1. check whether the username already exists
 *   2. if not, create the account
 *   3. hash the password first
 *   4. never create a duplicate account
 *
 * The password is read from SEED_USER_PASSWORD and is never printed.
 * Usage: npm run seed
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SEED_PASSWORD_MIN_LENGTH = 8;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    console.error(`✖ ${name} belum diisi. Isi dulu di file .env (lihat .env.example).`);
    process.exit(1);
  }
  return value.trim();
}

async function main() {
  const username = requireEnv("SEED_USERNAME").toLowerCase();
  const email = requireEnv("SEED_USER_EMAIL").toLowerCase();
  const password = requireEnv("SEED_USER_PASSWORD");

  if (password.length < SEED_PASSWORD_MIN_LENGTH) {
    console.error(`✖ SEED_USER_PASSWORD minimal ${SEED_PASSWORD_MIN_LENGTH} karakter.`);
    process.exit(1);
  }
  if (password.length > 72) {
    console.error("✖ SEED_USER_PASSWORD maksimal 72 karakter (batas bcrypt).");
    process.exit(1);
  }
  if (!/^[a-z0-9._-]+$/.test(username)) {
    console.error("✖ SEED_USERNAME hanya boleh huruf/angka/titik/underscore/strip.");
    process.exit(1);
  }

  const existingByUsername = await prisma.user.findUnique({ where: { username } });
  if (existingByUsername) {
    console.log(`✓ Akun "${username}" sudah ada - tidak ada akun baru yang dibuat.`);
    return;
  }

  const existingByEmail = await prisma.user.findUnique({ where: { email } });
  if (existingByEmail) {
    console.log(`✓ Email "${email}" sudah terdaftar (username: ${existingByEmail.username}) - dilewati.`);
    return;
  }

  // Hash before it ever touches the database. Nothing is ever stored in plaintext.
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: { username, email, passwordHash },
    select: { id: true, username: true, email: true, createdAt: true },
  });

  console.log("✓ Initial account dibuat:");
  console.log(`  username : ${user.username}`);
  console.log(`  email    : ${user.email}`);
  console.log(`  password : (diambil dari SEED_USER_PASSWORD, tidak ditampilkan)`);
  console.log(`  id       : ${user.id}`);
}

main()
  .catch((error) => {
    console.error("✖ Seed gagal:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
