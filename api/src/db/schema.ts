import { pgTable, uuid, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";

/** Application users. Passwords are stored as argon2 hashes only. */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailUnique: uniqueIndex("users_email_unique").on(t.email),
  }),
);

/**
 * A consolidation dataset owned by a user — a named group of the four
 * statements (parent/subsidiary × P&L/balance sheet).
 */
export const datasets = pgTable(
  "datasets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byUser: index("datasets_user_idx").on(t.userId),
  }),
);

/**
 * A single uploaded CSV statement belonging to a dataset. The raw CSV text is
 * stored verbatim so it can be retrieved and re-consolidated later.
 *
 * `slot` is one of: parentPnl | parentBs | subPnl | subBs
 */
export const statements = pgTable(
  "statements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    datasetId: uuid("dataset_id")
      .notNull()
      .references(() => datasets.id, { onDelete: "cascade" }),
    slot: text("slot").notNull(),
    filename: text("filename").notNull(),
    rawCsv: text("raw_csv").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byDataset: index("statements_dataset_idx").on(t.datasetId),
    slotUnique: uniqueIndex("statements_dataset_slot_unique").on(t.datasetId, t.slot),
  }),
);

export type User = typeof users.$inferSelect;
export type Dataset = typeof datasets.$inferSelect;
export type Statement = typeof statements.$inferSelect;
