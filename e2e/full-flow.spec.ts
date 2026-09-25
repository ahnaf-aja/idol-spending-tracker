import { expect, test } from "./fixtures";

import { addExpense, attemptLogin, e2eUser, fillByLabel, login, registerUser } from "./helpers";

/**
 * Requirement 50: the full end-to-end user flow.
 * Register -> Login -> Dashboard -> Add Expense -> History -> Journal -> Edit
 * -> Delete -> Budget -> Logout -> protected route -> Login again.
 */

test.describe.configure({ mode: "serial" });

test("register membuat akun baru dan masuk ke dashboard", async ({ page }) => {
  await registerUser(page);

  await expect(page.getByRole("heading", { name: new RegExp(`Welcome back, ${e2eUser.username}`) })).toBeVisible();
  // Fresh account: the dashboard shows the empty state, not a broken zero-card.
  await expect(page.getByText("Belum ada pengeluaran")).toBeVisible();
  await expect(page.getByRole("link", { name: "+ Tambah Pengeluaran" })).toBeVisible();
});

test("register menolak username duplikat", async ({ page }) => {
  await page.goto("/register");
  await fillByLabel(page, "Username", e2eUser.username);
  await fillByLabel(page, "Email", `other_${e2eUser.email}`);
  await fillByLabel(page, "Password", e2eUser.password);
  await fillByLabel(page, "Confirm Password", e2eUser.password);
  await page.getByRole("button", { name: "Daftar" }).click();

  await expect(page.getByText("Username sudah digunakan.").first()).toBeVisible();
  await expect(page).toHaveURL(/\/register/);
});

test("register menolak email duplikat", async ({ page }) => {
  await page.goto("/register");
  await fillByLabel(page, "Username", `other_${e2eUser.username}`);
  await fillByLabel(page, "Email", e2eUser.email);
  await fillByLabel(page, "Password", e2eUser.password);
  await fillByLabel(page, "Confirm Password", e2eUser.password);
  await page.getByRole("button", { name: "Daftar" }).click();

  await expect(page.getByText("Email sudah terdaftar.").first()).toBeVisible();
});

test("register menolak password kurang dari 8 karakter dan konfirmasi yang beda", async ({ page }) => {
  await page.goto("/register");
  await fillByLabel(page, "Username", `short_${e2eUser.username}`);
  await fillByLabel(page, "Email", `short_${e2eUser.email}`);
  await fillByLabel(page, "Password", "1234567");
  await fillByLabel(page, "Confirm Password", "1234567");
  await page.getByRole("button", { name: "Daftar" }).click();
  await expect(page.getByText("Password minimal 8 karakter")).toBeVisible();

  await fillByLabel(page, "Password", "12345678");
  await fillByLabel(page, "Confirm Password", "87654321");
  await page.getByRole("button", { name: "Daftar" }).click();
  await expect(page.getByText("Konfirmasi password tidak sama")).toBeVisible();
});

test("login salah gagal tanpa membocorkan akun", async ({ page }) => {
  await attemptLogin(page, e2eUser.username, "WrongPassword999");
  await expect(page.getByText("Username/email atau password salah.")).toBeVisible();

  // Unknown account: identical wording, still no hint.
  await attemptLogin(page, "tidak_ada_akun_ini", "WrongPassword999");
  await expect(page.getByText("Username/email atau password salah.")).toBeVisible();
});

test("login benar berhasil dan dashboard memuat data", async ({ page }) => {
  await login(page, e2eUser.email, e2eUser.password);
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  await expect(page.getByText(new RegExp(`Welcome back, ${e2eUser.username}`))).toBeVisible();
});

test("logout lalu protected route tidak bisa diakses", async ({ page }) => {
  await login(page, e2eUser.username, e2eUser.password);
  await page.waitForURL(/\/dashboard/);

  // Logout lives in the desktop sidebar.
  await page.getByRole("button", { name: "Logout" }).first().click();
  await page.waitForURL(/\/login/, { timeout: 30_000 });

  for (const path of ["/dashboard", "/history", "/journal", "/statistics", "/budget", "/profile"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login\?next=/);
  }
});

