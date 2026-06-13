/* Upload screen — four labeled CSV slots, sample-data shortcut, and a list of
   the user's previously saved datasets (persisted server-side). */
import { useRef, useState } from "react";
import { Icons } from "@/components/icons";
import { Spinner } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SAMPLE_DATA, previewRowCount } from "@/lib/sampleData";
import type { DatasetSummary, SlotKey } from "@/lib/types";

export interface LocalFile {
  name: string;
  text: string;
  accounts: number;
  fatal: boolean;
}
export type FileMap = Partial<Record<SlotKey, LocalFile>>;

interface SlotDef {
  key: SlotKey;
  entity: "Parent" | "Subsidiary";
  statement: string;
}
const SLOTS: SlotDef[] = [
  { key: "parentPnl", entity: "Parent", statement: "Profit & Loss" },
  { key: "parentBs", entity: "Parent", statement: "Balance Sheet" },
  { key: "subPnl", entity: "Subsidiary", statement: "Profit & Loss" },
  { key: "subBs", entity: "Subsidiary", statement: "Balance Sheet" },
];

function makeLocalFile(name: string, text: string): LocalFile {
  const { accounts, ok } = previewRowCount(text);
  return { name, text, accounts, fatal: !ok };
}

interface UploadScreenProps {
  files: FileMap;
  setFiles: React.Dispatch<React.SetStateAction<FileMap>>;
  name: string;
  setName: (n: string) => void;
  datasets: DatasetSummary[];
  running: boolean;
  error: string;
  onRun: () => void;
  onOpenDataset: (id: string) => void;
  onDeleteDataset: (id: string) => void;
}

export function UploadScreen({
  files,
  setFiles,
  name,
  setName,
  datasets,
  running,
  error,
  onRun,
  onOpenDataset,
  onDeleteDataset,
}: UploadScreenProps) {
  const readyCount = SLOTS.filter((s) => files[s.key] && !files[s.key]!.fatal).length;
  const allReady = SLOTS.every((s) => files[s.key] && !files[s.key]!.fatal);
  const anyLoaded = SLOTS.some((s) => files[s.key]);

  const handleFile = (key: SlotKey, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      setFiles((prev) => ({ ...prev, [key]: makeLocalFile(file.name, text) }));
    };
    reader.readAsText(file);
  };

  const loadSample = () => {
    const next: FileMap = {};
    for (const s of SLOTS) {
      const sample = SAMPLE_DATA[s.key];
      next[s.key] = makeLocalFile(sample.name, sample.text);
    }
    setFiles(next);
  };

  const clearAll = () => setFiles({});

  return (
    <div className="up-screen fade-in">
      <header className="up-head">
        <div>
          <div className="mono-label" style={{ marginBottom: 8 }}>
            Step 1 of 2 · Import
          </div>
          <h1 className="up-title">Upload your statements</h1>
          <p className="up-lead">
            Drop in four CSVs — the parent and subsidiary income statement and balance sheet. Each file needs an{" "}
            <span className="code">Account</span>, <span className="code">Account Type</span>, and{" "}
            <span className="code">Amount</span> column.
          </p>
        </div>
        <div className="up-head-actions">
          <Button variant="soft" onClick={loadSample}>
            <Icons.sparkle size={16} /> Load sample data
          </Button>
          {anyLoaded && (
            <Button variant="ghost" size="sm" onClick={clearAll}>
              Clear all
            </Button>
          )}
        </div>
      </header>

      <div className="up-grid">
        {(["Parent", "Subsidiary"] as const).map((entity) => (
          <div className="up-col" key={entity}>
            <div className="up-col-head">
              <span className={`entity-dot ${entity === "Parent" ? "dot-parent" : "dot-sub"}`}></span>
              {entity} company
            </div>
            {SLOTS.filter((s) => s.entity === entity).map((slot) => (
              <UploadSlot
                key={slot.key}
                statement={slot.statement}
                file={files[slot.key]}
                onFile={(f) => handleFile(slot.key, f)}
                onRemove={() =>
                  setFiles((prev) => {
                    const n = { ...prev };
                    delete n[slot.key];
                    return n;
                  })
                }
              />
            ))}
          </div>
        ))}
      </div>

      {error && (
        <div className="auth-error fade-in" style={{ marginTop: 22 }}>
          <Icons.alert size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="up-footer">
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <div className="up-progress">
            <span className="num">{readyCount}</span>
            <span className="up-progress-lbl">of 4 statements ready</span>
          </div>
          {anyLoaded && (
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name this consolidation (optional)"
              style={{ width: 280 }}
            />
          )}
        </div>
        <Button size="lg" disabled={!allReady || running} onClick={onRun}>
          {running ? (
            <>
              <Spinner color="#fff" /> Saving & consolidating…
            </>
          ) : (
            <>
              Run consolidation <Icons.arrowRight size={18} />
            </>
          )}
        </Button>
      </div>

      {datasets.length > 0 && (
        <section className="up-recent">
          <div className="up-recent-head">
            <Icons.layers size={17} /> Saved consolidations
          </div>
          <div className="up-recent-list">
            {datasets.map((ds) => (
              <div className="recent-row" key={ds.id}>
                <div className="recent-ic">
                  <Icons.doc size={18} />
                </div>
                <div className="recent-body">
                  <div className="recent-name">{ds.name}</div>
                  <div className="recent-meta">
                    {ds.statements.length} of 4 statements · {formatDate(ds.createdAt)}
                  </div>
                </div>
                <div className="recent-actions">
                  <Button variant="soft" size="sm" disabled={!ds.complete} onClick={() => onOpenDataset(ds.id)}>
                    Open
                  </Button>
                  <button className="slot-remove" style={{ position: "static" }} onClick={() => onDeleteDataset(ds.id)} aria-label="Delete dataset">
                    <Icons.trash size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function UploadSlot({
  statement,
  file,
  onFile,
  onRemove,
}: {
  statement: string;
  file?: LocalFile;
  onFile: (f: File) => void;
  onRemove: () => void;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) onFile(f);
  };

  const ready = file && !file.fatal;
  const fatal = file && file.fatal;

  return (
    <div
      className={`slot ${ready ? "slot-ready" : ""} ${fatal ? "slot-error" : ""} ${drag ? "slot-drag" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      onClick={() => !file && inputRef.current?.click()}
      role="button"
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />

      <div className="slot-icon">
        {ready ? <Icons.checkCircle size={22} /> : fatal ? <Icons.alert size={22} /> : <Icons.upload size={20} />}
      </div>

      <div className="slot-body">
        <div className="slot-statement">{statement}</div>
        {!file && (
          <div className="slot-hint">
            Drop CSV or <span className="link">browse</span>
          </div>
        )}
        {file && !file.fatal && (
          <div className="slot-meta">
            <span className="slot-filename">{file.name}</span>
            <span className="slot-rows">{file.accounts} accounts</span>
          </div>
        )}
        {fatal && (
          <div className="slot-meta">
            <span className="slot-filename">{file.name}</span>
            <span className="slot-rows slot-rows-err">Couldn't read any rows</span>
          </div>
        )}
      </div>

      {file && (
        <button
          className="slot-remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label="Remove file"
        >
          <Icons.x size={16} />
        </button>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}
