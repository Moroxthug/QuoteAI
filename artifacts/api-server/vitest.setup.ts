// Runs before every test file. Nothing here connects to a real database or
// third-party service — it only satisfies module-load-time env var checks
// (e.g. `@workspace/db`'s `new Pool()`, which is lazy and never actually
// queried by the unit tests in this suite) so pure-logic modules can be
// imported without a live DATABASE_URL/secrets in CI.
process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
process.env.BETTER_AUTH_SECRET ??= "test-secret-not-for-production-use-0000";
process.env.TOKEN_ENCRYPTION_KEY ??= "0".repeat(64);