test("add expense: member dinormalisasi ke FREYA dan dashboard ikut update", async ({ page }) => {
  await login(page, e2eUser.username, e2eUser.password);
  await page.waitForURL(/\/dashboard/);

  await addExpense(page, {
    idol: "JKT48",
    member: "freya",
    category: "VC",
    amount: 200_000,
    date: "2026-09-25",
    note: "VC 2 tiket",
  });

  // Toast + dashboard figures
  await expect(page.getByText("Pengeluaran berhasil ditambahkan.").first()).toBeVisible();
  await expect(page.getByText("Rp200.000").first()).toBeVisible();
  await expect(page.getByText("1 transaksi").first()).toBeVisible();

  // Recent transaction: idol • MEMBER (uppercased). The regex is deliberately
  // case-SENSITIVE so "freya" would fail while "FREYA" passes.
  const recent = page.getByText("JKT48 • FREYA").first();
  await expect(recent).toBeVisible();
  await expect(page.getByText(/JKT48 • freya/)).toHaveCount(0);

  // Charts picked it up
  await expect(page.getByText("Pengeluaran Berdasarkan Kategori")).toBeVisible();
  await expect(page.getByText("VC").first()).toBeVisible();
});

test("statistik: nominal di luar periode ini hanya masuk rentang yang cocok", async ({ page }) => {
  await login(page, e2eUser.username, e2eUser.password);

  // A transaction dated in a custom range, used later for the custom-date test.
  await addExpense(page, {
    idol: "TNT",
    member: "gracie",
    category: "2S",
    amount: 150_000,
    date: "2026-09-15",
    note: "Custom range check",
  });

  // Current period total must not include the 15 Sep transaction.
  await expect(page.getByText("Rp200.000").first()).toBeVisible();
});

test("history menampilkan transaksi, filter member bekerja, dan edit mengubah data", async ({ page }) => {
  await login(page, e2eUser.username, e2eUser.password);
  await page.goto("/history");

  await expect(page.getByText("JKT48 • FREYA").first()).toBeVisible();
  await expect(page.getByText("Rp200.000").first()).toBeVisible();

  // Member filter built from the database
  await page.getByLabel("Member", { exact: true }).click();
  await page.getByRole("option", { name: "FREYA" }).click();
  await expect(page.getByText("JKT48 • FREYA").first()).toBeVisible();
  await expect(page.getByText("TNT • GRACIE")).toHaveCount(0);

  // Search by note
  await page.getByLabel("Cari transaksi").fill("VC 2 tiket");
  await page.keyboard.press("Enter");
  await expect(page.getByText("JKT48 • FREYA").first()).toBeVisible();

  // Clear filters, then edit the FREYA transaction
  await page.getByRole("button", { name: /Bersihkan semua filter/ }).click();
  await page.goto("/history");
  await page.getByRole("link", { name: "Edit transaksi" }).first().click();
  await page.waitForURL(/\/expenses\/.+\/edit/);

  // The wizard opens on step 1 with the existing values pre-filled.
  await expect(page.getByRole("radio", { name: /Other/ })).toBeVisible();
  // Jump straight to the amount step using the desktop chips, then change it.
  await page.getByRole("button", { name: "Nominal", exact: true }).click();
  await page.getByLabel("Jumlah Pengeluaran").fill("250000");
  await page.getByRole("button", { name: "Konfirmasi", exact: true }).click();
  await page.getByRole("button", { name: "Simpan Perubahan" }).click();
  await page.waitForURL(/\/history/, { timeout: 30_000 });

  await expect(page.getByText("Rp250.000").first()).toBeVisible();
  await expect(page.getByText("Rp200.000")).toHaveCount(0);
});

test("member journal terbentuk dari database dan detail member menampilkan timeline", async ({ page }) => {
  await login(page, e2eUser.username, e2eUser.password);

  // The 15 Sep transaction is outside the current 25-24 period, so in the
  // default view GRACIE must be absent and FREYA present (requirement 21: the
  // journal follows the selected date period, it is not an all-time list).
  await page.goto("/journal");
  await expect(page.getByText("FREYA").first()).toBeVisible();
  await expect(page.getByText("GRACIE")).toHaveCount(0);
  // Normalised: never a lowercase twin.
  await expect(page.getByText("Freya", { exact: true })).toHaveCount(0);

  await page.getByRole("link", { name: /FREYA/ }).first().click();
  await page.waitForURL(/\/journal\/FREYA/);
  await expect(page.getByRole("heading", { name: /FREYA — Spending Journal/ })).toBeVisible();
  await expect(page.getByText("Rp250.000").first()).toBeVisible();
  await expect(page.getByText("Timeline")).toBeVisible();
  await expect(page.getByText("VC 2 tiket").first()).toBeVisible();

  // All-time view brings GRACIE back.
  await page.goto("/journal?preset=all");
  await expect(page.getByText("GRACIE").first()).toBeVisible();
  await expect(page.getByText("FREYA").first()).toBeVisible();
});

