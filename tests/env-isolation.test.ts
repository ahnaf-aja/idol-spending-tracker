import { describe, expect, it } from "vitest";
import { config as loadDotenv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Environment isolation guard.
 *
 * `.env.local` is loaded by BOTH `next dev` and `next build`, so a production
 * database URL parked there sends local development - and the end-to-end suite -
 * straight at the live database. The cleanup helpers read `.env` via dotenv, so
 * the two halves would silently disagree: writes going to production while the
 * teardown wiped a different database, leaving residue behind.
 *
 * The rule this locks in: the Neon (production) URL lives ONLY in
 * `.env.production.local`, which Next reads for production builds alone.
 *
 * Verified against @next/env, whose precedence is:
 *   .env.<mode>.local  >  .env.local  >  .env.<mode>  >  .env
 */

const root = process.cwd();

/** Reads one key out of a dotenv file without mutating process.env. */
function readKey(file: string, key: string): string | undefined {
  if (!existsSync(join(root, file))) return undefined;
  return loadDotenv({ path: join(root, file), processEnv: {}, quiet: true }).parsed?.[key];
}

/**
 * Neon hostnames differ only by a `-pooler` infix and a `.c-<n>` region suffix
 * between the pooled and unpooled forms, so compare the endpoint id only.
 */
function neonEndpoint(host: string): string {
  return host.replace(/-pooler/, "").split(".")[0];
}

describe("environment isolation", () => {
  it("development database URL points at localhost, not a managed host", () => {
    const url = readKey(".env", "DATABASE_URL");
    expect(url, ".env must define DATABASE_URL").toBeTruthy();
    expect(url).toMatch(/localhost|127\.0\.0\.1/);
  });

  it("production URL is not parked in .env.local (which next dev also loads)", () => {
    const url = readKey(".env.local", "DATABASE_URL");
    if (url) {
      expect(
        url,
        ".env.local is loaded by next dev too - put production URLs in .env.production.local",
      ).toMatch(/localhost|127\.0\.0\.1/);
    }
  });

  it("production URLs, when present, live in .env.production.local", () => {
    const url = readKey(".env.production.local", "DATABASE_URL");
    if (url) {
      // Whatever is there must be the non-local variant, never a local one.
      expect(url).not.toMatch(/localhost|127\.0\.0\.1/);
      expect(url).toMatch(/^postgres(ql)?:\/\//);
    }
    // Unpooled variant, when present, must agree with the pooled one's host.
    const unpooled = readKey(".env.production.local", "DATABASE_URL_UNPOOLED");
    if (url && unpooled) {
      const hostOf = (u: string) => neonEndpoint(new URL(u.replace(/^"|"$/g, "")).host);
      expect(hostOf(unpooled)).toBe(hostOf(url));
    }
  });

  it(".env.example documents every required variable and holds no secrets", () => {
    // Committed on purpose, so it must be a complete checklist of what a
    // deployment needs - while every value stays empty.
    for (const key of [
      "DATABASE_URL",
      "SEED_USERNAME",
      "SEED_USER_EMAIL",
      "SEED_USER_PASSWORD",
      "APP_URL",
      "RESET_TOKEN_TTL_MINUTES",
    ]) {
      expect(readKey(".env.example", key), `.env.example must list ${key}`).toBeDefined();
    }

    const raw = readFileSync(join(root, ".env.example"), "utf8");
    // A committed example file must never carry a real credential.
    expect(raw).not.toMatch(/neon\.tech|localhost:5434|@gmail\.com/);
    expect(raw).toMatch(/^DATABASE_URL=\s*$/m);
  });
});
