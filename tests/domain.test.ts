import { describe, expect, it } from "vitest";

import {
  normalizeEmail,
  normalizeMemberName,
  normalizeNote,
  normalizeUsername,
} from "@/lib/normalize";
import { formatIDR, formatIDRCompact, formatIDRDigits, parseIDRInput } from "@/lib/currency";
import { idolDisplayName, isExpenseCategory, isIdolType } from "@/lib/categories";
import { budgetProgress, groupByMember, groupByPeriod, summarize } from "@/lib/stats";
import { expenseInputSchema, loginSchema, registerSchema, resetPasswordSchema } from "@/lib/validation";
import { getPeriodForDate } from "@/lib/period";

describe("member normalization (requirement 13 & 33)", () => {
  it("freya / Freya / fReYa / '  freya  ' -> FREYA", () => {
    expect(normalizeMemberName("freya")).toBe("FREYA");
    expect(normalizeMemberName("Freya")).toBe("FREYA");
    expect(normalizeMemberName("fReYa")).toBe("FREYA");
    expect(normalizeMemberName("  freya  ")).toBe("FREYA");
    expect(normalizeMemberName("f r e y a")).toBe("F R E Y A".replace(/ /g, " "));
  });

  it("spasi berlebih di tengah dirapikan", () => {
    expect(normalizeMemberName("  grace   christy ")).toBe("GRACE CHRISTY");
  });

  it("kosong -> null, bukan string kosong", () => {
    expect(normalizeMemberName("")).toBeNull();
    expect(normalizeMemberName("   ")).toBeNull();
    expect(normalizeMemberName(null)).toBeNull();
    expect(normalizeMemberName(undefined)).toBeNull();
    expect(normalizeMemberName(123)).toBeNull();
  });

  it("semua variasi menghasilkan satu nama yang sama", () => {
    const variants = ["freya", "Freya", "FREYA", "fReYa", "  Freya "];
    const unique = new Set(variants.map((v) => normalizeMemberName(v)));
    expect(unique.size).toBe(1);
    expect([...unique][0]).toBe("FREYA");
  });
});

describe("normalisasi teks lain", () => {
  it("username: lowercase tanpa spasi", () => {
    expect(normalizeUsername("  NafAja ")).toBe("nafaja");
    expect(normalizeUsername("")).toBeNull();
  });

  it("email: lowercase + trim", () => {
    expect(normalizeEmail("  NAF@Example.COM ")).toBe("naf@example.com");
  });

  it("note: trim, kosong jadi null, case dipertahankan", () => {
    expect(normalizeNote("  VC 2 tiket ")).toBe("VC 2 tiket");
    expect(normalizeNote("   ")).toBeNull();
    expect(normalizeNote("x".repeat(600))?.length).toBe(500);
  });
});

describe("idol display name (requirement 23)", () => {
  it("OTHER menampilkan nama custom, bukan 'Other'", () => {
    expect(idolDisplayName({ idolType: "OTHER", customIdolName: "ILLIT" })).toBe("ILLIT");
  });

  it("JKT48 / TNT tampil apa adanya", () => {
    expect(idolDisplayName({ idolType: "JKT48" })).toBe("JKT48");
    expect(idolDisplayName({ idolType: "TNT" })).toBe("TNT");
  });

  it("OTHER tanpa nama custom tetap masuk akal", () => {
    expect(idolDisplayName({ idolType: "OTHER", customIdolName: null })).toBe("Other");
  });
});

describe("currency (requirement 15 & 47)", () => {
  it("formatIDR memakai pemisah ribuan id-ID", () => {
    expect(formatIDR(10_000)).toBe("Rp10.000");
    expect(formatIDR(150_000)).toBe("Rp150.000");
    expect(formatIDR(1_500_000)).toBe("Rp1.500.000");
    expect(formatIDR(10_500_000)).toBe("Rp10.500.000");
    expect(formatIDR(0)).toBe("Rp0");
  });

  it("tidak pernah menampilkan Rp150000 tanpa pemisah", () => {
    expect(formatIDR(150_000)).not.toBe("Rp150000");
    expect(formatIDR(150_000)).toContain(".");
  });

  it("parseIDRInput menerima berbagai format umum", () => {
    expect(parseIDRInput("150000")).toBe(150_000);
    expect(parseIDRInput("150.000")).toBe(150_000);
    expect(parseIDRInput("1.250.000")).toBe(1_250_000);
    expect(parseIDRInput("Rp 150 000")).toBe(150_000);
    expect(parseIDRInput("")).toBe(0);
    expect(parseIDRInput("abc")).toBe(0);
  });

  it("formatIDRDigits untuk input", () => {
    expect(formatIDRDigits(1_250_000)).toBe("1.250.000");
    expect(formatIDRDigits(0)).toBe("");
  });

  it("formatIDRCompact untuk label chart", () => {
    expect(formatIDRCompact(1_500_000)).toBe("Rp1,5jt");
    expect(formatIDRCompact(450_000)).toBe("Rp450rb");
  });
});

