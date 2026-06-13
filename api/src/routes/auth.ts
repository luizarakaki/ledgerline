import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { hashPassword, verifyPassword, validEmail } from "../lib/auth.js";
import { SESSION_COOKIE, SESSION_MAX_AGE_SEC, config } from "../config.js";
import type { SessionToken } from "../types.js";

const signupBody = z.object({
  name: z.string().trim().min(1, "Please enter your name."),
  email: z.string().trim().toLowerCase(),
  password: z.string(),
});
const signinBody = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string(),
});

function publicUser(t: SessionToken) {
  return { id: t.sub, email: t.email, name: t.name };
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const setSession = (reply: FastifyReply, token: SessionToken) => {
    const jwt = app.jwt.sign(token);
    reply.setCookie(SESSION_COOKIE, jwt, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: config.isProd,
      maxAge: SESSION_MAX_AGE_SEC,
    });
  };

  // POST /api/auth/signup
  app.post("/signup", async (req, reply) => {
    const parsed = signupBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request." });
    const { name, email, password } = parsed.data;

    if (!validEmail(email)) return reply.code(400).send({ error: "Please enter a valid email address." });
    if (!password || password.length < 8)
      return reply.code(400).send({ error: "Password must be at least 8 characters." });

    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing.length)
      return reply.code(409).send({ error: "An account with that email already exists. Try signing in." });

    const passwordHash = await hashPassword(password);
    const [row] = await db.insert(users).values({ name, email, passwordHash }).returning();
    const token: SessionToken = { sub: row.id, email: row.email, name: row.name };
    setSession(reply, token);
    return reply.code(201).send({ user: publicUser(token) });
  });

  // POST /api/auth/signin
  app.post("/signin", async (req, reply) => {
    const parsed = signinBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request." });
    const { email, password } = parsed.data;

    if (!validEmail(email)) return reply.code(400).send({ error: "Please enter a valid email address." });

    const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!u) return reply.code(401).send({ error: "No account found for that email. Sign up to get started." });

    const ok = await verifyPassword(u.passwordHash, password ?? "");
    if (!ok) return reply.code(401).send({ error: "Incorrect password. Please try again." });

    const token: SessionToken = { sub: u.id, email: u.email, name: u.name };
    setSession(reply, token);
    return reply.send({ user: publicUser(token) });
  });

  // POST /api/auth/signout
  app.post("/signout", async (_req, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return reply.send({ ok: true });
  });

  // GET /api/auth/me
  app.get("/me", { preHandler: app.authenticate }, async (req) => {
    return { user: publicUser(req.user) };
  });
}
