import { describe, expect, it } from "vitest";

import {
  addDays,
  addMonths,
  currentPeriod,
  dateOnlyToUTC,
  eachPeriod,
  formatDateLong,
  formatDateShort,
  formatPeriodLabel,
  formatRangeLabel,
  getPeriodForDate,
  isDateOnly,
  nextPeriod,
  percentChange,
  previousPeriod,
  rangeLengthInDays,
  resolveRange,
  utcToDateOnly,
  todayDateOnly,
} from "@/lib/period";

/**
 * Period engine tests (requirement 9 & 49). The 25..24 rule is the single most
 * important piece of business logic in the app.
 */

describe("getPeriodForDate - aturan tanggal 25 s/d 24", () => {
  const cases: [string, string, string][] = [
    // date, expected start, expected end
    ["2026-10-10", "2026-09-25", "2026-10-24"],
    ["2026-10-24", "2026-09-25", "2026-10-24"],
    ["2026-10-25", "2026-10-25", "2026-11-24"],
    ["2026-11-01", "2026-10-25", "2026-11-24"],
    ["2026-11-24", "2026-10-25", "2026-11-24"],
    ["2026-11-25", "2026-11-25", "2026-12-24"],
    ["2026-09-25", "2026-09-25", "2026-10-24"],
    ["2026-09-24", "2026-08-25", "2026-09-24"],
  ];

  for (const [date, start, end] of cases) {
    it(`${date} -> ${start} .. ${end}`, () => {
      const period = getPeriodForDate(date);
      expect(period.start).toBe(start);
      expect(period.end).toBe(end);
    });
  }

  it("25 Des 2026 -> 25 Des 2026 - 24 Jan 2027 (lintas tahun)", () => {
    const period = getPeriodForDate("2026-12-25");
    expect(period.start).toBe("2026-12-25");
    expect(period.end).toBe("2027-01-24");
  });

  it("1 Jan 2027 masih di periode 25 Des 2026", () => {
    const period = getPeriodForDate("2027-01-01");
    expect(period.start).toBe("2026-12-25");
    expect(period.end).toBe("2027-01-24");
  });

  it("24 Des 2026 masih di periode 25 Nov - 24 Des", () => {
    const period = getPeriodForDate("2026-12-24");
    expect(period.start).toBe("2026-11-25");
    expect(period.end).toBe("2026-12-24");
  });

  it("Februari pendek: 25 Feb 2027 -> 24 Mar 2027", () => {
    expect(getPeriodForDate("2027-02-26")).toEqual({ start: "2027-02-25", end: "2027-03-24" });
  });
});

describe("navigasi periode", () => {
  it("previousPeriod dan nextPeriod bergerak satu bulan", () => {
    const period = getPeriodForDate("2026-10-10"); // 25 Sep .. 24 Okt
    expect(previousPeriod(period)).toEqual({ start: "2026-08-25", end: "2026-09-24" });
    expect(nextPeriod(period)).toEqual({ start: "2026-10-25", end: "2026-11-24" });
  });

  it("kembali ke awal saat lintas tahun", () => {
    const period = getPeriodForDate("2026-12-25"); // 25 Des .. 24 Jan
    expect(previousPeriod(period)).toEqual({ start: "2026-11-25", end: "2026-12-24" });
    expect(nextPeriod(period)).toEqual({ start: "2027-01-25", end: "2027-02-24" });
  });

  it("eachPeriod menghasilkan urutan periode yang benar", () => {
    const start = getPeriodForDate("2026-08-25");
    const end = getPeriodForDate("2026-10-25");
    expect(eachPeriod(start, end).map((p) => p.start)).toEqual([
      "2026-08-25",
      "2026-09-25",
      "2026-10-25",
    ]);
  });
});

describe("tanggal sebagai calendar date (tidak bergeser karena UTC)", () => {
  it("dateOnlyToUTC selalu UTC midnight", () => {
    const utc = dateOnlyToUTC("2026-09-25");
    expect(utc.toISOString()).toBe("2026-09-25T00:00:00.000Z");
  });

  it("utcToDateOnly mengembalikan tanggal yang sama", () => {
    expect(utcToDateOnly(new Date("2026-09-25T00:00:00.000Z"))).toBe("2026-09-25");
    // 25 Sep 2026 00:00 WIB == 24 Sep 17:00 UTC; disimpan sebagai DATE, tetap 25.
    expect(utcToDateOnly(new Date("2026-09-24T17:00:00.000Z"))).toBe("2026-09-24");
  });

  it("round-trip 1000 hari tidak pernah bergeser", () => {
    let date = "2026-01-01";
    for (let i = 0; i < 1000; i += 1) {
      expect(utcToDateOnly(dateOnlyToUTC(date))).toBe(date);
      date = addDays(date, 1);
    }
  });

  it("todayDateOnly menghasilkan format YYYY-MM-DD di timezone aplikasi", () => {
    const today = todayDateOnly("Asia/Jakarta");
    expect(isDateOnly(today)).toBe(true);
    // 31 Des 2026 21:00 UTC == 1 Jan 2027 04:00 WIB -> harus 2027-01-01
    const jakarta = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date("2026-12-31T21:00:00Z"));
    expect(jakarta).toBe("2027-01-01");
  });

  it("isDateOnly menolak tanggal tidak valid", () => {
    expect(isDateOnly("2026-02-30")).toBe(false);
    expect(isDateOnly("2026-13-01")).toBe(false);
    expect(isDateOnly("2026-1-1")).toBe(false);
    expect(isDateOnly("2026-02-28")).toBe(true);
    expect(isDateOnly("2028-02-29")).toBe(true); // kabisat
  });
});

