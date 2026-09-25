# Checkpoint Log

Catatan progres per checkpoint (requirement 53). Tujuannya: kalau pekerjaan terhenti
karena limit/context habis, lanjutkan dari checkpoint terakhir — **jangan rebuild dari awal**.

Status akhir: **CHECKPOINT 1–10 SELESAI.**

---

## CHECKPOINT 1 — Project setup, Database, Prisma, Authentication ✅

**Selesai**
- Next.js 15.5.26 + TypeScript + Tailwind v4 (`src/` dir, alias `@/*`), App Router.
- PostgreSQL 16 (container `idol-tracker-pg`, host port 5434) + Prisma 6.
- Schema: `User`, `Session`, `PasswordResetToken`, `RateLimitHit`, `Expense`, `Budget` — dengan relasi, unique constraint, dan index.
- bcrypt cost 12 (`src/lib/auth/password.ts`), session berbasis database dengan cookie yang disimpan sebagai hash.

**File utama**: `package.json`, `prisma/schema.prisma`, `src/lib/prisma.ts`, `src/lib/auth/password.ts`, `src/lib/auth/session.ts`, `.env`, `.env.example`

**Catatan**: folder `D:\pengeluaran web` mengandung spasi, sehingga `create-next-app` menolak menulis langsung ke sana. Solusi: scaffold ke direktori sementara lalu pindahkan isinya.

---

## CHECKPOINT 2 — Login, Register, Forgot Password, Reset Password ✅

**Selesai**
- 4 halaman auth dengan `useActionState` + `useFormStatus` (tombol jadi "Masuk..."/"Membuat akun..." dan disabled saat pending).
- Register: username & email unik, email valid, password ≥ 8 karakter, konfirmasi cocok. Password di-hash sebelum disimpan.
- Login: identifier username **atau** email, remember me, pesan error generik (tidak membocorkan akun mana yang ada).
- Forgot password: jawaban selalu identik untuk email terdaftar maupun tidak.
- Reset password: token acak kriptografis, **hash** yang disimpan, sekali pakai, kedaluwarsa 20 menit, semua session dicabut setelah ganti password.
- Rate limiting (login 8/5mnt, register 5/jam, forgot 5/15mnt, reset 10/15mnt).
- `npm run seed` membuat akun owner dari `SEED_USER_*`, idempotent.

**File utama**: `src/app/(auth)/**`, `src/lib/actions/auth-actions.ts`, `src/lib/auth/service.ts`, `src/lib/auth/reset-tokens.ts`, `src/lib/rate-limit.ts`, `src/lib/mail.ts`, `prisma/seed.ts`

**Bug ditemukan & diperbaiki**: React 19 mengosongkan input tak-terkontrol setelah server action selesai, sehingga error validasi menghapus semua isian user. Diperbaiki dengan mengembalikan nilai (`values` di `ActionState`) sebagai `defaultValue` — password sengaja tidak pernah dikembalikan.

---

## CHECKPOINT 3 — Dashboard layout, Period tanggal 25 ✅

**Selesai**
- Mesin periode `src/lib/period.ts` — inti domain, dipakai client & server.
- Sidebar desktop + bottom navigation mobile dengan tombol **+ Add** prominent di tengah.
- Dashboard: "Welcome back, {username} 👋", kartu Total Pengeluaran Periode Ini + rentang periode.
- Empty state (req 45) dan skeleton loading.

**File utama**: `src/lib/period.ts`, `src/components/layout/**`, `src/app/(app)/dashboard/**`, `src/components/period-filter.tsx`

**Verifikasi**: 24 Okt → 25 Sep–24 Okt; 25 Okt → periode baru; 1 Nov → 25 Okt–24 Nov; 25 Des 2026 → 25 Des 2026–24 Jan 2027. Tidak ada kode yang menghapus transaksi saat periode berganti.

---

## CHECKPOINT 4 — Add Expense, Member normalization, Database integration ✅

**Selesai**
- Wizard 7 langkah: Idol → Member → Jenis → Nominal → Tanggal → Catatan → Konfirmasi.
- Selectable cards untuk idol dan kategori (bukan dropdown).
- Input Other → tersimpan ke `customIdolName` dan dipakai di statistik (bukan tertulis "Other").
- Currency input: menampilkan `Rp1.250.000`, mengirim integer mentah, menolak 0/negatif/desimal.
- Normalisasi member `trim().toUpperCase()` di **frontend dan backend**; kosong → `null`.

**File utama**: `src/components/expenses/expense-form.tsx`, `fields.tsx`, `src/lib/actions/expense-actions.ts`, `src/lib/expenses/repository.ts`, `src/lib/normalize.ts`, `src/lib/currency.ts`

---

## CHECKPOINT 5 — History, Edit, Delete, Filters ✅

**Selesai**
- History urut terbaru → terlama, lengkap dengan idol, member, kategori, nominal, tanggal, catatan.
- Filter idol / member / kategori / rentang tanggal + search. **Nama member dan idol diambil dari database user, tidak di-hardcode.**
- Section Spending Periods (req 30) — klik periode untuk melihat transaksinya.
- Edit & delete dengan modal konfirmasi; delete hanya untuk pemilik transaksi.
- Edit mengambil data lama dan mengisi ulang form.

**File utama**: `src/app/(app)/history/**`, `src/app/(app)/expenses/[id]/edit/**`, `src/components/expenses/expense-actions.tsx`, `src/components/confirm-dialog.tsx`

---

## CHECKPOINT 6 — Member Journal ✅

**Selesai**
- Daftar member di-generate dari transaksi user (bukan hardcode), beserta total & jumlah transaksi.
- Detail member: total, jumlah, rata-rata, terbesar + timeline.
- Filter periode di halaman detail.
- `FREYA` dan `Freya` tidak pernah terpecah menjadi dua entri.

