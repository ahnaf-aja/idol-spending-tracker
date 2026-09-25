import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { cleanupTestUsers, createTestUser, prisma } from "./helpers/db";
import { pruneRateLimits, clientFingerprint, consumeRateLimit } from "@/lib/rate-limit";

describe("rate limiting (requirement 40)", () => {
  beforeEach(async () => {
    await prisma.rateLimitHit.deleteMany({});
  });

  afterAll(async () => {
    await prisma.rateLimitHit.deleteMany({});
    await cleanupTestUsers();
    await prisma.$disconnect();
  });

  it("membatasi login setelah N percobaan", async () => {
    const identifier = `198.51.100.${Math.floor(Math.random() * 250)}|victim@example.test`;
    const results = [];
    for (let i = 0; i < 12; i += 1) {
      results.push(await consumeRateLimit("login", identifier));
    }
    expect(results.filter((r) => r.ok).length).toBe(8); // RATE_LIMITS.login.limit
    expect(results.at(-1)!.ok).toBe(false);
    expect(results.at(-1)!.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("identifier berbeda punya kuota sendiri", async () => {
    const a = `203.0.113.1|a@example.test`;
    const b = `203.0.113.2|b@example.test`;
    for (let i = 0; i < 9; i += 1) await consumeRateLimit("login", a);
    expect((await consumeRateLimit("login", a)).ok).toBe(false);
    expect((await consumeRateLimit("login", b)).ok).toBe(true);
  });

  it("forgot password dibatasi lebih ketat", async () => {
    const identifier = `192.0.2.10|forgot@example.test`;
    for (let i = 0; i < 5; i += 1) await consumeRateLimit("forgot", identifier);
    expect((await consumeRateLimit("forgot", identifier)).ok).toBe(false);
  });

  it("prune menghapus hit lama", async () => {
    await prisma.rateLimitHit.create({
      data: { key: "login:old", windowStart: new Date(Date.now() - 10 * 86_400_000), count: 3 },
    });
    expect(await pruneRateLimits(86_400)).toBeGreaterThanOrEqual(1);
    expect(await prisma.rateLimitHit.count({ where: { key: "login:old" } })).toBe(0);
  });

  it("fingerprint memakai x-forwarded-for pertama", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(clientFingerprint(headers, "NafAja")).toBe("1.2.3.4|nafaja");
  });
});

describe("session storage (requirement 40)", () => {
  beforeEach(async () => {
    await cleanupTestUsers();
  });

  it("token session disimpan sebagai hash, bukan raw", async () => {
    const { generateToken, hashToken } = await import("@/lib/auth/session");
    const raw = generateToken();
    const hash = hashToken(raw);

    expect(hash).not.toBe(raw);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);

    const user = await createTestUser("session");
    await prisma.session.create({
      data: { userId: user.id, tokenHash: hash, expiresAt: new Date(Date.now() + 3_600_000) },
    });

    const stored = await prisma.session.findFirst({ where: { userId: user.id } });
    expect(stored!.tokenHash).not.toBe(raw);
    expect(stored!.tokenHash).toBe(hash);
  });

  it("mencabut semua session menghapus akses", async () => {
    const { hashToken, revokeAllSessions } = await import("@/lib/auth/session");
    const user = await createTestUser("revoke");
    await prisma.session.create({
      data: { userId: user.id, tokenHash: hashToken("token-a"), expiresAt: new Date(Date.now() + 3_600_000) },
    });
    await prisma.session.create({
      data: { userId: user.id, tokenHash: hashToken("token-b"), expiresAt: new Date(Date.now() + 3_600_000) },
    });

    // No cookies() in this environment, so keepCurrent finds no cookie -> all go.
    await revokeAllSessions(user.id);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });
});
