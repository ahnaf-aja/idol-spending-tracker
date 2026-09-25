import { expect, test } from "./fixtures";

import { addExpense, e2eUser, login, registerUser } from "./helpers";

/**
 * Requirement 39: user A must never reach user B's data.
 * Two completely separate accounts, driven through the real UI.
 */

const userA = {
  username: `e2e_iso_a_${Math.random().toString(36).slice(2, 8)}`,
  email: `e2e_iso_a_${Math.random().toString(36).slice(2, 8)}@example.test`,
  password: "IsolationPass123",
  newPassword: "IsolationPass123",
};

const userB = {
  username: `e2e_iso_b_${Math.random().toString(36).slice(2, 8)}`,
  email: `e2e_iso_b_${Math.random().toString(36).slice(2, 8)}@example.test`,
  password: "IsolationPass123",
  newPassword: "IsolationPass123",
};

test.describe.configure({ mode: "serial" });

let expenseIdOfB = "";

test("user B mencatat transaksi rahasia", async ({ page }) => {
  await registerUser(page, userB);
  await addExpense(page, {
    idol: "JKT48",
    member: "secretmember",
    category: "Show",
    amount: 777_000,
    date: "2026-10-05",
    note: "HANYA MILIK B",
  });
  await expect(page.getByText("JKT48 • SECRETMEMBER")).toBeVisible();

  // Remember an id owned by B for the direct-access attempts below.
  await page.goto("/history");
  const href = await page.getByRole("link", { name: "Edit transaksi" }).first().getAttribute("href");
  expenseIdOfB = (href ?? "").split("/")[2] ?? "";
  expect(expenseIdOfB).not.toBe("");

  await page.getByRole("button", { name: "Logout" }).first().click();
  await page.waitForURL(/\/login/);
});

test("user A tidak melihat data user B di halaman mana pun", async ({ page }) => {
  await registerUser(page, userA);

  // A brand new account: every screen is empty, nothing of B leaks through.
  await expect(page.getByText("Belum ada pengeluaran")).toBeVisible();

  for (const path of ["/history", "/journal", "/statistics", "/budget"]) {
    await page.goto(path);
    await expect(page.getByText("SECRETMEMBER")).toHaveCount(0);
    await expect(page.getByText("Rp777.000")).toHaveCount(0);
    await expect(page.getByText("HANYA MILIK B")).toHaveCount(0);
  }

  // B's member must not leak into A's own filter lists. A has no transactions,
  // so seed one of A's own and confirm only A's member is offered.
  await addExpense(page, {
    idol: "TNT",
    member: "ownmember",
    category: "MNG",
    amount: 11_000,
    date: "2026-10-06",
  });

  await page.goto("/history");
  await page.getByLabel("Member", { exact: true }).click();
  await expect(page.getByRole("option", { name: "OWNMEMBER" })).toBeVisible();
  await expect(page.getByRole("option", { name: "SECRETMEMBER" })).toHaveCount(0);
  await page.keyboard.press("Escape");
});

test("user A tidak bisa membuka atau mengedit transaksi user B (404)", async ({ page }) => {
  await login(page, userA.username, userA.password);

  // Direct URL to B's row -> 404, not 403-with-data, not a 500.
  const response = await page.goto(`/expenses/${expenseIdOfB}/edit`);
  expect(response?.status()).toBe(404);
  await expect(page.getByText("Transaksi tidak ditemukan")).toBeVisible();

  // A non-existent id behaves identically (no id enumeration).
  const missing = await page.goto("/expenses/does-not-exist-at-all/edit");
  expect(missing?.status()).toBe(404);
});

test("user A tidak bisa mengakses/mengubah member journal user B", async ({ page }) => {
  await login(page, userA.username, userA.password);

  const response = await page.goto("/journal/SECRETMEMBER");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("Member tidak ditemukan")).toBeVisible();
});

test("user B masih melihat datanya sendiri", async ({ page }) => {
  await login(page, userB.username, userB.password);

  await expect(page.getByText("JKT48 • SECRETMEMBER").first()).toBeVisible();
  await expect(page.getByText("Rp777.000").first()).toBeVisible();

  await page.goto("/journal/SECRETMEMBER");
  await expect(page.getByRole("heading", { name: /SECRETMEMBER — Spending Journal/ })).toBeVisible();
});

test("seed owner account tidak pernah terekspos di halaman login", async ({ page }) => {
  await page.goto("/login");

  // The login page must not contain any credential, the seed password, or a hint.
  const body = await page.locator("body").innerText();
  const seedPassword = process.env.SEED_USER_PASSWORD ?? "";
  expect(body.toLowerCase()).not.toContain("password_hash");
  expect(body.toLowerCase()).not.toContain("seed_user");
  if (seedPassword) expect(body).not.toContain(seedPassword);
  expect(body).not.toContain("$2a$");
  expect(body).not.toContain("$2b$");

  // And nothing credential-shaped in the client bundle either.
  const scripts = await page.locator("script").allInnerTexts();
  const joined = scripts.join("\n");
  expect(joined).not.toContain("password_hash");
  expect(joined).not.toContain("SEED_USER_PASSWORD");
  if (seedPassword) expect(joined).not.toContain(seedPassword);
});
