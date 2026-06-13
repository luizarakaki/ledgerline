/** Types mirroring the API consolidation engine output (api/src/lib/engine.ts). */

export type WarningLevel = "info" | "warn" | "error";
export interface Warning {
  level: WarningLevel;
  text: string;
}

export interface EliminationLeg {
  statement: "PNL" | "BS";
  key: string;
  account: string;
  amount: number;
}
export interface Elimination {
  id: string;
  statement: "PNL" | "BS";
  kind: string;
  title: string;
  amount: number;
  description: string;
  legs: EliminationLeg[];
}

export interface WorksheetRow {
  account: string;
  key: string;
  group: string;
  type: string;
  parent: number;
  sub: number;
  elim: number;
  notes: string[];
  consolidated: number;
}

export interface ColumnTotals {
  parent: number;
  sub: number;
  elim: number;
  consolidated: number;
}

export interface ConsolidationResult {
  pnl: { rows: WorksheetRow[]; totals: ColumnTotals; netIncome: ColumnTotals; groups: string[] };
  bs: {
    rows: WorksheetRow[];
    totals: ColumnTotals;
    section: { assets: ColumnTotals; liabilities: ColumnTotals; equity: ColumnTotals };
    groups: string[];
    balanced: boolean;
    consolBalance: number;
  };
  eliminations: Elimination[];
  warnings: Warning[];
  providedNI: { parent: number | null; sub: number | null };
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export type SlotKey = "parentPnl" | "parentBs" | "subPnl" | "subBs";

export interface StatementSummary {
  slot: string;
  filename: string;
  accounts: number;
  notes: number;
  fatal: boolean;
  rawCsv?: string;
}

export interface DatasetSummary {
  id: string;
  name: string;
  createdAt: string;
  statements: StatementSummary[];
  complete: boolean;
}
