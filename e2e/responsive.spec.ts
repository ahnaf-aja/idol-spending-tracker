import { expect, test } from "./fixtures";

import { addExpense, login, registerUser } from "./helpers";

/**
 * Requirement 52: responsive behaviour at 375 / 768 / 1440.
 * This file runs in three Playwright projects (mobile, tablet, desktop).
 */

const user = {
  username: `e2e_resp_${Math.random().toString(36).slice(2, 8)}`,
  email: `e2e_resp_${Math.random().toString(36).slice(2, 8)}@example.test`,
  password: "ResponsivePass123",
  newPassword: "ResponsivePass123",
};

test.describe.configure({ mode: "serial" });

test("login page tidak overflow horizontal", async ({ page }) => {
  await page.goto("/login");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByRole("button", { name: "Login", exact: true })).toBeVisible();
});

test("navigasi sesuai ukuran layar (bottom nav di mobile, sidebar di desktop)", async ({ page, viewport }) => {
  await registerUser(page, user);

  const isMobile = (viewport?.width ?? 1440) < 1024;
  const bottomNav = page.getByRole("navigation", { name: "Navigasi bawah" });

  if (isMobile) {
    await expect(bottomNav).toBeVisible();
    // The prominent center Add button must be inside/above the bar.
    await expect(page.getByRole("link", { name: "Tambah pengeluaran", exact: true })).toBeVisible();
  } else {
    await expect(bottomNav).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Navigasi utama" })).toBeVisible();
  }
});

test("form add expense nyaman dipakai dan tidak keluar layar", async ({ page }) => {
  await login(page, user.username, user.password);
  await page.waitForURL(/\/dashboard/);

  await page.goto("/expenses/new");
  await expect(page.getByTestId("step-title")).toHaveText("Pilih Idol / Group");

  const sendButton = page.getByRole("button", { name: "Lanjut" });
  await expect(sendButton).toBeVisible();
  await sendButton.scrollIntoViewIfNeeded();

  // Nothing may stick out horizontally at this width.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  // The amount field has to be reachable and usable at 375px.
  await page.getByRole("radio", { name: /^JKT48/ }).click();
  await page.getByRole("button", { name: "Lanjut" }).click();
  await page.getByRole("button", { name: "Lanjut" }).click();
  await expect(page.getByTestId("step-title")).toHaveText("Jenis Pengeluaran");
  await page.getByRole("radio", { name: "VC", exact: true }).click();
  await page.getByRole("button", { name: "Lanjut" }).click();

  await expect(page.getByTestId("step-title")).toHaveText("Jumlah Pengeluaran");
  await page.getByLabel("Jumlah Pengeluaran").fill("150000");
  await expect(page.getByText("Terbaca: Rp150.000")).toBeVisible();
});

test("modal delete tidak keluar layar", async ({ page }) => {
  await login(page, user.username, user.password);
  await page.waitForURL(/\/dashboard/);

  await addExpense(page, {
    idol: "JKT48",
    member: "respcheck",
    category: "Cheki",
    amount: 75_000,
    date: "2026-10-02",
  });

  await page.goto("/history");
  await page.getByRole("button", { name: "Hapus transaksi" }).first().click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);

  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
});

test("chart responsive dan halaman dashboard tidak overflow", async ({ page }) => {
  await login(page, user.username, user.password);
  await page.goto("/statistics");

  await expect(page.locator(".recharts-surface").first()).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  const surfaces = await page.locator(".recharts-surface").count();
  expect(surfaces).toBeGreaterThan(0);
});
