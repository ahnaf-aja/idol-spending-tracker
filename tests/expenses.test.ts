import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { cleanupTestUsers, createTestUser, prisma, seedExpense } from "./helpers/db";
import {
  createExpense,
  deleteExpense,
  getExpense,
  listExpenses,
  listIdolNames,
  listMemberNames,
  updateExpense,
} from "@/lib/expenses/repository";
import { getProfileStats } from "@/lib/queries";
import { normalizeMemberName } from "@/lib/normalize";
import { addMonths, currentPeriod, getPeriodForDate, previousPeriod, utcToDateOnly } from "@/lib/period";
import { budgetProgress, groupByMember, summarize } from "@/lib/stats";

/**
 * Expense CRUD, member normalisation, ownership isolation and budget tests
 * (requirements 26-34, 39, 49).
 */

beforeEach(async () => {
  await cleanupTestUsers();
});

afterAll(async () => {
  await cleanupTestUsers();
  await prisma.$disconnect();
});

const validInput = (overrides: Record<string, unknown> = {}) => ({
  idolType: "JKT48",
  customIdolName: null,
  memberName: "freya",
  category: "VC",
  amount: 200_000,
  expenseDate: "2026-09-25",
  note: "VC 2 tiket",
  ...overrides,
}) as Parameters<typeof createExpense>[1];

