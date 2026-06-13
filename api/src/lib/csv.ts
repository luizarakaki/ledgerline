/**
 * CSV parsing for the statement format: header row + Account, Account Type, Amount.
 * Ported from the design prototype's lib/data.js — robust to quoted fields,
 * commas inside quotes, $ and thousands separators, and parentheses-negatives.
 * Nothing here is hardcoded to the sample files; columns are matched by alias.
 */

export interface LineItem {
  account: string;
  type: string;
  amount: number;
}

export interface ParsedStatement {
  items: LineItem[];
  errors: string[];
}

/** Tokenize CSV text into a matrix of string fields. */
export function parseCSV(input: string): string[][] {
  const rows: string[][] = [];
  let i = 0;
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  const pushField = () => {
    record.push(field);
    field = "";
  };
  const pushRecord = () => {
    pushField();
    if (record.length > 1 || record[0] !== "") rows.push(record);
    record = [];
  };
  const text = String(input).replace(/^﻿/, ""); // strip BOM
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      pushField();
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      pushRecord();
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field !== "" || record.length) pushRecord();
  return rows;
}

/** Parse a number like "1,234", "$1,200", "(500)" -> -500, "-50000". */
export function parseAmount(raw: unknown): number {
  if (raw == null) return NaN;
  let s = String(raw).trim();
  if (s === "") return NaN;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[$,\s]/g, "");
  if (s.startsWith("-")) {
    neg = !neg;
    s = s.slice(1);
  }
  const n = Number(s);
  if (!isFinite(n)) return NaN;
  return neg ? -n : n;
}

/** Parse a statement CSV into normalized line items. */
export function parseStatement(text: string): ParsedStatement {
  const rows = parseCSV(text);
  const errors: string[] = [];
  if (!rows.length) return { items: [], errors: ["File is empty."] };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const findCol = (...aliases: string[]): number => {
    for (const a of aliases) {
      const idx = header.findIndex(
        (h) => h === a || h.replace(/[^a-z]/g, "") === a.replace(/[^a-z]/g, ""),
      );
      if (idx !== -1) return idx;
    }
    return -1;
  };
  let cAcct = findCol("account", "account name", "name", "line item");
  let cType = findCol("account type", "type", "category");
  let cAmt = findCol("amount", "balance", "value", "usd");

  let dataStart = 1;
  if (cAcct === -1 && cAmt === -1) {
    cAcct = 0;
    cType = 1;
    cAmt = 2;
    dataStart = 0;
    errors.push("No header row detected — assumed columns: Account, Account Type, Amount.");
  } else {
    if (cAcct === -1) cAcct = 0;
    if (cAmt === -1) cAmt = cType === 2 ? 1 : 2;
  }

  const items: LineItem[] = [];
  for (let r = dataStart; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((x) => String(x).trim() === "")) continue;
    const account = (row[cAcct] || "").trim();
    if (!account) continue;
    const type = cType !== -1 ? (row[cType] || "").trim() : "";
    const amount = parseAmount(row[cAmt]);
    if (!isFinite(amount)) {
      errors.push(`Couldn't read an amount for "${account}".`);
      continue;
    }
    items.push({ account, type, amount });
  }
  if (!items.length) errors.push("No data rows found.");
  return { items, errors };
}
