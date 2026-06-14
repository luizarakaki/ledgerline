/* Client-side table export — CSV and XLSX. Format-agnostic: callers pass a
   SheetData matrix and pick a format. Used by the results screen to download
   the consolidation worksheet (one file per statement). */

export type Cell = string | number | null;

export interface SheetData {
  /** Base file name, without extension. */
  filename: string;
  header: string[];
  rows: Cell[][];
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Filename-safe slug from a dataset title. */
export function slugify(title: string): string {
  const s = (title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "consolidation";
}

/** Trigger a browser download for a blob. */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after the click has been processed.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Escape a single CSV field. */
function csvField(value: Cell): string {
  if (value == null) return "";
  const s = typeof value === "number" ? String(value) : value;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(sheet: SheetData): void {
  const matrix = [sheet.header, ...sheet.rows];
  const text = matrix.map((row) => row.map(csvField).join(",")).join("\r\n");
  // BOM so Excel reads UTF-8 correctly.
  triggerDownload(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }), `${sheet.filename}.csv`);
}

async function downloadXlsx(sheet: SheetData): Promise<void> {
  // Dynamic import keeps the (sizeable) xlsx writer out of the main bundle.
  const { default: writeXlsxFile } = await import("write-excel-file");

  const headerRow = sheet.header.map((h) => ({ value: h, fontWeight: "bold" as const }));
  const dataRows = sheet.rows.map((row) =>
    row.map((cell) => {
      if (cell == null) return null;
      if (typeof cell === "number") return { value: cell, type: Number };
      return { value: cell, type: String };
    }),
  );
  const columns = sheet.header.map((_, i) => ({ width: i === 0 ? 36 : 16 }));

  await writeXlsxFile([headerRow, ...dataRows], { fileName: `${sheet.filename}.xlsx`, columns });
}

/** Download each sheet as its own file, sequentially. Browsers may show a
    one-time "download multiple files" prompt for the second file. */
export async function downloadTables(format: "csv" | "xlsx", sheets: SheetData[]): Promise<void> {
  for (let i = 0; i < sheets.length; i++) {
    if (format === "csv") downloadCsv(sheets[i]);
    else await downloadXlsx(sheets[i]);
    if (i < sheets.length - 1) await sleep(200);
  }
}
