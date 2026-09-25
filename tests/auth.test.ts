import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { cleanupTestUsers, createTestUser, prisma, testEmail, testUsername } from "./helpers/db";
import {
  authenticate,
  changePassword,
  emailExists,
  registerUser,
  requestPasswordReset,
  usernameExists,
} from "@/lib/auth/service";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { consumeResetToken, inspectResetToken, issueResetToken } from "@/lib/auth/reset-tokens";
import { decideRedirect } from "@/lib/route-guard";

/**
 * Authentication, authorisation and password-reset tests (requirement 49).
 * These run against the real Postgres database.
 */

beforeEach(async () => {
  await cleanupTestUsers();
});

afterAll(async () => {
  await cleanupTestUsers();
  await prisma.$disconnect();
});

describe("register", () => {
  it("register berhasil dan password disimpan sebagai hash", async () => {
    const username = testUsername("reg");
    const result = await registerUser({
      username,
      email: testEmail(username),
      password: "SuperSecret123",
    });

    expect(result.ok).toBe(true);
    expect(result.data?.username).toBe(username);

    const row = await prisma.user.findUnique({ where: { username } });
    expect(row).not.toBeNull();
    expect(row!.passwordHash).not.toBe("SuperSecret123");
    expect(row!.passwordHash).not.toContain("SuperSecret123");
    expect(row!.passwordHash.startsWith("$2")).toBe(true);
    expect(await verifyPassword("SuperSecret123", row!.passwordHash)).toBe(true);
  });

  it("duplicate username ditolak", async () => {
    const username = testUsername("dup");
    await registerUser({ username, email: testEmail(username), password: "SuperSecret123" });

    const second = await registerUser({
      username,
      email: `other_${testEmail(username)}`,
      password: "SuperSecret123",
    });
    expect(second.ok).toBe(false);
    expect(second.fieldErrors?.username).toBeTruthy();
  });

  it("duplicate email ditolak", async () => {
    const username = testUsername("dup2");
    const email = testEmail(username);
    await registerUser({ username, email, password: "SuperSecret123" });

    const other = testUsername("dup3");
    const second = await registerUser({ username: other, email, password: "SuperSecret123" });
    expect(second.ok).toBe(false);
    expect(second.fieldErrors?.email).toBeTruthy();
  });

  it("username/email unik dicek tanpa membocorkan data", async () => {
    const username = testUsername("uniq");
    expect(await usernameExists(username)).toBe(false);
    expect(await emailExists(testEmail(username))).toBe(false);
    await createTestUser("uniq");
    expect(await usernameExists(username)).toBe(false); // still free: random suffix differs
  });
});

describe("login", () => {
  it("login benar berhasil", async () => {
    const username = testUsername("login");
    await registerUser({ username, email: testEmail(username), password: "SuperSecret123" });

    const byUsername = await authenticate(username, "SuperSecret123");
    expect(byUsername.ok).toBe(true);
    expect(byUsername.data?.username).toBe(username);

    const byEmail = await authenticate(testEmail(username), "SuperSecret123");
    expect(byEmail.ok).toBe(true);
  });

  it("login salah gagal dengan pesan generik", async () => {
    const username = testUsername("wrong");
    await registerUser({ username, email: testEmail(username), password: "SuperSecret123" });

    const wrongPassword = await authenticate(username, "WrongPassword123");
    expect(wrongPassword.ok).toBe(false);

    const unknownUser = await authenticate("definitely_not_here", "Whatever123");
    expect(unknownUser.ok).toBe(false);
    // Identical message: no account enumeration.
    expect(wrongPassword.error).toBe(unknownUser.error);
  });

  it("login case-insensitive untuk username dan email", async () => {
    const username = testUsername("case");
    await registerUser({ username, email: testEmail(username), password: "SuperSecret123" });
    expect((await authenticate(username.toUpperCase(), "SuperSecret123")).ok).toBe(true);
  });
});

describe("protected routes (requirement 2 & 39)", () => {
  const protectedPaths = [
    "/dashboard",
    "/expenses/new",
    "/expenses/abc/edit",
    "/history",
    "/journal",
    "/journal/FREYA",
    "/statistics",
    "/budget",
    "/profile",
  ];

  it("redirect ke /login tanpa session cookie", () => {
    for (const path of protectedPaths) {
      const decision = decideRedirect(path, "", false);
      expect(decision.type).toBe("redirect");
      if (decision.type === "redirect") {
        expect(decision.to).toBe("/login");
        expect(decision.next).toBe(path);
      }
    }
  });

  it("dengan session cookie boleh lewat", () => {
    for (const path of protectedPaths) {
      expect(decideRedirect(path, "", true).type).toBe("next");
    }
  });

  it("halaman auth dilewatkan saat belum login", () => {
    for (const path of ["/login", "/register", "/forgot-password"]) {
      expect(decideRedirect(path, "", false).type).toBe("next");
    }
  });

  it("sudah login tidak perlu ke /login lagi", () => {
    expect(decideRedirect("/login", "", true)).toEqual({ type: "redirect", to: "/dashboard" });
  });
});

