/** Centralized, validated environment configuration. */
const required = (name: string, fallback?: string): string => {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
};

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  get isProd() {
    return this.nodeEnv === "production";
  },
  port: Number(process.env.PORT ?? 8080),
  databaseUrl: required(
    "DATABASE_URL",
    "postgres://ledgerline:ledgerline@localhost:5432/ledgerline",
  ),
  jwtSecret: required("JWT_SECRET", "dev-insecure-secret-change-me"),
  /** Path to the built web SPA, served in production. */
  webDist: process.env.WEB_DIST ?? "../web/dist",
};

export const SESSION_COOKIE = "ledgerline_session";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days
