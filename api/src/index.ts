import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { existsSync } from "node:fs";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import fastifyStatic from "@fastify/static";
import { config, SESSION_COOKIE } from "./config.js";
import { runMigrations, closeDb } from "./db/client.js";
import { authRoutes } from "./routes/auth.js";
import { datasetRoutes } from "./routes/datasets.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function build() {
  const app = Fastify({
    logger: {
      level: config.isProd ? "info" : "debug",
      transport: config.isProd ? undefined : { target: "pino-pretty" },
    },
    bodyLimit: 5 * 1024 * 1024, // 5MB — CSV uploads
  });

  await app.register(cookie);
  await app.register(jwt, {
    secret: config.jwtSecret,
    cookie: { cookieName: SESSION_COOKIE, signed: false },
  });

  // Auth preHandler decorator — reads the session token from the cookie.
  app.decorate("authenticate", async (req, reply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: "Not authenticated." });
    }
  });

  app.get("/api/health", async () => ({ status: "ok" }));
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(datasetRoutes, { prefix: "/api/datasets" });

  // ---- serve the built web SPA in production ----
  const webDist = resolve(__dirname, "..", config.webDist);
  if (existsSync(join(webDist, "index.html"))) {
    await app.register(fastifyStatic, { root: webDist, wildcard: false });
    // SPA fallback: any non-API GET returns index.html.
    app.setNotFoundHandler((req, reply) => {
      if (req.method === "GET" && !req.url.startsWith("/api")) {
        return reply.sendFile("index.html");
      }
      return reply.code(404).send({ error: "Not found." });
    });
  } else {
    app.log.warn(`Web build not found at ${webDist} — running API only.`);
  }

  return app;
}

async function main() {
  await runMigrations();
  const app = await build();
  await app.listen({ port: config.port, host: "0.0.0.0" });

  const shutdown = async () => {
    await app.close();
    await closeDb();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