describe("expense CRUD", () => {
  it("create expense menyimpan data dan menormalisasi member", async () => {
    const user = await createTestUser("exp");
    const created = await createExpense(user.id, validInput());

    expect(created.memberName).toBe("FREYA");
    expect(created.amount).toBe(200_000);
    expect(created.expenseDate).toBe("2026-09-25");
    expect(created.note).toBe("VC 2 tiket");
    expect(created.customIdolName).toBeNull();
  });

  it("member 'freya' / 'Freya' / 'fReYa' / '  freya  ' -> satu entri FREYA", async () => {
    const user = await createTestUser("expnorm");
    for (const variant of ["freya", "Freya", "fReYa", "  freya  "]) {
      await createExpense(user.id, validInput({ memberName: variant }));
    }

    const all = await listExpenses(user.id, { range: null });
    expect(all).toHaveLength(4);
    expect(new Set(all.map((e) => e.memberName))).toEqual(new Set(["FREYA"]));

    const members = await listMemberNames(user.id);
    expect(members).toEqual(["FREYA"]);
  });

  it("member kosong disimpan sebagai null, bukan string kosong", async () => {
    const user = await createTestUser("expnull");
    const created = await createExpense(user.id, validInput({ memberName: "   " }));

    expect(created.memberName).toBeNull();
    const row = await prisma.expense.findUnique({ where: { id: created.id } });
    expect(row!.memberName).toBeNull();
    expect(row!.memberName).not.toBe("");
  });

  it("idol OTHER menyimpan nama custom dan menampilkannya di statistik", async () => {
    const user = await createTestUser("expother");
    const created = await createExpense(
      user.id,
      validInput({ idolType: "OTHER", customIdolName: "illit", memberName: "moka" }),
    );

    expect(created.customIdolName).toBe("ILLIT");
    expect(await listIdolNames(user.id)).toEqual(["ILLIT"]);

    const all = await listExpenses(user.id, { range: null });
    const summary = summarize(all);
    expect(summary.byIdol[0].label).toBe("ILLIT");
  });

  it("edit expense mengubah data dan normalisasi tetap jalan", async () => {
    const user = await createTestUser("expedit");
    const created = await createExpense(user.id, validInput());

    const updated = await updateExpense(
      user.id,
      created.id,
      validInput({ memberName: "gracie", amount: 150_000, category: "TWO_SHOT", note: null }),
    );

    expect(updated?.memberName).toBe("GRACIE");
    expect(updated?.amount).toBe(150_000);
    expect(updated?.category).toBe("TWO_SHOT");
    expect(updated?.note).toBeNull();
  });

  it("delete expense menghapus dari database", async () => {
    const user = await createTestUser("expdel");
    const created = await createExpense(user.id, validInput());

    expect(await deleteExpense(user.id, created.id)).toBe(true);
    expect(await getExpense(user.id, created.id)).toBeNull();
    expect(await prisma.expense.count({ where: { userId: user.id } })).toBe(0);
  });

  it("nominal negatif dan nol tidak mungkin masuk lewat repository yang tervalidasi", async () => {
    const user = await createTestUser("expneg");
    const { expenseInputSchema } = await import("@/lib/validation");

    for (const amount of [0, -1, -250_000]) {
      const parsed = expenseInputSchema.safeParse({
        idolType: "JKT48",
        category: "VC",
        amount,
        expenseDate: "2026-09-25",
      });
      expect(parsed.success).toBe(false);
    }
    expect(await prisma.expense.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe("ownership isolation (requirement 39)", () => {
  it("User A tidak bisa membaca transaksi User B", async () => {
    const userA = await createTestUser("ownerA");
    const userB = await createTestUser("ownerB");
    const expenseB = await seedExpense(userB.id, { amount: 500_000 });

    expect(await getExpense(userA.id, expenseB.id)).toBeNull();
    expect(await getExpense(userB.id, expenseB.id)).not.toBeNull();

    const listA = await listExpenses(userA.id, { range: null });
    expect(listA).toHaveLength(0);
  });

  it("User A tidak bisa edit transaksi User B", async () => {
    const userA = await createTestUser("editA");
    const userB = await createTestUser("editB");
    const expenseB = await seedExpense(userB.id, { amount: 500_000 });

    const attempt = await updateExpense(userA.id, expenseB.id, validInput({ amount: 1 }));
    expect(attempt).toBeNull();

    const stillThere = await prisma.expense.findUnique({ where: { id: expenseB.id } });
    expect(stillThere!.amount).toBe(500_000);
  });

  it("User A tidak bisa delete transaksi User B", async () => {
    const userA = await createTestUser("delA");
    const userB = await createTestUser("delB");
    const expenseB = await seedExpense(userB.id);

    expect(await deleteExpense(userA.id, expenseB.id)).toBe(false);
    expect(await prisma.expense.count({ where: { id: expenseB.id } })).toBe(1);
  });

  it("member journal / statistics User A tidak memuat data User B", async () => {
    const userA = await createTestUser("statA");
    const userB = await createTestUser("statB");
    await seedExpense(userB.id, { memberName: "SECRET_MEMBER", amount: 999_000 });
    await seedExpense(userA.id, { memberName: "FREYA", amount: 100_000 });

    const listA = await listExpenses(userA.id, { range: null });
    const summaryA = summarize(listA);
    expect(summaryA.total).toBe(100_000);
    expect(groupByMember(listA).map((m) => m.name)).toEqual(["FREYA"]);

    // The member list of A never contains B's member.
    expect(await listMemberNames(userA.id)).not.toContain("SECRET_MEMBER");
  });

  it("profile stats hanya menghitung transaksi sendiri", async () => {
    const userA = await createTestUser("profA");
    const userB = await createTestUser("profB");
    await seedExpense(userA.id, { amount: 100_000, category: "VC" });
    await seedExpense(userB.id, { amount: 800_000, category: "SHOW" });

    const stats = await getProfileStats(userA.id);
    expect(stats.totalSpent).toBe(100_000);
    expect(stats.totalTransactions).toBe(1);
    expect(stats.mostFrequentCategory?.category).toBe("VC");
  });

  it("menghapus user menghapus seluruh datanya (cascade)", async () => {
    const user = await createTestUser("cascade");
    await seedExpense(user.id);
    await prisma.budget.create({
      data: {
        userId: user.id,
        amount: 1_000_000,
        periodStart: new Date("2026-09-25T00:00:00.000Z"),
        periodEnd: new Date("2026-10-24T00:00:00.000Z"),
      },
    });

    await prisma.user.delete({ where: { id: user.id } });

    expect(await prisma.expense.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.budget.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe("date filter pada query (requirement 21)", () => {
  it("current / previous / custom / all memfilter dengan benar", async () => {
    const user = await createTestUser("filter");
    await seedExpense(user.id, { expenseDate: "2026-09-24", amount: 100_000 }); // periode sebelumnya
    await seedExpense(user.id, { expenseDate: "2026-09-25", amount: 200_000 }); // periode ini
    await seedExpense(user.id, { expenseDate: "2026-10-10", amount: 300_000 }); // periode ini
    await seedExpense(user.id, { expenseDate: "2026-08-01", amount: 400_000 }); // lebih lama

    const current = getPeriodForDate("2026-10-10");
    expect(current).toEqual({ start: "2026-09-25", end: "2026-10-24" });

    const currentRows = await listExpenses(user.id, { range: current, order: "desc" });
    expect(currentRows.map((r) => r.amount)).toEqual([300_000, 200_000]);

    const previousRows = await listExpenses(user.id, { range: previousPeriod(current) });
    expect(previousRows.map((r) => r.amount)).toEqual([100_000]);

    // 25 Sep ikut masuk rentang custom 1-30 Sep, bersama transaksi 24 Sep.
    const customRows = await listExpenses(user.id, { range: { start: "2026-09-01", end: "2026-09-30" } });
    expect(customRows.map((r) => r.amount)).toEqual([200_000, 100_000]);

    const allRows = await listExpenses(user.id, { range: null });
    expect(allRows).toHaveLength(4);
  });

  it("batas periode tepat di tanggal 24 dan 25 tidak tumpang tindih", async () => {
    const user = await createTestUser("bounds");
    await seedExpense(user.id, { expenseDate: "2026-10-24", amount: 1 });
    await seedExpense(user.id, { expenseDate: "2026-10-25", amount: 2 });

    const october = { start: "2026-09-25", end: "2026-10-24" };
    const november = { start: "2026-10-25", end: "2026-11-24" };

    expect((await listExpenses(user.id, { range: october })).map((r) => r.amount)).toEqual([1]);
    expect((await listExpenses(user.id, { range: november })).map((r) => r.amount)).toEqual([2]);
  });

  it("data periode sebelumnya tidak pernah ikut terhapus saat periode berganti", async () => {
    const user = await createTestUser("keep");
    await seedExpense(user.id, { expenseDate: "2026-09-25", amount: 2_000_000 });

    const october = getPeriodForDate("2026-10-24");
    expect((await listExpenses(user.id, { range: october })).reduce((s, r) => s + r.amount, 0)).toBe(2_000_000);

    // Simulate the 25th: the current period is empty...
    const november = getPeriodForDate("2026-10-25");
    expect(await listExpenses(user.id, { range: november })).toHaveLength(0);

    // ...but the old transaction is still in the database.
    expect(await prisma.expense.count({ where: { userId: user.id } })).toBe(1);
  });
});

describe("history filters", () => {
  it("filter idol, member, kategori dan search", async () => {
    const user = await createTestUser("hfilters");
    await seedExpense(user.id, { idolType: "JKT48", memberName: "FREYA", category: "VC", note: "VC 2 tiket" });
    await seedExpense(user.id, { idolType: "TNT", memberName: "GRACIE", category: "SHOW", note: null });
    await seedExpense(user.id, {
      idolType: "OTHER",
      customIdolName: "ILLIT",
      memberName: "MOKA",
      category: "CHEKI",
      note: "cheki 3 tiket",
    });

    expect((await listExpenses(user.id, { idol: "JKT48" })).length).toBe(1);
    expect((await listExpenses(user.id, { member: "GRACIE" })).length).toBe(1);
    expect((await listExpenses(user.id, { category: "CHEKI" })).length).toBe(1);
    expect((await listExpenses(user.id, { idol: "ILLIT" })).length).toBe(1);
    expect((await listExpenses(user.id, { search: "tiket" })).length).toBe(2);
    expect((await listExpenses(user.id, { search: "gracie" })).length).toBe(1);
  });

  it("member dan idol untuk dropdown diambil dari database", async () => {
    const user = await createTestUser("dropdown");
    await seedExpense(user.id, { memberName: "FREYA" });
    await seedExpense(user.id, { memberName: "CHRISTY" });
    await seedExpense(user.id, { memberName: null });
    await seedExpense(user.id, { idolType: "TNT" });

    expect(await listMemberNames(user.id)).toEqual(["CHRISTY", "FREYA"]);
    expect(await listIdolNames(user.id)).toEqual(["JKT48", "TNT"]);
  });
});

describe("member journal dari database", () => {
  it("total, jumlah, dan last transaction benar", async () => {
    const user = await createTestUser("journal");
    await seedExpense(user.id, { memberName: "FREYA", amount: 200_000, expenseDate: "2026-09-25" });
    await seedExpense(user.id, { memberName: "FREYA", amount: 150_000, expenseDate: "2026-09-18" });
    await seedExpense(user.id, { memberName: "GRACIE", amount: 500_000, expenseDate: "2026-09-10" });
    await seedExpense(user.id, { memberName: null, amount: 120_000 });

    const members = groupByMember(await listExpenses(user.id, { range: null }));
    expect(members.map((m) => m.name)).toEqual(["GRACIE", "FREYA"]);
    const freya = members.find((m) => m.name === "FREYA")!;
    expect(freya.amount).toBe(350_000);
    expect(freya.count).toBe(2);
    expect(freya.lastDate).toBe("2026-09-25");
    expect(freya.average).toBe(175_000);
  });

  it("'freya' dari input berbeda tidak menciptakan dua entri journal", async () => {
    const user = await createTestUser("journalnorm");
    for (const variant of ["freya", "Freya", "FREYA", "fReYa"]) {
      await seedExpense(user.id, { memberName: normalizeMemberName(variant) });
    }
    const members = groupByMember(await listExpenses(user.id, { range: null }));
    expect(members).toHaveLength(1);
    expect(members[0].count).toBe(4);
  });
});

describe("budget (requirement 34 & 49)", () => {
  it("budget per periode disimpan dan dihitung benar", async () => {
    const user = await createTestUser("budget");
    const period = getPeriodForDate("2026-10-10");

    await prisma.budget.create({
      data: {
        userId: user.id,
        amount: 2_000_000,
        periodStart: new Date(`${period.start}T00:00:00.000Z`),
        periodEnd: new Date(`${period.end}T00:00:00.000Z`),
      },
    });

    await seedExpense(user.id, { amount: 1_500_000, expenseDate: "2026-10-01" });

    const spent = (await listExpenses(user.id, { range: period })).reduce((s, r) => s + r.amount, 0);
    const budget = await prisma.budget.findUnique({
      where: { userId_periodStart: { userId: user.id, periodStart: new Date(`${period.start}T00:00:00.000Z`) } },
    });

    const progress = budgetProgress(budget!.amount, spent);
    expect(progress.remaining).toBe(500_000);
    expect(progress.percent).toBe(75);
    expect(progress.isOver).toBe(false);
  });

  it("over budget terdeteksi, transaksi baru tetap boleh dicatat", async () => {
    const user = await createTestUser("overbudget");
    const period = currentPeriod();

    await prisma.budget.create({
      data: {
        userId: user.id,
        amount: 1_000_000,
        periodStart: new Date(`${period.start}T00:00:00.000Z`),
        periodEnd: new Date(`${period.end}T00:00:00.000Z`),
      },
    });

    // Spend past the budget and then add one more transaction.
    await seedExpense(user.id, { amount: 2_250_000, expenseDate: period.start });
    const extra = await createExpense(user.id, validInput({ amount: 50_000, expenseDate: period.start }));

    expect(extra.amount).toBe(50_000);
    const spent = (await listExpenses(user.id, { range: period })).reduce((s, r) => s + r.amount, 0);
    const progress = budgetProgress(1_000_000, spent);
    expect(progress.isOver).toBe(true);
    expect(progress.over).toBe(1_300_000);
  });

  it("satu budget per user per periode (unique constraint)", async () => {
    const user = await createTestUser("budgetunique");
    const period = getPeriodForDate("2026-10-10");
    const data = {
      userId: user.id,
      amount: 1_000_000,
      periodStart: new Date(`${period.start}T00:00:00.000Z`),
      periodEnd: new Date(`${period.end}T00:00:00.000Z`),
    };
    await prisma.budget.create({ data });
    await expect(prisma.budget.create({ data })).rejects.toThrow();
  });
});

describe("penyimpanan tanggal", () => {
  it("expense_date tersimpan sebagai UTC midnight dan dibaca kembali sama", async () => {
    const user = await createTestUser("dates");
    const created = await createExpense(user.id, validInput({ expenseDate: "2026-09-25" }));

    const row = await prisma.expense.findUnique({ where: { id: created.id } });
    expect(row!.expenseDate.toISOString()).toBe("2026-09-25T00:00:00.000Z");
    expect(utcToDateOnly(row!.expenseDate)).toBe("2026-09-25");
    expect(created.expenseDate).toBe("2026-09-25");
  });

  it("transaksi akhir bulan tidak bergeser tanggal", async () => {
    const user = await createTestUser("monthEnd");
    for (const date of ["2026-01-31", "2026-12-31", "2027-02-28"]) {
      const created = await createExpense(user.id, validInput({ expenseDate: date }));
      expect(created.expenseDate).toBe(date);
      const row = await prisma.expense.findUnique({ where: { id: created.id } });
      expect(utcToDateOnly(row!.expenseDate)).toBe(date);
    }
  });
});

describe("periode berganti tidak menghapus data (requirement 10)", () => {
  it("total periode ini nol setelah tanggal 25, data lama tetap ada di history", async () => {
    const user = await createTestUser("reset");
    const september = getPeriodForDate("2026-10-24");
    await seedExpense(user.id, { amount: 2_000_000, expenseDate: "2026-10-10" });

    const spendIn = async (period: { start: string; end: string }) =>
      (await listExpenses(user.id, { range: period })).reduce((s, r) => s + r.amount, 0);

    expect(await spendIn(september)).toBe(2_000_000);

    const afterReset = getPeriodForDate("2026-10-25");
    expect(await spendIn(afterReset)).toBe(0);
    expect(await spendIn(september)).toBe(2_000_000); // still queryable

    const allTime = await listExpenses(user.id, { range: null });
    expect(allTime).toHaveLength(1);
    expect(allTime[0].amount).toBe(2_000_000);
  });

  it("navigasi periode mundur tetap menemukan data lama", async () => {
    const user = await createTestUser("backnav");
    await seedExpense(user.id, { amount: 980_000, expenseDate: "2026-08-01" });

    let period = getPeriodForDate("2026-10-10");
    let found = 0;
    for (let i = 0; i < 6; i += 1) {
      const rows = await listExpenses(user.id, { range: period });
      found += rows.length;
      period = { start: addMonths(period.start, -1), end: addMonths(period.end, -1) };
    }
    expect(found).toBe(1);
  });
});

/**
 * Requirement 46: a duplicated form submission must never double-book an
 * expense. Real-world cause reproduced in the browser: one user click produced
 * two INSERTs ~300ms apart through a single POST.
 */
describe("idempotent create (requirement 46)", () => {
  it("replayed submission dengan clientToken sama hanya membuat satu baris", async () => {
    const user = await createTestUser("idem");
    const input = validInput({ clientToken: "submit-abc-123" });

    const first = await createExpense(user.id, input);
    const second = await createExpense(user.id, input);

    expect(second.id).toBe(first.id);

    const rows = await listExpenses(user.id, { range: null });
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(200_000);
  });

  it("dua submission paralel dengan token sama tetap satu baris (race)", async () => {
    const user = await createTestUser("idemrace");
    const input = validInput({ clientToken: "submit-race-999" });

    // Fire them together: this is what a double-click looks like server-side.
    const results = await Promise.all([
      createExpense(user.id, input),
      createExpense(user.id, input),
    ]);

    expect(results[0].id).toBe(results[1].id);
    expect(await listExpenses(user.id, { range: null })).toHaveLength(1);
  });

  it("clientToken berbeda tetap membuat transaksi terpisah", async () => {
    const user = await createTestUser("idem2");
    await createExpense(user.id, validInput({ clientToken: "submit-1" }));
    await createExpense(user.id, validInput({ clientToken: "submit-2" }));

    expect(await listExpenses(user.id, { range: null })).toHaveLength(2);
  });

  it("dua transaksi identik tanpa clientToken tidak saling memblokir", async () => {
    // Rows created outside the form (seeds, imports) carry no key and must all
    // survive, since Postgres treats NULLs as distinct in a unique index.
    const user = await createTestUser("idemnull");
    await createExpense(user.id, validInput({ note: "Shopee checkout" }));
    await createExpense(user.id, validInput({ note: "Shopee checkout" }));

    expect(await listExpenses(user.id, { range: null })).toHaveLength(2);
  });

  it("clientToken satu user tidak memblokir user lain", async () => {
    const a = await createTestUser("idema");
    const b = await createTestUser("idemb");
    const input = validInput({ clientToken: "submit-shared" });

    const rowA = await createExpense(a.id, input);
    const rowB = await createExpense(b.id, input);

    expect(rowA.id).not.toBe(rowB.id);
    expect(await listExpenses(a.id, { range: null })).toHaveLength(1);
    expect(await listExpenses(b.id, { range: null })).toHaveLength(1);
  });
});