describe("change password", () => {
  it("butuh current password yang benar", async () => {
    const user = await createTestUser("chpw");
    const wrong = await changePassword(user.id, "SalahBanget123", "PasswordBaru123");
    expect(wrong.ok).toBe(false);
    expect(wrong.fieldErrors?.currentPassword).toBeTruthy();

    const ok = await changePassword(user.id, "TestPassword123", "PasswordBaru123");
    expect(ok.ok).toBe(true);

    expect((await authenticate(user.username, "TestPassword123")).ok).toBe(false);
    expect((await authenticate(user.username, "PasswordBaru123")).ok).toBe(true);
  });

  it("password baru tidak boleh sama dengan yang lama", async () => {
    const user = await createTestUser("samepw");
    const result = await changePassword(user.id, "TestPassword123", "TestPassword123");
    expect(result.ok).toBe(false);
  });
});

describe("password reset (requirements 6, 7 & 51)", () => {
  it("request reset untuk email tidak terdaftar tetap tidak membocorkan apa pun", async () => {
    const unknown = await requestPasswordReset("nobody@example.test");
    expect(unknown.userId).toBeNull();
  });

  it("raw token tidak pernah disimpan - hanya hash", async () => {
    const user = await createTestUser("reset");
    const { rawToken } = await issueResetToken(user.id);

    const stored = await prisma.passwordResetToken.findMany({ where: { userId: user.id } });
    expect(stored).toHaveLength(1);
    expect(stored[0].tokenHash).not.toBe(rawToken);
    expect(stored[0].tokenHash).toMatch(/^[a-f0-9]{64}$/); // sha256 hex
  });

  it("token valid bisa dipakai, lalu tidak bisa dipakai dua kali", async () => {
    const user = await createTestUser("reset2");
    const { rawToken } = await issueResetToken(user.id);

    expect((await inspectResetToken(rawToken)).state).toBe("valid");

    const first = await consumeResetToken(rawToken, "PasswordBaru456");
    expect(first.state).toBe("valid");

    const second = await consumeResetToken(rawToken, "PasswordLain789");
    expect(second.state).toBe("used");

    expect((await authenticate(user.username, "PasswordBaru456")).ok).toBe(true);
    expect((await authenticate(user.username, "PasswordLain789")).ok).toBe(false);
  });

  it("password lama tidak bisa dipakai setelah reset", async () => {
    const user = await createTestUser("reset3");
    const { rawToken } = await issueResetToken(user.id);
    await consumeResetToken(rawToken, "PasswordBaru456");

    expect((await authenticate(user.username, "TestPassword123")).ok).toBe(false);
    expect((await authenticate(user.username, "PasswordBaru456")).ok).toBe(true);
  });

  it("token invalid ditolak", async () => {
    expect((await inspectResetToken("token-palsu")).state).toBe("invalid");
    expect((await inspectResetToken("")).state).toBe("invalid");
    expect((await consumeResetToken("token-palsu", "PasswordBaru456")).state).toBe("invalid");
  });

  it("token expired ditolak", async () => {
    const user = await createTestUser("reset4");
    const { rawToken } = await issueResetToken(user.id);

    // Expire it in the past.
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    expect((await inspectResetToken(rawToken)).state).toBe("expired");
    expect((await consumeResetToken(rawToken, "PasswordBaru456")).state).toBe("expired");
    expect((await authenticate(user.username, "TestPassword123")).ok).toBe(true);
  });

  it("reset password menghapus session lama (invalidate)", async () => {
    const user = await createTestUser("reset5");
    await prisma.session.create({
      data: { userId: user.id, tokenHash: "deadbeef".repeat(8), expiresAt: new Date(Date.now() + 3_600_000) },
    });
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1);

    const { rawToken } = await issueResetToken(user.id);
    await consumeResetToken(rawToken, "PasswordBaru456");

    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("token baru membatalkan token lama yang belum dipakai", async () => {
    const user = await createTestUser("reset6");
    const first = await issueResetToken(user.id);
    const second = await issueResetToken(user.id);

    expect((await inspectResetToken(first.rawToken)).state).toBe("used");
    expect((await inspectResetToken(second.rawToken)).state).toBe("valid");
  });
});

describe("password hashing", () => {
  it("hash berbeda untuk password sama (salt acak)", async () => {
    const a = await hashPassword("SamaPersis123");
    const b = await hashPassword("SamaPersis123");
    expect(a).not.toBe(b);
    expect(await verifyPassword("SamaPersis123", a)).toBe(true);
    expect(await verifyPassword("SamaPersis123", b)).toBe(true);
  });

  it("hash kosong / rusak tidak pernah lolos", async () => {
    expect(await verifyPassword("apa saja", "")).toBe(false);
    expect(await verifyPassword("apa saja", "bukan-hash")).toBe(false);
  });
});
