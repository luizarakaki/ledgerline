/**
 * Consolidation engine — ported from the design prototype's lib/engine.js.
 *
 * Inputs: four parsed statements (parent/sub × P&L/BS).
 * Output: worksheet rows (Parent | Subsidiary | Eliminations | Consolidated)
 *         for both statements, the elimination entries, and validation.
 *
 * Sign convention is preserved straight from the input (trial-balance):
 *   Revenue +, Expenses -            (P&L)
 *   Assets +, Liabilities -, Equity - (Balance Sheet)
 * So each row:  Consolidated = Parent + Subsidiary + Eliminations.
 * A balanced balance sheet => the Consolidated column sums to 0.
 */
import type { LineItem, ParsedStatement } from "./csv.js";

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

export interface ParsedInput {
  parentPnl: ParsedStatement;
  parentBs: ParsedStatement;
  subPnl: ParsedStatement;
  subBs: ParsedStatement;
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
  providedNI: { parent: number | undefined; sub: number | undefined };
}

const norm = (s: unknown): string =>
  String(s || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const round = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const PNL_GROUPS = ["Revenue", "COGS", "Operating Expense", "Other Income", "Other Expense"];
const BS_GROUPS = ["Asset", "Liability", "Equity"];

function pnlGroup(type: string, account: string): string {
  const t = norm(type),
    a = norm(account);
  if (/cogs|cost of goods|cost of sales|cost of revenue/.test(t + " " + a)) return "COGS";
  if (/\brevenue\b|\bsales\b|\bincome\b.*operating|turnover/.test(t)) {
    if (/other/.test(t)) return "Other Income";
    return "Revenue";
  }
  if (/other income|interest income|gain/.test(t + " " + a)) return "Other Income";
  if (/other expense|interest expense|loss/.test(t + " " + a)) return "Other Expense";
  if (/operating expense|opex|expense|sg and a|sga|admin/.test(t)) return "Operating Expense";
  if (/revenue|sales|income/.test(a)) return "Revenue";
  return "Operating Expense";
}
function bsGroup(type: string, account: string): string {
  const t = norm(type),
    a = norm(account);
  if (/asset/.test(t)) return "Asset";
  if (/liab/.test(t)) return "Liability";
  if (/equity|capital|stock|retained|earnings/.test(t)) return "Equity";
  if (/cash|receivable|inventory|investment|property|plant|equipment|prepaid|goodwill|depreciation|due from/.test(a))
    return "Asset";
  if (/payable|debt|loan|accrued|deferred|due to|tax payable/.test(a)) return "Liability";
  return "Equity";
}

const isNetIncomeRow = (it: LineItem): boolean =>
  /net income|net profit|net loss/.test(norm(it.type)) || norm(it.account) === "net income";

interface MutableRow extends WorksheetRow {
  _i?: number;
}

function mergeRows(
  parentItems: LineItem[],
  subItems: LineItem[],
  groupFn: (type: string, account: string) => string,
  groupOrder: string[],
): MutableRow[] {
  const map = new Map<string, MutableRow>();
  const order: MutableRow[] = [];
  function add(items: LineItem[], side: "parent" | "sub") {
    for (const it of items) {
      const key = norm(it.account);
      if (!map.has(key)) {
        const g = groupFn(it.type, it.account);
        const row: MutableRow = {
          account: it.account,
          key,
          group: g,
          type: it.type,
          parent: 0,
          sub: 0,
          elim: 0,
          notes: [],
          consolidated: 0,
        };
        map.set(key, row);
        order.push(row);
      }
      const row = map.get(key)!;
      row[side] += it.amount;
      if (!row.type && it.type) row.type = it.type;
    }
  }
  add(parentItems, "parent");
  add(subItems, "sub");
  order.forEach((r, i) => (r._i = i));
  order.sort((a, b) => {
    const ga = groupOrder.indexOf(a.group),
      gb = groupOrder.indexOf(b.group);
    if (ga !== gb) return (ga === -1 ? 99 : ga) - (gb === -1 ? 99 : gb);
    return a._i! - b._i!;
  });
  return order;
}

const findRow = (rows: MutableRow[], pred: (r: MutableRow) => boolean) => rows.find(pred);

function colTotals(rows: WorksheetRow[]): ColumnTotals {
  const sum = (c: keyof WorksheetRow) =>
    Math.round((rows.reduce((a, r) => a + (r[c] as number), 0) + Number.EPSILON) * 100) / 100;
  return { parent: sum("parent"), sub: sum("sub"), elim: sum("elim"), consolidated: sum("consolidated") };
}

export function money(n: number): string {
  const v = Math.round(Math.abs(n));
  return "$" + v.toLocaleString("en-US");
}

export function consolidate(parsed: ParsedInput): ConsolidationResult {
  const warnings: Warning[] = [];
  const eliminations: Elimination[] = [];

  // ---------- P&L ----------
  const pPnl = parsed.parentPnl.items.filter((it) => !isNetIncomeRow(it));
  const sPnl = parsed.subPnl.items.filter((it) => !isNetIncomeRow(it));
  const providedNI = {
    parent: parsed.parentPnl.items.find(isNetIncomeRow)?.amount,
    sub: parsed.subPnl.items.find(isNetIncomeRow)?.amount,
  };
  const pnlRows = mergeRows(pPnl, sPnl, pnlGroup, PNL_GROUPS);

  const interRev = findRow(
    pnlRows,
    (r) =>
      r.group === "Revenue" &&
      /subsidiary revenue|intercompany revenue|intercompany sales|intercompany income|interco revenue|management fee income|service fee income|fees from/.test(
        r.key,
      ),
  );
  const interExp = findRow(
    pnlRows,
    (r) =>
      /operating expense|other expense/i.test(r.group) &&
      /parent company fee|parent fee|management fee|intercompany fee|intercompany expense|intercompany charge|interco fee|service fee|fees to parent|fees from parent/.test(
        r.key,
      ),
  );

  if (interRev && interExp) {
    const revMag = Math.abs(interRev.parent + interRev.sub);
    const expMag = Math.abs(interExp.parent + interExp.sub);
    const E = Math.min(revMag, expMag);
    interRev.elim += -E;
    interExp.elim += +E;
    const entry: Elimination = {
      id: "E-PNL-1",
      statement: "PNL",
      kind: "Intercompany services",
      title: "Eliminate intercompany services",
      amount: E,
      description: `The parent bills the subsidiary for services. Parent's "${interRev.account}" (${money(revMag)}) is internal revenue and the subsidiary's "${interExp.account}" (${money(expMag)}) is the matching internal expense. Both net to zero on consolidation.`,
      legs: [
        { statement: "PNL", key: interRev.key, account: interRev.account, amount: -E },
        { statement: "PNL", key: interExp.key, account: interExp.account, amount: +E },
      ],
    };
    eliminations.push(entry);
    interRev.notes.push(entry.id);
    interExp.notes.push(entry.id);
    if (revMag !== expMag)
      warnings.push({
        level: "warn",
        text: `Intercompany P&L doesn't fully net: "${interRev.account}" is ${money(revMag)} but "${interExp.account}" is ${money(expMag)}. Eliminated the lesser (${money(E)}); ${money(Math.abs(revMag - expMag))} remains in consolidated income.`,
      });
  } else {
    warnings.push({
      level: "info",
      text: `No intercompany P&L pair detected (looked for an intercompany revenue line on one entity and a matching fee/expense on the other). Nothing eliminated on the income statement.`,
    });
  }

  pnlRows.forEach((r) => (r.consolidated = round(r.parent + r.sub + r.elim)));

  // ---------- Balance Sheet ----------
  const bsRows = mergeRows(parsed.parentBs.items, parsed.subBs.items, bsGroup, BS_GROUPS);

  // (1) intercompany due-to / due-from
  const dueFrom = findRow(
    bsRows,
    (r) =>
      r.group === "Asset" &&
      /due from|receivable from (sub|parent|affiliate|related)|intercompany receivable|loan to/.test(r.key),
  );
  const dueTo = findRow(
    bsRows,
    (r) =>
      r.group === "Liability" &&
      /due to|payable to (sub|parent|affiliate|related)|intercompany payable|loan from/.test(r.key),
  );
  if (dueFrom && dueTo) {
    const fMag = Math.abs(dueFrom.parent + dueFrom.sub);
    const tMag = Math.abs(dueTo.parent + dueTo.sub);
    const E = Math.min(fMag, tMag);
    dueFrom.elim += -E;
    dueTo.elim += +E;
    const entry: Elimination = {
      id: "E-BS-1",
      statement: "BS",
      kind: "Intercompany balances",
      title: "Eliminate intercompany receivable / payable",
      amount: E,
      description: `"${dueFrom.account}" (${money(fMag)}) and "${dueTo.account}" (${money(tMag)}) are the same balance owed between the two entities. From the group's view it nets to zero — you can't owe yourself.`,
      legs: [
        { statement: "BS", key: dueFrom.key, account: dueFrom.account, amount: -E },
        { statement: "BS", key: dueTo.key, account: dueTo.account, amount: +E },
      ],
    };
    eliminations.push(entry);
    dueFrom.notes.push(entry.id);
    dueTo.notes.push(entry.id);
    if (fMag !== tMag)
      warnings.push({
        level: "warn",
        text: `Intercompany balances don't match: "${dueFrom.account}" is ${money(fMag)} but "${dueTo.account}" is ${money(tMag)}. Difference of ${money(Math.abs(fMag - tMag))} was left unreconciled.`,
      });
  } else if (dueFrom || dueTo) {
    warnings.push({
      level: "warn",
      text: `Found one side of an intercompany balance ("${(dueFrom || dueTo)!.account}") but not its match — nothing eliminated for it.`,
    });
  }

  // (2) parent's equity investment vs subsidiary's contributed equity
  const investment = findRow(
    bsRows,
    (r) =>
      r.group === "Asset" &&
      /investment in (sub|the sub|subsidiary|affiliate)|equity investment|investment in subsidiary/.test(r.key),
  );
  if (investment) {
    const invMag = Math.abs(investment.parent + investment.sub);
    const subEquity = bsRows.filter(
      (r) =>
        r.group === "Equity" &&
        Math.abs(r.sub) > 0 &&
        /common stock|share capital|paid in|paid-in|contributed capital|capital stock|ordinary shares/.test(r.key),
    );
    let remaining = invMag;
    const legs: EliminationLeg[] = [
      { statement: "BS", key: investment.key, account: investment.account, amount: -invMag },
    ];
    investment.elim += -invMag;
    let eliminatedEquity = 0;
    for (const eq of subEquity) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, Math.abs(eq.sub));
      eq.elim += +take;
      legs.push({ statement: "BS", key: eq.key, account: eq.account, amount: +take });
      eliminatedEquity += take;
      remaining -= take;
    }
    const eqDesc = subEquity.length
      ? subEquity.map((e) => `"${e.account}" (${money(Math.abs(e.sub))})`).join(" + ")
      : "the subsidiary's contributed equity";
    const entry: Elimination = {
      id: "E-BS-2",
      statement: "BS",
      kind: "Equity investment",
      title: "Eliminate parent's investment in subsidiary",
      amount: invMag,
      description: `The parent's "${investment.account}" (${money(invMag)}) represents 100% ownership of the subsidiary. It is removed against the subsidiary's contributed equity (${eqDesc}). The subsidiary's post-acquisition retained earnings and current-year income are not eliminated — they flow into consolidated equity.`,
      legs,
    };
    eliminations.push(entry);
    investment.notes.push(entry.id);
    subEquity.forEach((e) => e.notes.push(entry.id));
    if (round(remaining) > 0)
      warnings.push({
        level: "warn",
        text: `The investment (${money(invMag)}) exceeds the subsidiary's contributed equity by ${money(remaining)}. In a full model this difference would be recognized as goodwill; it currently leaves the consolidated balance sheet out of balance by ${money(remaining)}.`,
      });
    void eliminatedEquity;
  } else {
    warnings.push({
      level: "info",
      text: `No "Investment in Subsidiary" line found on the parent — no equity elimination performed.`,
    });
  }

  bsRows.forEach((r) => (r.consolidated = round(r.parent + r.sub + r.elim)));

  // ---------- totals ----------
  const pnlTotals = colTotals(pnlRows);
  const netIncome: ColumnTotals = {
    parent: pnlTotals.parent,
    sub: pnlTotals.sub,
    elim: pnlTotals.elim,
    consolidated: pnlTotals.consolidated,
  };

  const bsTotals = colTotals(bsRows);
  const assetRows = bsRows.filter((r) => r.group === "Asset");
  const liabRows = bsRows.filter((r) => r.group === "Liability");
  const eqRows = bsRows.filter((r) => r.group === "Equity");
  const bsSection = {
    assets: colTotals(assetRows),
    liabilities: colTotals(liabRows),
    equity: colTotals(eqRows),
  };

  // ---------- validation ----------
  if (providedNI.parent !== undefined && isFinite(providedNI.parent) && Math.abs(providedNI.parent - netIncome.parent) > 0.5)
    warnings.push({
      level: "info",
      text: `Parent's stated Net Income (${money(providedNI.parent)}) differs from the sum of its P&L lines (${money(netIncome.parent)}).`,
    });
  if (providedNI.sub !== undefined && isFinite(providedNI.sub) && Math.abs(providedNI.sub - netIncome.sub) > 0.5)
    warnings.push({
      level: "info",
      text: `Subsidiary's stated Net Income (${money(providedNI.sub)}) differs from the sum of its P&L lines (${money(netIncome.sub)}).`,
    });

  if (Math.abs(bsSection.assets.parent + (bsSection.liabilities.parent + bsSection.equity.parent)) > 0.5)
    warnings.push({
      level: "warn",
      text: `The parent balance sheet doesn't balance on its own (assets ≠ liabilities + equity).`,
    });
  if (Math.abs(bsSection.assets.sub + (bsSection.liabilities.sub + bsSection.equity.sub)) > 0.5)
    warnings.push({
      level: "warn",
      text: `The subsidiary balance sheet doesn't balance on its own (assets ≠ liabilities + equity).`,
    });

  const consolBalance = round(
    bsSection.assets.consolidated + bsSection.liabilities.consolidated + bsSection.equity.consolidated,
  );
  const balanced = Math.abs(consolBalance) < 0.5;
  if (!balanced)
    warnings.push({ level: "error", text: `Consolidated balance sheet is OUT OF BALANCE by ${money(Math.abs(consolBalance))}.` });

  const cyNI = bsRows.filter((r) =>
    /current year net income|net income for the (year|period)|profit for the (year|period)|current period (net )?income/.test(
      r.key,
    ),
  );
  if (cyNI.length) {
    const cyConsol = round(cyNI.reduce((a, r) => a + r.consolidated, 0));
    if (Math.abs(-cyConsol - netIncome.consolidated) > 0.5)
      warnings.push({
        level: "warn",
        text: `Consolidated net income on the P&L (${money(netIncome.consolidated)}) doesn't tie to current-year net income on the balance sheet (${money(-cyConsol)}).`,
      });
  }

  const strip = (rows: MutableRow[]): WorksheetRow[] =>
    rows.map(({ _i, ...r }) => r);

  return {
    pnl: { rows: strip(pnlRows), totals: pnlTotals, netIncome, groups: PNL_GROUPS },
    bs: { rows: strip(bsRows), totals: bsTotals, section: bsSection, groups: BS_GROUPS, balanced, consolBalance },
    eliminations,
    warnings,
    providedNI,
  };
}