describe("date helpers", () => {
  it("addMonths menghormati panjang bulan", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-03-25", -1)).toBe("2026-02-25");
  });

  it("addDays melintasi pergantian bulan dan tahun", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("rangeLengthInDays inklusif", () => {
    expect(rangeLengthInDays({ start: "2026-09-25", end: "2026-10-24" })).toBe(30);
    expect(rangeLengthInDays({ start: "2026-09-01", end: "2026-09-01" })).toBe(1);
  });
});

describe("label periode (Bahasa Indonesia)", () => {
  it("formatPeriodLabel meringkas tahun yang sama", () => {
    expect(formatPeriodLabel({ start: "2026-09-25", end: "2026-10-24" })).toBe("25 Sep – 24 Okt 2026");
    // Lintas tahun: kedua tahun ditampilkan supaya tidak ambigu.
    expect(formatPeriodLabel({ start: "2026-12-25", end: "2027-01-24" })).toBe("25 Des 2026 – 24 Jan 2027");
  });

  it("formatPeriodLabel long", () => {
    expect(formatPeriodLabel({ start: "2026-09-25", end: "2026-10-24" }, { long: true })).toBe(
      "25 September – 24 Oktober 2026",
    );
  });

  it("formatRangeLabel selalu menampilkan tahun kedua sisi", () => {
    expect(formatRangeLabel({ start: "2026-09-25", end: "2026-10-24" })).toBe("25 Sep 2026 – 24 Okt 2026");
  });

  it("formatDateShort / formatDateLong", () => {
    expect(formatDateShort("2026-09-25")).toBe("25 Sep 2026");
    expect(formatDateLong("2026-09-25")).toBe("25 September 2026");
  });
});

describe("resolveRange (date filter)", () => {
  const today = "2026-10-10"; // di dalam 25 Sep - 24 Okt

  it("default = periode saat ini", () => {
    expect(resolveRange({ today })).toEqual({ start: "2026-09-25", end: "2026-10-24" });
  });

  it("previous = periode sebelumnya", () => {
    expect(resolveRange({ preset: "previous", today })).toEqual({
      start: "2026-08-25",
      end: "2026-09-24",
    });
  });

  it("all = tanpa batas (null)", () => {
    expect(resolveRange({ preset: "all", today })).toBeNull();
  });

  it("custom memakai start/end yang diberikan", () => {
    expect(resolveRange({ preset: "custom", start: "2026-09-01", end: "2026-09-15", today })).toEqual({
      start: "2026-09-01",
      end: "2026-09-15",
    });
  });

  it("custom dengan urutan terbalik dibetulkan", () => {
    expect(resolveRange({ preset: "custom", start: "2026-09-15", end: "2026-09-01", today })).toEqual({
      start: "2026-09-01",
      end: "2026-09-15",
    });
  });

  it("custom tanpa tanggal jatuh ke periode saat ini", () => {
    expect(resolveRange({ preset: "custom", today })).toEqual({ start: "2026-09-25", end: "2026-10-24" });
  });
});

describe("currentPeriod", () => {
  it("mengikuti periode yang memuat hari ini", () => {
    const today = todayDateOnly();
    expect(currentPeriod()).toEqual(getPeriodForDate(today));
  });
});

describe("percentChange (perbandingan periode)", () => {
  it("hitung naik dan turun", () => {
    expect(percentChange(1_850_000, 1_650_000)).toBeCloseTo(12.12, 1);
    expect(percentChange(1_000_000, 1_200_000)).toBeCloseTo(-16.67, 1);
  });

  it("tidak pernah Infinity/NaN saat pembanding nol", () => {
    expect(percentChange(500_000, 0)).toBeNull();
    expect(percentChange(0, 0)).toBeNull();
    expect(percentChange(Number.NaN, 100)).toBeNull();
  });

  it("100% naik dari nilai kecil", () => {
    expect(percentChange(200, 100)).toBeCloseTo(100, 5);
  });
});
