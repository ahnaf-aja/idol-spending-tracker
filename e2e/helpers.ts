import { expect, type Page } from "@playwright/test";

/** Unique per-run user so repeated runs never collide. */
export const runId = Math.random().toString(36).slice(2, 10);

export const e2eUser = {
  username: `e2e_${runId}`,
  email: `e2e_${runId}@example.test`,
  password: "E2ePassword123",
  newPassword: "E2ePassword456",
};

export type TestUser = typeof e2eUser;

/**
 * React 19 renders `<form action={serverAction}>` server-side with a sentinel
 * `action` attribute and only swaps in the real handler once hydrated. Clicking
 * submit before that happens does nothing useful, so every helper waits it out.
 */
export async function waitForHydration(page: Page) {
  await page
    .waitForFunction(
      () =>
        document.readyState === "complete" &&
        !document.querySelector('form[action*="React form unexpectedly submitted"]'),
      null,
      { timeout: 30_000 },
    )
    .catch(() => {
      /* best effort: hydrate may already be past the sentinel */
    });
}

/**
 * Fills the field by its label. The auth forms echo rejected values back into
 * `defaultValue`, so `fill` replaces them cleanly.
 */
export async function fillByLabel(page: Page, label: string | RegExp, value: string) {
  const field = page.getByLabel(label, { exact: false }).first();
  await field.waitFor({ state: "visible" });
  await field.fill(value);
}

/** Registers a brand new account and lands on /dashboard. */
export async function registerUser(page: Page, user: TestUser = e2eUser) {
  await page.goto("/register");
  await waitForHydration(page);
  await fillByLabel(page, "Username", user.username);
  await fillByLabel(page, "Email", user.email);
  await fillByLabel(page, "Password", user.password);
  await fillByLabel(page, "Confirm Password", user.password);
  await page.getByRole("button", { name: "Daftar" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

/** Logs in and waits for the session to land on /dashboard. */
export async function login(page: Page, identifier: string, password: string) {
  await page.goto("/login");
  await waitForHydration(page);
  await fillByLabel(page, "Username / Email", identifier);
  await fillByLabel(page, "Password", password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

/** Logs in expecting failure; returns once the error alert is on screen. */
export async function attemptLogin(page: Page, identifier: string, password: string) {
  await page.goto("/login");
  await waitForHydration(page);
  await fillByLabel(page, "Username / Email", identifier);
  await fillByLabel(page, "Password", password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
}

/** Waits for a specific wizard step to be on screen (steps are all mounted). */
async function expectStep(page: Page, title: string) {
  await expect(page.getByTestId("step-title")).toHaveText(title);
}

/**
 * Walks the Add Expense wizard (7 steps). `member` is typed exactly as given so
 * the normalisation assertions are meaningful.
 */
export async function addExpense(
  page: Page,
  opts: {
    idol?: "JKT48" | "TNT" | "Other";
    customIdol?: string;
    member?: string;
    category?: string;
    amount: number;
    date?: string;
    note?: string;
  },
) {
  await page.goto("/expenses/new");
  await waitForHydration(page);
  await expectStep(page, "Pilih Idol / Group");

  // Step 1: idol
  await page.getByRole("radio", { name: new RegExp(`^${opts.idol ?? "JKT48"}`) }).click();
  if ((opts.idol ?? "JKT48") === "Other" && opts.customIdol) {
    await page.getByLabel("Nama Idol / Group").fill(opts.customIdol);
  }
  await page.getByRole("button", { name: "Lanjut" }).click();

  // Step 2: member (optional)
  await expectStep(page, "Nama Member (opsional)");
  if (opts.member) await page.getByLabel("Nama Member").fill(opts.member);
  await page.getByRole("button", { name: "Lanjut" }).click();

  // Step 3: category
  await expectStep(page, "Jenis Pengeluaran");
  const categoryLabel = opts.category ?? "VC";
  await page.getByRole("radio", { name: categoryLabel, exact: true }).click();
  await page.getByRole("button", { name: "Lanjut" }).click();

  // Step 4: amount
  await expectStep(page, "Jumlah Pengeluaran");
  await page.getByLabel("Jumlah Pengeluaran").fill(String(opts.amount));
  await page.getByRole("button", { name: "Lanjut" }).click();

  // Step 5: date
  await expectStep(page, "Tanggal Transaksi");
  if (opts.date) {
    await page.locator("#expense-date-native").fill(opts.date);
  }
  await page.getByRole("button", { name: "Lanjut" }).click();

  // Step 6: note
  await expectStep(page, "Catatan (opsional)");
  if (opts.note) await page.getByLabel("Catatan").fill(opts.note);
  await page.getByRole("button", { name: "Lanjut" }).click();

  // Step 7: confirm
  await expectStep(page, "Konfirmasi");
  // The submit button swaps to its loading state and the wizard then unmounts on
  // navigation, so Playwright can report this click as "element detached" even
  // though the action fired. Assert on the destination instead - a click that
  // genuinely never happened still fails the waitForURL below.
  await page
    .getByRole("button", { name: "Simpan Pengeluaran" })
    .click({ timeout: 15_000 })
    .catch(() => {});
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

/** Deletes every transaction currently listed on the history page. */
export async function deleteAllExpenses(page: Page) {
  await page.goto("/history");
  for (let guard = 0; guard < 40; guard += 1) {
    const deleteButtons = page.getByRole("button", { name: "Hapus transaksi" });
    const count = await deleteButtons.count();
    if (count === 0) break;
    await deleteButtons.first().click();
    await page.getByRole("button", { name: "Hapus", exact: true }).last().click();
    await page.waitForTimeout(600);
  }
}
