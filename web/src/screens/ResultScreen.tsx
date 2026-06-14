/* Result screen — consolidation worksheet, clean statement view, validation. */
import { useMemo, useState } from "react";
import { Icons } from "@/components/icons";
import { Amount, fmtMoney, NotePopover } from "@/components/primitives";
import { downloadTables, slugify, type Cell, type SheetData } from "@/lib/export";
import type { ConsolidationResult, Elimination, Warning, WorksheetRow } from "@/lib/types";

const WORKSHEET_HEADER = ["Account", "Parent", "Subsidiary", "Eliminations", "Consolidated"];

interface ResultScreenProps {
  result: ConsolidationResult;
  title: string;
  onBack: () => void;
}

export function ResultScreen({ result, title, onBack }: ResultScreenProps) {
  const [view, setView] = useState<"worksheet" | "statements">("worksheet");
  const [dlOpen, setDlOpen] = useState(false);
  const elimById = useMemo(() => {
    const m: Record<string, Elimination> = {};
    (result.eliminations || []).forEach((e) => (m[e.id] = e));
    return m;
  }, [result]);

  const errors = result.warnings.filter((w) => w.level === "error");
  const warns = result.warnings.filter((w) => w.level === "warn");
  const infos = result.warnings.filter((w) => w.level === "info");

  // Export always uses the full worksheet (Parent | Subsidiary | Eliminations |
  // Consolidated), one file per statement, regardless of the on-screen view.
  const exportAs = (format: "csv" | "xlsx") => {
    const base = slugify(title);
    const sheets: SheetData[] = [
      { filename: `${base}-profit-and-loss`, header: WORKSHEET_HEADER, rows: toWorksheetMatrix(buildPnlRows(result.pnl)) },
      { filename: `${base}-balance-sheet`, header: WORKSHEET_HEADER, rows: toWorksheetMatrix(buildBsRows(result.bs)) },
    ];
    void downloadTables(format, sheets);
    setDlOpen(false);
  };

  return (
    <div className="res-screen fade-in">
      <header className="res-head">
        <div className="res-head-left">
          <button className="btn btn-ghost btn-sm" onClick={onBack}>
            <Icons.arrowLeft size={16} /> Files
          </button>
          <div>
            <div className="mono-label" style={{ marginBottom: 6 }}>
              Step 2 of 2 · {title}
            </div>
            <h1 className="res-title">Parent + Subsidiary consolidation</h1>
          </div>
        </div>
        <div className="res-head-right">
          <BalanceBadge result={result} />
          <div className="dl-menu">
            <button className="btn btn-ghost btn-sm" onClick={() => setDlOpen((o) => !o)} aria-haspopup="menu" aria-expanded={dlOpen}>
              <Icons.download size={15} /> Download <Icons.chevron size={14} />
            </button>
            {dlOpen && (
              <>
                <div className="menu-backdrop" onClick={() => setDlOpen(false)} />
                <div className="dl-dropdown fade-in" role="menu">
                  <button className="dl-item" role="menuitem" onClick={() => exportAs("csv")}>
                    <Icons.doc size={15} /> CSV
                  </button>
                  <button className="dl-item" role="menuitem" onClick={() => exportAs("xlsx")}>
                    <Icons.table size={15} /> Excel (.xlsx)
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="view-toggle" role="tablist">
            <button role="tab" className={view === "worksheet" ? "on" : ""} onClick={() => setView("worksheet")}>
              <Icons.table size={15} /> Worksheet
            </button>
            <button role="tab" className={view === "statements" ? "on" : ""} onClick={() => setView("statements")}>
              <Icons.doc size={15} /> Statements
            </button>
          </div>
        </div>
      </header>

      <ValidationPanel errors={errors} warns={warns} infos={infos} />

      {view === "worksheet" ? (
        <div className="res-body">
          <Worksheet title="Consolidated Profit & Loss" rows={buildPnlRows(result.pnl)} elimById={elimById} />
          <Worksheet title="Consolidated Balance Sheet" rows={buildBsRows(result.bs)} elimById={elimById} />
          <WorksheetLegend />
        </div>
      ) : (
        <div className="res-body res-body-statements">
          <Statement title="Consolidated Profit & Loss" rows={buildPnlStatement(result.pnl)} />
          <Statement title="Consolidated Balance Sheet" rows={buildBsStatement(result.bs)} />
        </div>
      )}
    </div>
  );
}

/* ---------------- balance badge ---------------- */
function BalanceBadge({ result }: { result: ConsolidationResult }) {
  const ok = result.bs.balanced;
  return (
    <div className={`bal-badge ${ok ? "bal-ok" : "bal-bad"}`}>
      {ok ? <Icons.checkCircle size={17} /> : <Icons.alert size={17} />}
      <span>{ok ? "Balance sheet balances" : `Out of balance by $${fmtMoney(Math.abs(result.bs.consolBalance))}`}</span>
    </div>
  );
}

/* ---------------- validation panel ---------------- */
function ValidationPanel({ errors, warns, infos }: { errors: Warning[]; warns: Warning[]; infos: Warning[] }) {
  const [open, setOpen] = useState(true);
  const total = errors.length + warns.length + infos.length;
  if (total === 0) {
    return (
      <div className="valid-panel valid-clean">
        <Icons.checkCircle size={18} />
        <span>
          <strong>All checks passed.</strong> Eliminations net to zero and the consolidated balance sheet balances.
        </span>
      </div>
    );
  }
  const tone = errors.length ? "valid-error" : warns.length ? "valid-warn" : "valid-info";
  return (
    <div className={`valid-panel ${tone}`}>
      <div className="valid-head" onClick={() => setOpen((o) => !o)}>
        <span className="valid-head-ic">
          {errors.length ? <Icons.alert size={18} /> : warns.length ? <Icons.alert size={18} /> : <Icons.info size={18} />}
        </span>
        <span className="valid-head-txt">
          {errors.length > 0 && (
            <strong>
              {errors.length} issue{errors.length > 1 ? "s" : ""} need attention
            </strong>
          )}
          {errors.length === 0 && warns.length > 0 && (
            <strong>
              {warns.length} warning{warns.length > 1 ? "s" : ""}
            </strong>
          )}
          {errors.length === 0 && warns.length === 0 && (
            <strong>
              {infos.length} note{infos.length > 1 ? "s" : ""}
            </strong>
          )}
        </span>
        <span className={`valid-chev ${open ? "open" : ""}`}>
          <Icons.chevron size={16} />
        </span>
      </div>
      {open && (
        <ul className="valid-list">
          {errors.map((w, i) => (
            <li key={"e" + i} className="vrow vrow-error">
              <Icons.alert size={15} />
              <span>{w.text}</span>
            </li>
          ))}
          {warns.map((w, i) => (
            <li key={"w" + i} className="vrow vrow-warn">
              <Icons.alert size={15} />
              <span>{w.text}</span>
            </li>
          ))}
          {infos.map((w, i) => (
            <li key={"i" + i} className="vrow vrow-info">
              <Icons.info size={15} />
              <span>{w.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ================= worksheet builders ================= */
type RowKind = "section" | "line" | "subtotal" | "subtotal-emph" | "total";
interface DisplayRow {
  kind: RowKind;
  label: string;
  parent?: number;
  sub?: number;
  elim?: number;
  consolidated?: number;
  notes?: string[];
}

function sumRows(list: WorksheetRow[]) {
  const s = (c: keyof WorksheetRow) => Math.round(list.reduce((a, r) => a + ((r[c] as number) || 0), 0));
  return { parent: s("parent"), sub: s("sub"), elim: s("elim"), consolidated: s("consolidated") };
}
const lineRow = (r: WorksheetRow): DisplayRow => ({
  kind: "line",
  label: r.account,
  parent: r.parent,
  sub: r.sub,
  elim: r.elim,
  consolidated: r.consolidated,
  notes: r.notes,
});
const sectionRow = (label: string): DisplayRow => ({ kind: "section", label });
const subtotalRow = (label: string, list: WorksheetRow[], emph = false): DisplayRow => ({
  kind: emph ? "subtotal-emph" : "subtotal",
  label,
  ...sumRows(list),
});
const totalRow = (label: string, list: WorksheetRow[]): DisplayRow => ({ kind: "total", label, ...sumRows(list) });

function buildPnlRows(pnl: ConsolidationResult["pnl"]): DisplayRow[] {
  const g = (name: string) => pnl.rows.filter((r) => r.group === name);
  const rev = g("Revenue"),
    cogs = g("COGS"),
    opex = g("Operating Expense"),
    oInc = g("Other Income"),
    oExp = g("Other Expense");
  const out: DisplayRow[] = [];
  if (rev.length) {
    out.push(sectionRow("Revenue"));
    rev.forEach((r) => out.push(lineRow(r)));
    out.push(subtotalRow("Total revenue", rev));
  }
  if (cogs.length) {
    out.push(sectionRow("Cost of goods sold"));
    cogs.forEach((r) => out.push(lineRow(r)));
    out.push(subtotalRow("Gross profit", [...rev, ...cogs], true));
  }
  if (opex.length) {
    out.push(sectionRow("Operating expenses"));
    opex.forEach((r) => out.push(lineRow(r)));
    out.push(subtotalRow("Total operating expenses", opex));
    out.push(subtotalRow("Operating income", [...rev, ...cogs, ...opex], true));
  }
  const other = [...oInc, ...oExp];
  if (other.length) {
    out.push(sectionRow("Other income & expense"));
    other.forEach((r) => out.push(lineRow(r)));
  }
  out.push(totalRow("Net income", pnl.rows));
  return out;
}

function buildBsRows(bs: ConsolidationResult["bs"]): DisplayRow[] {
  const g = (name: string) => bs.rows.filter((r) => r.group === name);
  const assets = g("Asset"),
    liab = g("Liability"),
    eq = g("Equity");
  const out: DisplayRow[] = [];
  out.push(sectionRow("Assets"));
  assets.forEach((r) => out.push(lineRow(r)));
  out.push(subtotalRow("Total assets", assets, true));
  out.push(sectionRow("Liabilities"));
  liab.forEach((r) => out.push(lineRow(r)));
  out.push(subtotalRow("Total liabilities", liab));
  out.push(sectionRow("Equity"));
  eq.forEach((r) => out.push(lineRow(r)));
  out.push(subtotalRow("Total equity", eq));
  out.push(totalRow("Total liabilities & equity", [...liab, ...eq]));
  return out;
}

/** Flatten worksheet display rows into an export matrix (raw numeric cells). */
function toWorksheetMatrix(rows: DisplayRow[]): Cell[][] {
  return rows.map((r) =>
    r.kind === "section"
      ? [r.label, null, null, null, null]
      : [r.label, r.parent ?? null, r.sub ?? null, r.elim ?? null, r.consolidated ?? null],
  );
}

/* ================= worksheet table ================= */
function Worksheet({ title, rows, elimById }: { title: string; rows: DisplayRow[]; elimById: Record<string, Elimination> }) {
  return (
    <section className="ws card">
      <div className="ws-title-bar">
        <h2 className="ws-title">{title}</h2>
      </div>
      <div className="ws-scroll">
        <table className="ws-table">
          <thead>
            <tr>
              <th className="ws-acct-col">Account</th>
              <th className="ws-num-col">Parent</th>
              <th className="ws-num-col">Subsidiary</th>
              <th className="ws-num-col ws-elim-col">Eliminations</th>
              <th className="ws-num-col ws-consol-col">Consolidated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <WsRow key={i} r={r} elimById={elimById} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function WsRow({ r, elimById }: { r: DisplayRow; elimById: Record<string, Elimination> }) {
  if (r.kind === "section") {
    return (
      <tr className="wr-section">
        <td colSpan={5}>{r.label}</td>
      </tr>
    );
  }
  const cls = {
    line: "wr-line",
    subtotal: "wr-subtotal",
    "subtotal-emph": "wr-subtotal wr-emph",
    total: "wr-total",
  }[r.kind];

  const hasNotes = !!(r.notes && r.notes.length > 0 && Math.round(r.elim || 0) !== 0);
  const elimContent = hasNotes ? (
    <div className="note-card">
      {r.notes!.map((id) => {
        const e = elimById[id];
        if (!e) return null;
        const leg = e.legs.find((l) => l.account.toLowerCase() === r.label.toLowerCase());
        return (
          <div key={id} className="note-entry">
            <div className="note-entry-head">
              <span className="pill pill-accent">{e.id}</span>
              <span className="note-entry-title">{e.title}</span>
            </div>
            <p className="note-entry-desc">{e.description}</p>
            {leg && (
              <div className="note-entry-leg">
                This line:{" "}
                <span className={`num ${leg.amount < 0 ? "amt-neg" : "amt-pos"}`}>
                  {leg.amount < 0 ? `(${fmtMoney(Math.abs(leg.amount))})` : fmtMoney(leg.amount)}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  ) : null;

  return (
    <tr className={cls}>
      <td className="wr-acct">{r.label}</td>
      <td className="wr-num">
        <Amount value={r.parent} dim={r.kind === "line"} />
      </td>
      <td className="wr-num">
        <Amount value={r.sub} dim={r.kind === "line"} />
      </td>
      <td className="wr-num wr-elim-cell">
        {hasNotes ? (
          <NotePopover content={elimContent}>
            <span className="elim-trigger">
              <Amount value={r.elim} accent />
              <sup className="elim-mark">{r.notes![0].replace(/^E-(PNL|BS)-/, "")}</sup>
            </span>
          </NotePopover>
        ) : (
          <Amount value={r.elim} accent={Math.round(r.elim || 0) !== 0} />
        )}
      </td>
      <td className="wr-num wr-consol-cell">
        <Amount value={r.consolidated} bold={r.kind !== "line"} />
      </td>
    </tr>
  );
}

function WorksheetLegend() {
  return (
    <div className="ws-legend">
      <div className="ws-legend-item">
        <Icons.info size={15} /> Figures follow trial-balance signs: <strong>revenue &amp; assets positive</strong>,{" "}
        <strong>expenses, liabilities &amp; equity negative</strong>. So{" "}
        <span className="code">Consolidated = Parent + Subsidiary + Eliminations</span> on every line.
      </div>
      <div className="ws-legend-item">
        <span className="elim-mark-demo">1</span> Hover any <span className="amt-accent num">elimination</span> figure to
        see the journal entry behind it.
      </div>
    </div>
  );
}

/* ================= clean statement view ================= */
interface StmtRow {
  kind: "section" | "line" | "subtotal" | "emph" | "total";
  label: string;
  value?: number;
}

function buildPnlStatement(pnl: ConsolidationResult["pnl"]): StmtRow[] {
  const g = (name: string) => pnl.rows.filter((r) => r.group === name);
  const rev = g("Revenue"),
    cogs = g("COGS"),
    opex = g("Operating Expense"),
    oInc = g("Other Income"),
    oExp = g("Other Expense");
  const C = (list: WorksheetRow[]) => Math.round(list.reduce((a, r) => a + r.consolidated, 0));
  const out: StmtRow[] = [];
  const liveRev = rev.filter((r) => Math.round(r.consolidated) !== 0);
  out.push({ kind: "section", label: "Revenue" });
  liveRev.forEach((r) => out.push({ kind: "line", label: r.account, value: r.consolidated }));
  out.push({ kind: "subtotal", label: "Total revenue", value: C(rev) });
  cogs.forEach((r) => out.push({ kind: "line", label: r.account, value: r.consolidated }));
  out.push({ kind: "emph", label: "Gross profit", value: C([...rev, ...cogs]) });
  out.push({ kind: "section", label: "Operating expenses" });
  opex.forEach((r) => out.push({ kind: "line", label: r.account, value: r.consolidated }));
  out.push({ kind: "emph", label: "Operating income", value: C([...rev, ...cogs, ...opex]) });
  const other = [...oInc, ...oExp];
  if (other.length) {
    out.push({ kind: "section", label: "Other income & expense" });
    other.forEach((r) => out.push({ kind: "line", label: r.account, value: r.consolidated }));
  }
  out.push({ kind: "total", label: "Net income", value: C(pnl.rows) });
  return out;
}

function buildBsStatement(bs: ConsolidationResult["bs"]): StmtRow[] {
  // statement view flips liabilities & equity to natural (positive) reading
  const g = (name: string) => bs.rows.filter((r) => r.group === name && Math.round(r.consolidated) !== 0);
  const gAll = (name: string) => bs.rows.filter((r) => r.group === name);
  const assets = g("Asset"),
    liab = g("Liability"),
    eq = g("Equity");
  const sumC = (list: WorksheetRow[]) => Math.round(list.reduce((a, r) => a + r.consolidated, 0));
  const out: StmtRow[] = [];
  out.push({ kind: "section", label: "Assets" });
  assets.forEach((r) => out.push({ kind: "line", label: r.account, value: r.consolidated }));
  out.push({ kind: "total", label: "Total assets", value: sumC(gAll("Asset")) });
  out.push({ kind: "section", label: "Liabilities" });
  liab.forEach((r) => out.push({ kind: "line", label: r.account, value: -r.consolidated }));
  out.push({ kind: "subtotal", label: "Total liabilities", value: -sumC(gAll("Liability")) });
  out.push({ kind: "section", label: "Equity" });
  eq.forEach((r) => out.push({ kind: "line", label: r.account, value: -r.consolidated }));
  out.push({ kind: "subtotal", label: "Total equity", value: -sumC(gAll("Equity")) });
  out.push({ kind: "total", label: "Total liabilities & equity", value: -sumC([...gAll("Liability"), ...gAll("Equity")]) });
  return out;
}

function Statement({ title, rows }: { title: string; rows: StmtRow[] }) {
  return (
    <section className="stmt card">
      <div className="stmt-title-bar">
        <h2 className="ws-title">{title}</h2>
        <span className="pill pill-muted">USD</span>
      </div>
      <table className="stmt-table">
        <tbody>
          {rows.map((r, i) => {
            if (r.kind === "section")
              return (
                <tr key={i} className="sr-section">
                  <td colSpan={2}>{r.label}</td>
                </tr>
              );
            const cls = { line: "sr-line", subtotal: "sr-subtotal", emph: "sr-emph", total: "sr-total" }[r.kind];
            return (
              <tr key={i} className={cls}>
                <td className="sr-label">{r.label}</td>
                <td className="sr-val">
                  <Amount value={r.value} bold={r.kind !== "line"} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
