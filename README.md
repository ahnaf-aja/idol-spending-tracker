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
    categories.ts     taksonomi idol & kategori (SUMBER TUNGGAL daftar kategori)
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

**Kategori ada di satu tempat.** `src/lib/categories.ts` memegang seluruh taksonomi (`EXPENSE_CATEGORIES`, `CATEGORY_META`, `CATEGORY_OPTIONS`, `CATEGORY_LABELS`). Kategori disimpan sebagai `String` biasa di database — bukan enum — sehingga menambah kategori tidak butuh migrasi dan tidak menyentuh data lama. Halaman form, History, filter, Dashboard, Statistics, Member Journal, dan Budget semua membaca dari sumber yang sama dan mengagregasi secara dinamis (lihat `src/lib/stats.ts`), jadi tidak ada daftar kategori yang di-hardcode di tempat lain. Menambah kategori = tambah entri di `EXPENSE_CATEGORIES` + `CATEGORY_META`, daftarkan ikonnya di `CATEGORY_ICONS`. `tests/domain.test.ts` gagal bila ketiganya tidak sinkron.

**Pemisahan environment.** `next dev` memuat `.env.local` dan itu menang atas `.env`. Menaruh URL produksi di `.env.local` membuat development lokal (dan test end-to-end) menulis ke database produksi. Karena itu URL produksi hanya boleh ada di `.env.production.local`, dan `tests/env-isolation.test.ts` mengunci aturannya. Fixture E2E juga menolak berjalan bila host database bukan localhost.

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

Aplikasi sudah live di **https://idol-spending-tracker.vercel.app** (Vercel + Neon Postgres, gratis).

1. Set `DATABASE_URL`, `APP_URL`, `APP_TIMEZONE`, dan `SEED_USER_*` di environment.
2. `npm run db:push` (atau `npm run db:migrate` untuk migrasi berversi).
3. `npm run seed` sekali untuk membuat owner.
4. `npm run build && npm start`.
5. Untuk email reset password sungguhan, isi `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS` (atau `SMTP_URL`).

`.env` sudah di-gitignore — jangan pernah commit credential.

### Catatan penting untuk produksi

- **Forgot Password belum berfungsi untuk user sungguhan.** Tanpa `SMTP_*`, link reset ditulis ke `.dev-outbox/` di server, bukan dikirim lewat email. Halaman tetap memberi pesan generik (req 6) dan token tetap dibuat, tapi user tidak akan pernah menerima linknya. Isi SMTP dulu kalau fitur ini mau dipakai.
- **Rate limit aktif di produksi** (req 40): 8 percobaan login per 5 menit per IP+identifier. Kalau terkunci, tunggu window-nya lewat atau bersihkan tabel `rate_limit_hits`.
- **Ownership tetap ditegakkan di produksi**: `user_id` selalu dari session, data user lain → 404.

### Deploy ulang (Vercel + Neon)

```bash
vercel link --yes --project idol-spending-tracker   # sekali saja
vercel integration add neon                          # sekali saja (bikin DATABASE_URL)
vercel env add APP_URL production                    # https://<domain>
vercel deploy --prod --yes
```

Dua pitfall yang sudah terbukti di project ini:

1. **Deployment Protection.** Project baru bisa default ke SSO, sehingga semua request 302 ke `vercel.com/sso-api` dan orang tanpa akun Vercel tidak bisa membuka link. Matikan: `vercel project protection disable --sso`. Verifikasi dengan `curl` tanpa auth — halaman publik harus 200, bukan 302.
2. **`.env` ikut ter-upload.** Vercel CLI mengabaikan `.gitignore`. `.vercelignore` di repo ini sudah mengecualikan `.env`/`.env.*` supaya `APP_URL` lokal tidak menimpa environment produksi.

Saat mengubah schema: jalankan `prisma db push` memakai `DATABASE_URL_UNPOOLED` (bukan yang `-pooler`), lalu `npm run seed` dengan `DATABASE_URL` yang sama.
