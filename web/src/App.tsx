/* Root app — session bootstrap, navigation, top bar, run orchestration. */
import { useEffect, useState } from "react";
import { Icons } from "@/components/icons";
import { Logo, Spinner } from "@/components/primitives";
import { AuthScreen } from "@/screens/AuthScreen";
import { UploadScreen, type FileMap } from "@/screens/UploadScreen";
import { ResultScreen } from "@/screens/ResultScreen";
import { api, ApiError } from "@/lib/api";
import type { ConsolidationResult, DatasetSummary, SlotKey, User } from "@/lib/types";

type Step = "upload" | "result";

export default function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const [step, setStep] = useState<Step>("upload");
  const [files, setFiles] = useState<FileMap>({});
  const [name, setName] = useState("");
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [result, setResult] = useState<ConsolidationResult | null>(null);
  const [resultTitle, setResultTitle] = useState("Consolidated results");
  const [running, setRunning] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Bootstrap the session from the cookie.
  useEffect(() => {
    api
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null))
      .finally(() => setBooting(false));
  }, []);

  const refreshDatasets = () => {
    api
      .listDatasets()
      .then(({ datasets }) => setDatasets(datasets))
      .catch(() => {});
  };

  useEffect(() => {
    if (user) refreshDatasets();
  }, [user]);

  const onAuthed = (u: User) => {
    setUser(u);
    setStep("upload");
  };

  const signOut = async () => {
    await api.signOut().catch(() => {});
    setUser(null);
    setFiles({});
    setResult(null);
    setDatasets([]);
    setStep("upload");
  };

  // Save the uploaded CSVs as a dataset, then consolidate it server-side.
  const run = async () => {
    setRunning(true);
    setUploadError("");
    try {
      const payload: Partial<Record<SlotKey, { filename: string; text: string }>> = {};
      (Object.keys(files) as SlotKey[]).forEach((k) => {
        const f = files[k];
        if (f) payload[k] = { filename: f.name, text: f.text };
      });
      const { dataset } = await api.createDataset(payload, name || undefined);
      await openDataset(dataset.id, dataset.name);
      refreshDatasets();
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Couldn't run the consolidation.");
    } finally {
      setRunning(false);
    }
  };

  const openDataset = async (id: string, dsName?: string) => {
    const { dataset, result } = await api.consolidate(id);
    setResult(result);
    setResultTitle(dsName || dataset.name || "Consolidated results");
    setStep("result");
    window.scrollTo({ top: 0 });
  };

  const handleOpenDataset = async (id: string) => {
    setUploadError("");
    try {
      await openDataset(id);
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Couldn't open that dataset.");
    }
  };

  const handleDeleteDataset = async (id: string) => {
    await api.deleteDataset(id).catch(() => {});
    refreshDatasets();
  };

  if (booting) {
    return (
      <div className="app-loading">
        <Spinner size={28} color="var(--accent)" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onAuthed={onAuthed} />;
  }

  return (
    <div className="app-shell">
      <TopBar
        user={user}
        step={step}
        onSignOut={signOut}
        onUploadTab={() => setStep("upload")}
        onResultTab={result ? () => setStep("result") : null}
      />
      <div className="app-main">
        {step !== "result" || !result ? (
          <UploadScreen
            files={files}
            setFiles={setFiles}
            name={name}
            setName={setName}
            datasets={datasets}
            running={running}
            error={uploadError}
            onRun={run}
            onOpenDataset={handleOpenDataset}
            onDeleteDataset={handleDeleteDataset}
          />
        ) : (
          <ResultScreen result={result} title={resultTitle} onBack={() => setStep("upload")} />
        )}
      </div>
    </div>
  );
}

function TopBar({
  user,
  step,
  onSignOut,
  onUploadTab,
  onResultTab,
}: {
  user: User;
  step: Step;
  onSignOut: () => void;
  onUploadTab: () => void;
  onResultTab: (() => void) | null;
}) {
  const [menu, setMenu] = useState(false);
  const initials = (user.name || user.email || "?")
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <header className="topbar">
      <div className="topbar-left">
        <Logo size={28} />
      </div>
      <nav className="topbar-nav">
        <button className={`tnav ${step === "upload" ? "on" : ""}`} onClick={onUploadTab}>
          <span className="tnav-step">1</span> Files
        </button>
        <span className="tnav-sep">
          <Icons.chevron size={14} style={{ transform: "rotate(-90deg)" }} />
        </span>
        <button
          className={`tnav ${step === "result" ? "on" : ""} ${!onResultTab ? "tnav-disabled" : ""}`}
          onClick={() => onResultTab && onResultTab()}
          disabled={!onResultTab}
        >
          <span className="tnav-step">2</span> Consolidation
        </button>
      </nav>
      <div className="topbar-right">
        <div className="user-menu">
          <button className="user-chip" onClick={() => setMenu((m) => !m)}>
            <span className="user-avatar">{initials}</span>
            <span className="user-name">{user.name || user.email}</span>
            <Icons.chevron size={15} />
          </button>
          {menu && (
            <>
              <div className="menu-backdrop" onClick={() => setMenu(false)} />
              <div className="user-dropdown fade-in">
                <div className="ud-head">
                  <div className="ud-name">{user.name}</div>
                  <div className="ud-email">{user.email}</div>
                </div>
                <button className="ud-item" onClick={onSignOut}>
                  <Icons.logout size={16} /> Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