test("custom date filter mengubah seluruh statistik, dan reset mengembalikannya", async ({ page }) => {
  await login(page, e2eUser.username, e2eUser.password);
  await page.goto("/statistics");

  const totalLabel = page.getByText("Total Spending").first();
  await expect(totalLabel).toBeVisible();
  await expect(page.getByText("Rp250.000").first()).toBeVisible();

  // Custom range that contains only the 15 Sep transaction (Rp150.000)
  await page.goto("/statistics?preset=custom&start=2026-09-01&end=2026-09-20");
  await expect(page.getByText("Rp150.000").first()).toBeVisible();
  await expect(page.getByText("Rp250.000")).toHaveCount(0);
  await expect(page.getByText(/Custom · 1 Sep 2026 – 20 Sep 2026/)).toBeVisible();

  // Reset Filter returns to the current 25-period (Rp250.000)
  await page.getByRole("button", { name: "Reset Filter" }).click();
  await expect(page.getByText("Rp250.000").first()).toBeVisible();
});

test("previous period comparison bekerja tanpa Infinity/NaN", async ({ page }) => {
  await login(page, e2eUser.username, e2eUser.password);

  // The 15 Sep transaction falls in the PREVIOUS 25-24 period (25 Aug - 24 Sep),
  // so that view holds exactly that one expense, not the empty state.
  await page.goto("/dashboard?preset=previous");
  await expect(page.getByText("Rp150.000").first()).toBeVisible();
  await expect(page.getByText("1 transaksi").first()).toBeVisible();

  // Current period compares against it -> a real percentage, never Infinity/NaN.
  await page.goto("/dashboard?preset=current");
  await expect(page.getByText(/vs periode sebelumnya/)).toBeVisible();
  await expect(page.getByText(/Infinity|NaN/)).toHaveCount(0);
});

test("budget: set, progress, dan over budget tanpa memblokir transaksi", async ({ page }) => {
  await login(page, e2eUser.username, e2eUser.password);
  await page.goto("/budget");

  await page.getByLabel(/Budget untuk/).fill("1000000");
  await page.getByRole("button", { name: "Simpan Budget" }).click();
  await expect(page.getByText("Budget berhasil disimpan.").first()).toBeVisible();

  await page.reload();
  await expect(page.getByText("Rp1.000.000").first()).toBeVisible();
  await expect(page.getByText("Sisa Rp750.000")).toBeVisible();
  await expect(page.getByText("25%").first()).toBeVisible();
});

test("budget over: transaksi baru tetap bisa dicatat", async ({ page }) => {
  await login(page, e2eUser.username, e2eUser.password);

  // Small budget, then a large transaction -> over budget, no blocking.
  await page.goto("/budget");
  await page.getByLabel(/Budget untuk/).fill("100000");
  await page.getByRole("button", { name: "Simpan Budget" }).click();
  await expect(page.getByText("Budget berhasil disimpan.").first()).toBeVisible();

  await addExpense(page, {
    idol: "JKT48",
    member: "christy",
    category: "MNG",
    amount: 500_000,
    date: "2026-10-01",
    note: "test over budget",
  });

  await page.goto("/budget");
  await expect(page.getByText("Over Budget").first()).toBeVisible();
  await expect(page.getByText(/melewati budget periode ini/)).toBeVisible();
});