describe("taxonomy guards", () => {
  it("hanya kategori & idol yang dikenal diterima", () => {
    expect(isExpenseCategory("VC")).toBe(true);
    expect(isExpenseCategory("TWO_SHOT")).toBe(true);
    expect(isExpenseCategory("SHOW")).toBe(true);
    expect(isExpenseCategory("other")).toBe(false);
    expect(isIdolType("JKT48")).toBe(true);
    expect(isIdolType("OTHER")).toBe(true);
    expect(isIdolType("jkt48")).toBe(false);
  });
});

describe("validation schemas (requirement 40)", () => {
  it("register menolak password < 8 karakter dan konfirmasi berbeda", () => {
    const short = registerSchema.safeParse({
      username: "nafaja",
      email: "a@b.com",
      password: "1234567",
      confirmPassword: "1234567",
    });
    expect(short.success).toBe(false);

    const mismatch = registerSchema.safeParse({
      username: "nafaja",
      email: "a@b.com",
      password: "12345678",
      confirmPassword: "12345679",
    });
    expect(mismatch.success).toBe(false);
  });

  it("register menolak email tidak valid", () => {
    expect(
      registerSchema.safeParse({
        username: "nafaja",
        email: "bukan-email",
        password: "12345678",
        confirmPassword: "12345678",
      }).success,
    ).toBe(false);
  });

  it("register menormalisasi username dan email", () => {
    const parsed = registerSchema.parse({
      username: "  NaFaJa ",
      email: "NAF@Example.COM",
      password: "12345678",
      confirmPassword: "12345678",
    });
    expect(parsed.username).toBe("nafaja");
    expect(parsed.email).toBe("naf@example.com");
  });

  it("nominal negatif dan nol ditolak", () => {
    const base = {
      idolType: "JKT48",
      category: "VC",
      expenseDate: "2026-09-25",
    };
    expect(expenseInputSchema.safeParse({ ...base, amount: -1000 }).success).toBe(false);
    expect(expenseInputSchema.safeParse({ ...base, amount: 0 }).success).toBe(false);
    expect(expenseInputSchema.safeParse({ ...base, amount: 1000 }).success).toBe(true);
    // Jalur form (string dari browser) mengikuti aturan yang sama.
    expect(expenseInputSchema.safeParse({ ...base, amount: "150000" }).success).toBe(true);
    expect(expenseInputSchema.safeParse({ ...base, amount: "1.250.000" }).success).toBe(true);
    expect(expenseInputSchema.safeParse({ ...base, amount: "" }).success).toBe(false);
    expect(expenseInputSchema.safeParse({ ...base, amount: "abc" }).success).toBe(false);
    expect(expenseInputSchema.safeParse({ ...base, amount: "0" }).success).toBe(false);
    expect(expenseInputSchema.safeParse({ ...base, amount: "-5000" }).success).toBe(false);
    expect(expenseInputSchema.parse({ ...base, amount: "1.250.000" }).amount).toBe(1_250_000);
  });

  it("idol OTHER wajib punya nama custom", () => {
    const invalid = expenseInputSchema.safeParse({
      idolType: "OTHER",
      customIdolName: "  ",
      category: "VC",
      amount: 10_000,
      expenseDate: "2026-09-25",
    });
    expect(invalid.success).toBe(false);

    const valid = expenseInputSchema.safeParse({
      idolType: "OTHER",
      customIdolName: "ILLIT",
      category: "VC",
      amount: 10_000,
      expenseDate: "2026-09-25",
    });
    expect(valid.success).toBe(true);
  });

  it("tanggal transaksi harus format YYYY-MM-DD", () => {
    expect(
      expenseInputSchema.safeParse({
        idolType: "JKT48",
        category: "VC",
        amount: 10_000,
        expenseDate: "25-09-2026",
      }).success,
    ).toBe(false);
  });

  it("login butuh identifier dan password", () => {
    expect(loginSchema.safeParse({ identifier: "", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ identifier: "nafaja", password: "x" }).success).toBe(true);
  });

  it("reset password butuh konfirmasi yang sama", () => {
    expect(
      resetPasswordSchema.safeParse({ token: "t", password: "12345678", confirmPassword: "12345679" }).success,
    ).toBe(false);
  });
});

