import "@fastify/jwt";
import type { FastifyReply, FastifyRequest } from "fastify";

/** Shape of the signed session token payload. */
export interface SessionToken {
  sub: string; // user id
  email: string;
  name: string;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: SessionToken;
    user: SessionToken;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/** The four statement slots that make up a dataset. */
export const SLOTS = ["parentPnl", "parentBs", "subPnl", "subBs"] as const;
export type Slot = (typeof SLOTS)[number];
export const isSlot = (s: string): s is Slot => (SLOTS as readonly string[]).includes(s);
