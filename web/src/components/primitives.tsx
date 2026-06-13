/* Shared presentational primitives: Logo, Spinner, Amount, NotePopover. */
import * as React from "react";
import { useEffect, useRef, useState } from "react";

/* ---------------- number formatting ---------------- */
export function fmtMoney(n: number | null | undefined, { decimals = 0 }: { decimals?: number } = {}): string {
  if (n == null || !isFinite(n)) return "—";
  const v = Math.abs(n);
  return v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// accounting-style cell: 0 -> dash, negatives in parentheses
export function Amount({
  value,
  dim = false,
  bold = false,
  accent = false,
}: {
  value: number | null | undefined;
  dim?: boolean;
  bold?: boolean;
  accent?: boolean;
}) {
  if (value == null || !isFinite(value)) return <span className="num amt amt-zero">—</span>;
  if (Math.round(value) === 0) return <span className="num amt amt-zero">—</span>;
  const neg = value < 0;
  const cls = ["num", "amt"];
  if (neg) cls.push("amt-neg");
  if (dim) cls.push("amt-dim");
  if (bold) cls.push("amt-bold");
  if (accent) cls.push("amt-accent");
  const body = fmtMoney(Math.abs(value));
  return <span className={cls.join(" ")}>{neg ? `(${body})` : body}</span>;
}

/* ---------------- brand mark ---------------- */
export function Logo({ size = 30, withText = true }: { size?: number; withText?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="var(--accent)" />
        <rect x="8" y="8" width="7" height="16" rx="2" fill="#fff" opacity="0.95" />
        <rect x="17" y="8" width="7" height="16" rx="2" fill="#fff" opacity="0.55" />
        <rect x="8" y="14.5" width="16" height="3" rx="1.5" fill="var(--accent)" />
      </svg>
      {withText && (
        <span style={{ fontWeight: 800, fontSize: size * 0.6, letterSpacing: "-0.03em", color: "var(--ink)" }}>
          Ledgerline
        </span>
      )}
    </div>
  );
}

/* ---------------- spinner ---------------- */
export function Spinner({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: "spin 0.7s linear infinite" }}>
      <circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeWidth="3" opacity="0.25" />
      <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ---------------- tooltip / popover for elimination notes ---------------- */
interface PopPos {
  top: number;
  left: number;
  w: number;
  below: boolean;
}
export function NotePopover({ children, content }: { children: React.ReactNode; content: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<PopPos>({ top: 0, left: 0, w: 440, below: true });
  useEffect(() => {
    if (!open || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    // Wide enough that the longest elimination title fits beside the pill
    // on a single line, clamped so it never exceeds a narrow viewport.
    const w = Math.min(440, window.innerWidth - 24);
    let left = r.left + r.width / 2 - w / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - w - 12));
    let top = r.bottom + 8;
    let below = true;
    if (top + 180 > window.innerHeight) {
      top = r.top - 8;
      below = false;
    }
    setPos({ top, left, w, below });
  }, [open]);
  return (
    <span
      ref={ref}
      className="note-trigger"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => {
        e.stopPropagation();
        setOpen((o) => !o);
      }}
    >
      {children}
      {open && content && (
        <div
          className="note-pop fade-in"
          style={{
            position: "fixed",
            top: pos.below ? pos.top : undefined,
            bottom: pos.below ? undefined : window.innerHeight - pos.top,
            left: pos.left,
            width: pos.w,
            zIndex: 200,
          }}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          {content}
        </div>
      )}
    </span>
  );
}
