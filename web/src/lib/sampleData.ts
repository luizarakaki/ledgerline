/* The four sample CSVs, bundled client-side for the "Load sample data" button.
   These get uploaded to the server exactly like user-provided files. */
import type { SlotKey } from "./types";

export const SAMPLE_DATA: Record<SlotKey, { name: string; text: string }> = {
  parentPnl: {
    name: "Parent_PnL.csv",
    text: `Account,Account Type,Amount
Revenue - External Customers,Revenue,600000
Subsidiary Revenue,Revenue,25000
Cost of Goods Sold,COGS,-220000
Salaries & Wages,Operating Expense,-180000
Rent Expense,Operating Expense,-42000
Software & Subscriptions,Operating Expense,-24000
Marketing Expense,Operating Expense,-30000
Depreciation Expense,Operating Expense,-15000
Interest Expense,Other Expense,-6000
Net Income,Net Income,108000`,
  },
  parentBs: {
    name: "Parent_BalanceSheet.csv",
    text: `Account,Account Type,Amount
Cash,Asset,150000
Accounts Receivable,Asset,95000
Due from Subsidiary,Asset,10000
Inventory,Asset,55000
Investment in Subsidiary,Asset,100000
Property Plant & Equipment,Asset,220000
Accumulated Depreciation,Asset,-50000
Accounts Payable,Liability,-40000
Accrued Expenses,Liability,-18000
Long-term Debt,Liability,-110000
Common Stock,Equity,-150000
Retained Earnings,Equity,-154000
Current Year Net Income,Equity,-108000`,
  },
  subPnl: {
    name: "Subsidiary_PnL.csv",
    text: `Account,Account Type,Amount
Revenue - External Customers,Revenue,320000
Cost of Goods Sold,COGS,-95000
Parent Company Fees,Operating Expense,-25000
Salaries & Wages,Operating Expense,-110000
Rent Expense,Operating Expense,-28000
Software & Subscriptions,Operating Expense,-14000
Marketing Expense,Operating Expense,-16000
Depreciation Expense,Operating Expense,-8000
Interest Income,Other Income,1500
Net Income,Net Income,25500`,
  },
  subBs: {
    name: "Subsidiary_BalanceSheet.csv",
    text: `Account,Account Type,Amount
Cash,Asset,75000
Accounts Receivable,Asset,62000
Inventory,Asset,30000
Property Plant & Equipment,Asset,120000
Accumulated Depreciation,Asset,-25000
Accounts Payable,Liability,-28000
Due to Parent,Liability,-10000
Accrued Expenses,Liability,-12000
Long-term Debt,Liability,-60000
Common Stock,Equity,-100000
Retained Earnings,Equity,-26500
Current Year Net Income,Equity,-25500`,
  },
};

/** Lightweight client-side CSV row counter for upload previews (before server save). */
export function previewRowCount(text: string): { accounts: number; ok: boolean } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  // minus header if present
  const accounts = Math.max(0, lines.length - 1);
  return { accounts, ok: accounts > 0 };
}