describe("statistics aggregation (requirement 19 & 22-24)", () => {
  const expenses = [
    { id: "1", idolType: "JKT48", memberName: "FREYA", category: "VC", amount: 200_000, expenseDate: "2026-09-25" },
    { id: "2", idolType: "JKT48", memberName: "GRACIE", category: "TWO_SHOT", amount: 150_000, expenseDate: "2026-09-23" },
    { id: "3", idolType: "JKT48", memberName: null, category: "SHOW", amount: 120_000, expenseDate: "2026-09-20" },
    { id: "4", idolType: "OTHER", customIdolName: "ILLIT", memberName: "FREYA", category: "VC", amount: 60_000, expenseDate: "2026-10-01" },
  ];

  it("total, jumlah, terbesar, rata-rata", () => {
    const summary = summarize(expenses);
    expect(summary.total).toBe(530_000);
    expect(summary.count).toBe(4);
    expect(summary.largest).toBe(200_000);
    expect(summary.average).toBe(132_500);
  });

  it("transaksi tanpa member masuk ke NO MEMBER dan bukan top member", () => {
    const summary = summarize([
      { id: "x", idolType: "JKT48", memberName: null, category: "SHOW", amount: 500_000, expenseDate: "2026-09-20" },
      { id: "y", idolType: "JKT48", memberName: "FREYA", category: "VC", amount: 100_000, expenseDate: "2026-09-21" },
    ]);
    expect(summary.byMember.find((s) => s.key === "NO MEMBER")?.amount).toBe(500_000);
    expect(summary.topMember?.label).toBe("FREYA");
  });

  it("idol custom muncul dengan namanya, bukan 'Other'", () => {
    const summary = summarize(expenses);
    expect(summary.byIdol.map((s) => s.label)).toContain("ILLIT");
    expect(summary.byIdol.map((s) => s.label)).not.toContain("Other");
  });

  it("kategori terbesar = VC", () => {
    expect(summarize(expenses).topCategory?.label).toBe("VC");
  });

  it("spending over time urut kronologis", () => {
    const overTime = summarize(expenses).overTime;
    expect(overTime.map((p) => p.date)).toEqual(["2026-09-20", "2026-09-23", "2026-09-25", "2026-10-01"]);
  });

  it("persentase share dihitung benar", () => {
    const summary = summarize(expenses);
    const vc = summary.byCategory.find((s) => s.key === "VC")!;
    expect(vc.amount).toBe(260_000);
    expect(vc.share).toBeCloseTo(260_000 / 530_000, 6);
  });
});

describe("groupByPeriod (requirement 30)", () => {
  it("mengelompokkan transaksi ke periode 25-24, terbaru dulu", () => {
    const grouped = groupByPeriod(
      [
        { id: "a", idolType: "JKT48", memberName: "FREYA", category: "VC", amount: 100, expenseDate: "2026-09-25" },
        { id: "b", idolType: "JKT48", memberName: "FREYA", category: "VC", amount: 200, expenseDate: "2026-10-10" },
        { id: "c", idolType: "JKT48", memberName: "FREYA", category: "VC", amount: 50, expenseDate: "2026-09-24" },
      ],
      getPeriodForDate,
    );

    expect(grouped).toHaveLength(2);
    expect(grouped[0].start).toBe("2026-09-25");
    expect(grouped[0].end).toBe("2026-10-24");
    expect(grouped[0].total).toBe(300);
    expect(grouped[0].count).toBe(2);
    expect(grouped[1].start).toBe("2026-08-25");
    expect(grouped[1].total).toBe(50);
  });
});

describe("groupByMember (requirement 31)", () => {
  it("mengabaikan transaksi tanpa member dan menghitung statistik", () => {
    const members = groupByMember([
      { id: "1", idolType: "JKT48", memberName: "FREYA", category: "VC", amount: 200_000, expenseDate: "2026-09-25" },
      { id: "2", idolType: "JKT48", memberName: "FREYA", category: "2S", amount: 100_000, expenseDate: "2026-09-20" },
      { id: "3", idolType: "JKT48", memberName: null, category: "SHOW", amount: 900_000, expenseDate: "2026-09-20" },
    ]);

    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({
      name: "FREYA",
      amount: 300_000,
      count: 2,
      largest: 200_000,
      average: 150_000,
      lastDate: "2026-09-25",
      firstDate: "2026-09-20",
    });
  });
});

describe("budgetProgress (requirement 34)", () => {
  it("remaining dan progress benar di bawah budget", () => {
    const progress = budgetProgress(2_000_000, 1_500_000);
    expect(progress.remaining).toBe(500_000);
    expect(progress.over).toBe(0);
    expect(progress.percent).toBe(75);
    expect(progress.isOver).toBe(false);
  });

  it("over budget benar", () => {
    const progress = budgetProgress(2_000_000, 2_250_000);
    expect(progress.over).toBe(250_000);
    expect(progress.remaining).toBe(0);
    expect(progress.isOver).toBe(true);
    expect(progress.percent).toBeCloseTo(112.5, 3);
  });

  it("tanpa budget tidak membagi nol", () => {
    const progress = budgetProgress(null, 500_000);
    expect(progress.hasBudget).toBe(false);
    expect(progress.percent).toBe(0);
    expect(progress.isOver).toBe(false);
  });

  it("tepat di budget bukan over", () => {
    expect(budgetProgress(1_000_000, 1_000_000).isOver).toBe(false);
  });
});