**File utama**: `src/app/(app)/journal/page.tsx`, `src/app/(app)/journal/[member]/page.tsx`

---

## CHECKPOINT 7 — Statistics, Charts, Custom Date ✅

**Selesai**
- Statistik: total, rata-rata per transaksi, jumlah transaksi, transaksi terbesar.
- Chart: kategori (donut), idol (donut), member (bar), spending over time (line).
- Custom date range berlaku ke seluruh summary, chart, member spending, dan history.
- Label "NO MEMBER" pada chart member.
- Perbandingan periode sebelumnya (↑/↓ %) dengan penanganan pembagian nol — tidak pernah menampilkan `Infinity%` atau `NaN`.

**File utama**: `src/app/(app)/statistics/page.tsx`, `src/components/charts/index.tsx`, `src/lib/stats.ts`, `src/lib/filters.ts`

---

## CHECKPOINT 8 — Budget ✅

**Selesai**
- Budget per periode tanggal 25, disimpan di tabel `Budget`.
- Menampilkan Budget / Spent / Remaining / progress bar, serta status Over Budget.
- Budget **tidak pernah memblokir** transaksi baru — hanya monitoring.

**File utama**: `src/app/(app)/budget/page.tsx`, `budget-form.tsx`

---

## CHECKPOINT 9 — Profile, Change Password, Dark Mode ✅

**Selesai**
- Profile: username, email, tanggal daftar, total spending all-time, total transaksi, kategori paling sering.
- Change Password wajib password saat ini; password lama tidak boleh dipakai ulang; session lain dicabut.
- Dark mode Light / Dark / System (localStorage), chart tetap terbaca di dark mode.
- Logout.

**File utama**: `src/app/(app)/profile/**`, `src/components/theme-toggle.tsx`, `src/components/providers.tsx`

---

## CHECKPOINT 10 — Security testing, Authorization testing, Responsive testing, Bug fixing ✅

**Selesai**
- **Isolasi data**: seluruh query expense/budget/journal/statistics lewat repository yang mengambil `user_id` dari session. Membuka data user lain → **404**.
- **Rate limiting** diuji (login 8, forgot 5) dan punya kuota terpisah per identifier.
- **Session** disimpan sebagai hash, bukan raw token; `revokeAllSessions` bekerja.
- **Rate limit token reset**: expired ditolak, invalid ditolak, sekali pakai, password lama mati setelah reset.
- **Responsive** diuji otomatis di 375 / 768 / 1440 px: tidak ada overflow horizontal, bottom nav vs sidebar sesuai breakpoint, modal delete tidak keluar layar, currency input nyaman di HP.
- Error boundary menyembunyikan stack trace dan nilai environment.

**File utama**: `tests/**`, `e2e/**`, `src/app/global-error.tsx`, `src/app/(app)/error.tsx`, `src/lib/expenses/repository.ts`

---

## Bug yang ditemukan dan diperbaiki

| # | Bug | Perbaikan |
| --- | --- | --- |
| 1 | React 19 mengosongkan form setelah error validasi | Nilai dikembalikan sebagai `defaultValue` (`values` di `ActionState`); password tidak pernah dikembalikan |
| 2 | `formatIDRDigits(0)` menampilkan "0" alih-alih placeholder | 0/ kosong → string kosong |
| 3 | Validasi nominal menerima bentuk tidak sah | Schema union string/number dinormalisasi lalu divalidasi |
| 4 | "NO MEMBER" muncul sebagai member teratas | Dikecualikan dari leaderboard member |
| 5 | Label periode lintas tahun hanya menampilkan satu tahun | Menampilkan kedua tahun (`25 Des 2026 – 24 Jan 2027`) |
| 6 | Root error boundary bukan Client Component → build gagal | Ditulis ulang sebagai `"use client"` dengan `<html>/<body>` sendiri |
| 7 | **Submit ganda** membuat dua baris pengeluaran dari satu klik (req 46 dilanggar) | Idempotency key `clientToken` per submit + unique index `(user_id, client_token)`; replay tidak bisa membuat baris kedua |
| 8 | **Budget tidak pernah tersimpan** — form mengirim `amount-ui`, action membaca `amount` | Nama field disamakan (`name="amount"`); tereksekusi oleh test end-to-end |
| 9 | **Toast "Pengeluaran berhasil dihapus." tidak pernah muncul** walau data benar-benar terhapus | Toast dipindah ke dalam closure action, bukan `useEffect` pada state: `revalidatePath` melepas baris di commit yang sama sehingga komponen unmount sebelum effect sempat jalan |
| 10 | Reset password sukses tidak mengarahkan ulang ke Login (req 7) | `useEffect` redirect ke `/login?reset=success` setelah `state.ok` |

## Bug yang masih ada

Tidak ada yang diketahui. Verifikasi terakhir: **135 test unit/integration lulus**, **45/45 end-to-end lulus** (desktop + mobile 375px + tablet 768px), **typecheck bersih**, **lint 0 warning**, **production build 16 route**.

Catatan: tiga bug di atas (#7, #8, #9) hanya ketahuan lewat test end-to-end di browser sungguhan — test unit memanggil repository langsung sehingga melewati lapisan form ke server action.

## Next step

1. (Opsional) Tambah `prisma migrate` berversi untuk deployment produksi.
2. (Opsional) Konfigurasi SMTP sungguhan untuk email reset password — tanpa itu email masuk ke `.dev-outbox/`.
3. (Opsional) Export CSV untuk History dan recurring budget per bulan.
4. Push ke GitHub + deploy publik (Vercel + Neon) — lihat `README.md`.
