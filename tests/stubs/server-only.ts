// Stub for the `server-only` marker package under Vitest. The real package's
// only job is to fail the build if imported from a client component; tests run
// on the server, so it is replaced with an empty module.
export {};
