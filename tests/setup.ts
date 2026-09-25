import "dotenv/config";

// Tests talk to whatever DATABASE_URL points at. They create their own users
// with an `itest_` prefix and clean up after themselves, so running them
// against a development database never touches real data.
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL belum di-set. Salin .env.example ke .env dulu.");
}

process.env.APP_TIMEZONE ||= "Asia/Jakarta";