test("empty state muncul untuk akun baru pada history/statistics/journal", async ({ page }) => {
  await registerUser(page, {
    username: `e2e_empty_${Math.random().toString(36).slice(2, 8)}`,
    email: `e2e_empty_${Math.random().toString(36).slice(2, 8)}@example.test`,
    password: "E2ePassword123",
    newPassword: "E2ePassword456",
  });

  for (const [path, text] of [
    ["/history", "Belum ada pengeluaran"],
    ["/statistics", "Belum ada data untuk dianalisis"],
    ["/journal", "Belum ada member tercatat"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByText(text)).toBeVisible();
  }
});

test("delete transaksi dengan modal konfirmasi lalu statistik ikut berubah", async ({ page }) => {
  await login(page, e2eUser.username, e2eUser.password);
  await page.goto("/history");

  const before = await page.getByText("JKT48 • CHRISTY").count();
  expect(before).toBeGreaterThan(0);

  // Find the row containing CHRISTY and delete it.
  const row = page.getByTestId("expense-row").filter({ hasText: "JKT48 • CHRISTY" }).first();
  await row.getByRole("button", { name: "Hapus transaksi" }).click();

  await expect(page.getByText("Hapus pengeluaran ini?")).toBeVisible();
  await expect(page.getByText("Data yang sudah dihapus tidak dapat dikembalikan.")).toBeVisible();
  await page.getByRole("button", { name: "Hapus", exact: true }).last().click();

  await expect(page.getByText("Pengeluaran berhasil dihapus.").first()).toBeVisible();
  await expect(page.getByText("JKT48 • CHRISTY")).toHaveCount(0);

  // Statistics reflect the deletion (Rp500.000 gone).
  await page.goto("/statistics");
  await expect(page.getByText("Rp500.000")).toHaveCount(0);
});

test("data masih tersimpan setelah logout dan login kembali", async ({ page }) => {
  await login(page, e2eUser.username, e2eUser.password);
  await page.waitForURL(/\/dashboard/);
  await expect(page.getByText("JKT48 • FREYA")).toBeVisible();

  await page.getByRole("button", { name: "Logout" }).first().click();
  await page.waitForURL(/\/login/);

  await login(page, e2eUser.username, e2eUser.password);
  await page.waitForURL(/\/dashboard/);
  await expect(page.getByText("JKT48 • FREYA")).toBeVisible();
  await expect(page.getByText("Rp250.000").first()).toBeVisible();
});

test("profile menampilkan data akun dan bisa ganti password", async ({ page }) => {
  await login(page, e2eUser.username, e2eUser.password);
  await page.goto("/profile");

  await expect(page.getByText(e2eUser.email)).toBeVisible();
  await expect(page.getByText("Total Spending All Time")).toBeVisible();

  await page.getByRole("button", { name: "Change Password" }).click();
  await fillByLabel(page, "Current Password", e2eUser.password);
  await fillByLabel(page, "New Password", e2eUser.newPassword);
  await fillByLabel(page, "Confirm New Password", e2eUser.newPassword);
  await page.getByRole("button", { name: "Simpan Password Baru" }).click();
  await expect(page.getByText("Password berhasil diubah.").first()).toBeVisible();

  // Old password must now fail, new one must work.
  await page.getByRole("button", { name: "Logout" }).first().click();
  await page.waitForURL(/\/login/);
  await attemptLogin(page, e2eUser.username, e2eUser.password);
  await expect(page.getByText("Username/email atau password salah.")).toBeVisible();

  await login(page, e2eUser.username, e2eUser.newPassword);
  await expect(page).toHaveURL(/\/dashboard/);
});

test("forgot password: response generik dan reset penuh (requirement 51)", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot Password?" }).click();
  await page.waitForURL(/\/forgot-password/);

  await fillByLabel(page, "Email", e2eUser.email);
  await page.getByRole("button", { name: "Send Reset Link" }).click();
  await expect(page.getByText("Jika email tersebut terdaftar, kami telah mengirimkan link reset password.")).toBeVisible();

  // Unregistered email: identical response.
  await page.goto("/forgot-password");
  await fillByLabel(page, "Email", "never-registered@example.test");
  await page.getByRole("button", { name: "Send Reset Link" }).click();
  await expect(page.getByText("Jika email tersebut terdaftar, kami telah mengirimkan link reset password.")).toBeVisible();

  // An invalid token must be refused.
  await page.goto("/reset-password?token=definitely-not-a-real-token");
  await fillByLabel(page, "New Password", "BrandNewPass123");
  await fillByLabel(page, "Confirm New Password", "BrandNewPass123");
  await page.getByRole("button", { name: "Reset Password" }).click();
  await expect(page.getByText("Link reset password tidak valid.")).toBeVisible();

  // A missing token shows the dedicated invalid-link screen.
  await page.goto("/reset-password");
  await expect(page.getByText("Link tidak valid")).toBeVisible();
});

test("dark mode toggle tersedia dan chart tetap ter-render", async ({ page }) => {
  await login(page, e2eUser.username, e2eUser.newPassword);
  await page.goto("/profile");

  // The theme switch exists in both the sidebar and the page body, so scope to
  // the main region to keep the locator unambiguous.
  const main = page.getByRole("main");
  await expect(main.getByRole("radiogroup", { name: "Tema tampilan" })).toBeVisible();
  await main.getByRole("radio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.goto("/statistics");
  await expect(page.locator(".recharts-surface").first()).toBeVisible();

  await page.goto("/profile");
  await page.getByRole("main").getByRole("radio", { name: "Light" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

