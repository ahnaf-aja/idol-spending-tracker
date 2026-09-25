import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "./fixtures";

import { attemptLogin, fillByLabel, login, registerUser } from "./helpers";

/**
 * Requirement 51: forgot password -> reset link -> reset -> old password dead,
 * new password works.
 *
 * The dev outbox (.dev-outbox/) is where the mail lands when no SMTP is
 * configured. Only the server and the developer can read it - the token never
 * reaches the browser through an API response.
 */

const OUTBOX = path.join(process.cwd(), ".dev-outbox");

const user = {
  username: `e2e_reset_${Math.random().toString(36).slice(2, 8)}`,
  email: `e2e_reset_${Math.random().toString(36).slice(2, 8)}@example.test`,
  password: "OldPassword123",
  newPassword: "BrandNewPassword456",
};

/** Reads the newest outbox mail addressed to `to` and extracts the reset token. */
async function readResetToken(to: string, since = Date.now() - 120_000): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const files = await readdir(OUTBOX).catch(() => [] as string[]);
    const candidates = files
      .filter((name) => name.includes(to.replace(/[^a-z0-9@._-]/gi, "_")))
      .sort()
      .reverse();

    for (const name of candidates) {
      const full = path.join(OUTBOX, name);
      const stat = await import("node:fs/promises").then((fs) => fs.stat(full));
      if (stat.mtimeMs < since) continue;
      const content = await readFile(full, "utf8");
      const match = content.match(/\/reset-password\?token=([A-Za-z0-9_\-%]+)/);
      if (match) return decodeURIComponent(match[1]);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`tidak menemukan link reset di outbox untuk ${to}`);
}

test.describe.configure({ mode: "serial" });

test("forgot password selalu memberi jawaban generik", async ({ page }) => {
  await registerUser(page, user);
  await page.getByRole("button", { name: "Logout" }).first().click();
  await page.waitForURL(/\/login/);

  await page.getByRole("link", { name: "Forgot Password?" }).click();
  await page.waitForURL(/\/forgot-password/);

  // Unknown email...
  await fillByLabel(page, "Email", "tidak-terdaftar@example.test");
  await page.getByRole("button", { name: "Send Reset Link" }).click();
  await expect(
    page.getByText("Jika email tersebut terdaftar, kami telah mengirimkan link reset password."),
  ).toBeVisible();

  // The form is replaced by the generic confirmation, so revisit to test again.
  await page.goto("/forgot-password");
  await fillByLabel(page, "Email", user.email);
  await page.getByRole("button", { name: "Send Reset Link" }).click();

  // ...a real one gives byte-identical wording: no account enumeration.
  await expect(
    page.getByText("Jika email tersebut terdaftar, kami telah mengirimkan link reset password."),
  ).toBeVisible();
});

test("reset link mengubah password, lalu token mati", async ({ page }) => {
  const token = await readResetToken(user.email);

  // Invalid token is rejected outright.
  await page.goto("/reset-password?token=token-palsu-yang-tidak-ada");
  await fillByLabel(page, "New Password", user.newPassword);
  await fillByLabel(page, "Confirm New Password", user.newPassword);
  await page.getByRole("button", { name: "Reset Password" }).click();
  await expect(page.getByText("Link reset password tidak valid.")).toBeVisible();

  // Valid token works.
  await page.goto(`/reset-password?token=${encodeURIComponent(token)}`);
  await fillByLabel(page, "New Password", user.newPassword);
  await fillByLabel(page, "Confirm New Password", user.newPassword);
  await page.getByRole("button", { name: "Reset Password" }).click();
  await page.waitForURL(/\/login\?reset=success/, { timeout: 30_000 });
  await expect(page.getByText("Password berhasil diubah. Silakan login kembali.")).toBeVisible();

  // Old password no longer works.
  await attemptLogin(page, user.email, user.password);
  await expect(page.getByText("Username/email atau password salah.")).toBeVisible();

  // New password works.
  await login(page, user.email, user.newPassword);
  await expect(page).toHaveURL(/\/dashboard/);

  // Single use: the same link cannot be replayed.
  await page.goto("/reset-password?token=" + encodeURIComponent(token));
  await fillByLabel(page, "New Password", "AnotherPassword789");
  await fillByLabel(page, "Confirm New Password", "AnotherPassword789");
  await page.getByRole("button", { name: "Reset Password" }).click();
  await expect(
    page.getByText(/Link reset password sudah pernah digunakan|tidak bisa digunakan lagi/),
  ).toBeVisible();
});

test("reset password tidak pernah membocorkan token atau hash ke browser", async ({ page }) => {
  await page.goto("/forgot-password");
  const html = await page.content();
  expect(html).not.toMatch(/token_hash/);
  expect(html).not.toMatch(/password_hash/);

  // And the reset page itself carries no server secret in its payload.
  await page.goto("/reset-password?token=abc123");
  const html2 = await page.content();
  expect(html2).not.toMatch(/DATABASE_URL/);
  expect(html2).not.toMatch(/password_hash/);
});
