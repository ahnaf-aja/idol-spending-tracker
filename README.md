# Idol Spending Tracker

Personal finance tracker untuk pengeluaran aktivitas ngidol. **Next.js 15 + TypeScript + Tailwind v4 + Prisma + PostgreSQL**, dengan periode pengeluaran otomatis **tanggal 25 → 24 bulan berikutnya**.

## Menjalankan

```bash
# 1. Database (PostgreSQL)
docker run -d --name idol-tracker-pg \
  -e POSTGRES_USER=idol -e POSTGRES_PASSWORD=<password> -e POSTGRES_DB=idol_tracker \
  -p 5434:5432 -v idol_tracker_pgdata:/var/lib/postgresql/data postgres:16-alpine

# 2. Environment
cp .env.example .env    # isi DATABASE_URL + SEED_USER_*

# 3. Setup
npm install
npm run db:push
npm run seed            # membuat akun owner dari SEED_USER_*

# 4. Jalan
npm run dev             # http://localhost:3000
```

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build & serve |
| `npm run seed` | Membuat akun owner (idempotent, tidak pernah membuat duplikat) |
| `npm run db:push` | Sinkronisasi schema Prisma ke Postgres |
| `npm test` | Unit/integration test (vitest) |
| `npm run test:e2e` | End-to-end test (Playwright, butuh dev server jalan) |
| `npm run verify` | `typecheck` + unit test |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

## Akun owner (initial account)

Dibuat oleh `npm run seed` dari environment variable — **tidak ada credential di source code**:

```
SEED_USERNAME=nafaja
SEED_USER_EMAIL=<diisi sendiri>
SEED_USER_PASSWORD=<diisi sendiri>
```

Seed script mengecek username lebih dulu; kalau sudah ada, akun tidak dibuat ulang dan password tidak ditimpa.

## Struktur project

```
src/
  app/
    (auth)/           login, register, forgot-password, reset-password
    (app)/            dashboard, expenses, history, journal, statistics, budget, profile
  components/
    ui/               shadcn-style primitives (button, card, dialog, select, ...)
    layout/           sidebar, bottom nav, page header
    expenses/         wizard 7 langkah + currency input + aksi edit/hapus
    charts/           wrapper Recharts (donut, bar, line)
  lib/
    period.ts         mesin periode 25 → 24  ← inti domain
    currency.ts       format Rupiah (id-ID)
    normalize.ts      trim + UPPERCASE nama member
    categories.ts     taksonomi idol & kategori
    validation.ts     semua schema Zod
    stats.ts          agregasi dashboard/statistics/journal
    filters.ts        resolusi filter tanggal (current/previous/custom/all)
    route-guard.ts    aturan redirect (dipakai middleware + server)
    auth/             password (bcrypt cost 12), session, reset-tokens, service
    actions/          server actions auth & expense
    expenses/         repository — SUMBER TUNGGAL aturan ownership
    rate-limit.ts     rate limit berbasis database
    mail.ts           SMTP atau dev outbox
prisma/
  schema.prisma       User, Session, PasswordResetToken, RateLimitHit, Expense, Budget
  seed.ts             akun owner dari env
tests/                unit + integration (vitest, database asli)
e2e/                  alur end-to-end (Playwright, browser asli)
```

## Keputusan desain penting

**Periode 25 → 24.** `src/lib/period.ts` adalah satu-satunya sumber kebenaran. Tanggal 24 Okt masuk periode 25 Sep–24 Okt; tanggal 25 Okt mulai periode baru. Pergantian bulan dan tahun ditangani (`25 Des 2026 – 24 Jan 2027`).

**"Reset tanggal 25" bukan penghapusan data.** Saat periode berganti, dashboard menghitung periode baru (mulai Rp0) dan transaksi lama tetap ada di History. Tidak ada kode yang pernah menghapus transaksi otomatis.

**Tanggal disimpan date-only.** `expenseDate` bertipe `DATE` di Postgres, bukan timestamp UTC, sehingga tanggal tidak bergeser akibat konversi timezone.

**Normalisasi member di dua tempat.** Frontend (preview langsung) dan backend (sebelum insert/update) sama-sama `trim().toUpperCase()`. Member kosong disimpan sebagai `null`, bukan `""`. Ini yang membuat Journal tidak pernah memecah `FREYA` dan `Freya` menjadi dua entri.

**Ownership ada di satu tempat.** `src/lib/expenses/repository.ts` selalu mengambil `user_id` dari session; `user_id` dari client tidak pernah dipercaya. Membuka data user lain menghasilkan 404.

**Rate limit & session di database.** Bertahan setelah restart dan konsisten di banyak proses.

**Reset token.** Raw token hanya ada di link email; database menyimpan hash-nya. Sekali pakai, kedaluwarsa (default 20 menit), dan semua session lama dicabut setelah password diubah.

**Email tanpa layanan eksternal.** Tanpa `SMTP_HOST`/`SMTP_URL`, email ditulis ke `.dev-outbox/` dan link reset muncul di console server — bukan di response API atau browser.

## Testing

- `npm test` — unit + integration terhadap **PostgreSQL asli** (fixture user ber-prefix `itest_`, membersihkan dirinya sendiri).
- `npm run test:e2e` — Playwright menggerakkan browser sungguhan: alur lengkap (req 50), reset password (req 51), isolasi antar user (req 39), dan responsive 375/768/1440 (req 52).

```bash
npm run dev            # terminal 1
npm run test:e2e       # terminal 2
```

## Deploy

1. Set `DATABASE_URL`, `APP_URL`, `APP_TIMEZONE`, dan `SEED_USER_*` di environment.
2. `npm run db:push` (atau `npm run db:migrate` untuk migrasi berversi).
3. `npm run seed` sekali untuk membuat owner.
4. `npm run build && npm start`.
5. Untuk email reset password sungguhan, isi `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS` (atau `SMTP_URL`).

`.env` sudah di-gitignore — jangan pernah commit credential.
