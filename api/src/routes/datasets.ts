import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, eq, desc, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { datasets, statements, type Dataset, type Statement } from "../db/schema.js";
import { parseStatement } from "../lib/csv.js";
import { consolidate, type ParsedInput } from "../lib/engine.js";
import { SLOTS, isSlot, type Slot } from "../types.js";

const fileSchema = z.object({
  filename: z.string().trim().min(1),
  text: z.string(),
});
const createBody = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  files: z.record(z.string(), fileSchema),
});

/** Summarize a single statement (parses the stored CSV for counts). */
function summarizeStatement(slot: string, filename: string, rawCsv: string) {
  const parsed = parseStatement(rawCsv);
  return {
    slot,
    filename,
    accounts: parsed.items.length,
    notes: parsed.errors.length,
    fatal: parsed.items.length === 0,
  };
}

/** Summary shape returned by the list and create endpoints. */
function summarizeDataset(ds: Dataset, stmts: Statement[]) {
  return {
    id: ds.id,
    name: ds.name,
    createdAt: ds.createdAt,
    statements: stmts.map((s) => summarizeStatement(s.slot, s.filename, s.rawCsv)),
    complete: SLOTS.every((slot) => stmts.some((s) => s.slot === slot)),
  };
}

export async function datasetRoutes(app: FastifyInstance): Promise<void> {
  // All dataset routes require auth.
  app.addHook("preHandler", app.authenticate);

  // GET /api/datasets — list the current user's datasets with summaries.
  app.get("/", async (req) => {
    const rows = await db
      .select()
      .from(datasets)
      .where(eq(datasets.userId, req.user.sub))
      .orderBy(desc(datasets.createdAt));
    if (rows.length === 0) return { datasets: [] };

    // Single query for all statements, grouped in memory (avoids an N+1).
    const stmts = await db
      .select()
      .from(statements)
      .where(inArray(statements.datasetId, rows.map((d) => d.id)));
    const byDataset = new Map<string, Statement[]>();
    for (const s of stmts) {
      const list = byDataset.get(s.datasetId);
      if (list) list.push(s);
      else byDataset.set(s.datasetId, [s]);
    }

    return { datasets: rows.map((ds) => summarizeDataset(ds, byDataset.get(ds.id) ?? [])) };
  });

  // POST /api/datasets — create a dataset from the four uploaded CSVs.
  app.post("/", async (req, reply) => {
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request body." });
    const { files } = parsed.data;

    const entries = Object.entries(files).filter(([slot]) => isSlot(slot)) as [Slot, z.infer<typeof fileSchema>][];
    const providedSlots = new Set(entries.map(([slot]) => slot));
    const missing = SLOTS.filter((s) => !providedSlots.has(s));
    if (missing.length)
      return reply.code(400).send({ error: `Missing statement(s): ${missing.join(", ")}.` });

    // Validate each file parses into at least one row.
    for (const [slot, file] of entries) {
      const p = parseStatement(file.text);
      if (p.items.length === 0)
        return reply.code(400).send({ error: `Couldn't read any rows from the ${slot} file.` });
    }

    const name = parsed.data.name?.trim() || defaultName(req.user.name);
    const userId = req.user.sub;

    const [ds] = await db.insert(datasets).values({ userId, name }).returning();
    await db.insert(statements).values(
      entries.map(([slot, file]) => ({
        datasetId: ds.id,
        slot,
        filename: file.filename,
        rawCsv: file.text,
      })),
    );

    const stmts = await db.select().from(statements).where(eq(statements.datasetId, ds.id));
    return reply.code(201).send({ dataset: summarizeDataset(ds, stmts) });
  });

  // GET /api/datasets/:id — full dataset incl. raw CSV text (for retrieval/re-run).
  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const ds = await loadOwnedDataset(req.params.id, req.user.sub);
    if (!ds) return reply.code(404).send({ error: "Dataset not found." });
    const stmts = await db.select().from(statements).where(eq(statements.datasetId, ds.id));
    return {
      dataset: {
        id: ds.id,
        name: ds.name,
        createdAt: ds.createdAt,
        statements: stmts.map((s) => ({
          ...summarizeStatement(s.slot, s.filename, s.rawCsv),
          rawCsv: s.rawCsv,
        })),
      },
    };
  });

  // GET /api/datasets/:id/consolidation — run the engine over the stored CSVs.
  app.get<{ Params: { id: string } }>("/:id/consolidation", async (req, reply) => {
    const ds = await loadOwnedDataset(req.params.id, req.user.sub);
    if (!ds) return reply.code(404).send({ error: "Dataset not found." });

    const stmts = await db.select().from(statements).where(eq(statements.datasetId, ds.id));
    const bySlot = new Map(stmts.map((s) => [s.slot, s]));
    const missing = SLOTS.filter((s) => !bySlot.has(s));
    if (missing.length)
      return reply.code(409).send({ error: `Dataset is missing statement(s): ${missing.join(", ")}.` });

    const input: ParsedInput = {
      parentPnl: parseStatement(bySlot.get("parentPnl")!.rawCsv),
      parentBs: parseStatement(bySlot.get("parentBs")!.rawCsv),
      subPnl: parseStatement(bySlot.get("subPnl")!.rawCsv),
      subBs: parseStatement(bySlot.get("subBs")!.rawCsv),
    };
    const result = consolidate(input);
    return {
      dataset: { id: ds.id, name: ds.name, createdAt: ds.createdAt },
      result,
    };
  });

  // DELETE /api/datasets/:id
  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const ds = await loadOwnedDataset(req.params.id, req.user.sub);
    if (!ds) return reply.code(404).send({ error: "Dataset not found." });
    await db.delete(datasets).where(eq(datasets.id, ds.id));
    return reply.send({ ok: true });
  });
}

async function loadOwnedDataset(id: string, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [ds] = await db
    .select()
    .from(datasets)
    .where(and(eq(datasets.id, id), eq(datasets.userId, userId)))
    .limit(1);
  return ds ?? null;
}

function defaultName(userName: string): string {
  const first = (userName || "").split(/\s+/)[0] || "My";
  return `${first}'s consolidation`;
}
