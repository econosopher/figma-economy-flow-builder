import { useEffect, useState } from "react";
import { Sparkles, Copy, ArrowRight, LoaderCircle } from "lucide-react";
import { Modal } from "./Modal";
import { api, type AppConfig } from "../lib/api";
import {
  createResearchBrief,
  createEconomyJsonPrompt,
} from "../../../src/research-contract";
import { validateDocument, type EconomyDocument } from "../core/document";
interface Job {
  id: string;
  status: string;
  progress: number;
  brief?: string;
  error?: string;
  result?: { document: EconomyDocument; notices: string[] };
}
export function ResearchDialog({
  config,
  signedIn,
  onClose,
  onApply,
  onSignIn,
}: {
  config: AppConfig;
  signedIn: boolean;
  onClose: () => void;
  onApply: (d: EconomyDocument) => void;
  onSignIn: () => void;
}) {
  const [game, setGame] = useState(""),
    [depth, setDepth] = useState(2),
    [provider, setProvider] = useState("gemini"),
    [key, setKey] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [job, setJob] = useState<Job | null>(null),
    [jobId, setJobId] = useState(
      sessionStorage.getItem("flow-research-job") || "",
    );
  useEffect(() => {
    if (!jobId || !signedIn) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const j = await api<Job>(`/research/${jobId}`);
        if (cancelled) return;
        setJob(j);
        if (!["completed", "failed", "cancelled"].includes(j.status))
          timer = setTimeout(poll, 2500);
        else sessionStorage.removeItem("flow-research-job");
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Could not load research.");
      }
    };
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobId, signedIn]);
  async function generate() {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ id: string }>("/research", {
        method: "POST",
        body: JSON.stringify({ gameName: game, depth, provider, apiKey: key }),
      });
      setKey("");
      setJobId(r.id);
      sessionStorage.setItem("flow-research-job", r.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start research.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Start with research"
      description="Explore a game economy, then make it your own."
      onClose={onClose}
    >
      {!jobId ? (
        <>
          <label className="field">
            Game name
            <input
              autoFocus
              value={game}
              onChange={(e) => setGame(e.target.value)}
              placeholder="e.g. Helldivers 2"
              maxLength={200}
            />
          </label>
          <div className="field-pair">
            <label className="field">
              Depth
              <select
                value={depth}
                onChange={(e) => setDepth(Number(e.target.value))}
              >
                <option value={1}>Core loop</option>
                <option value={2}>Systems & resources</option>
                <option value={3}>Full economy</option>
              </select>
            </label>
            <label className="field">
              Provider
              <select
                value={provider}
                onChange={(e) => {
                  setProvider(e.target.value);
                  setKey("");
                }}
              >
                <option value="gemini">Google Gemini</option>
                <option value="openai">OpenAI</option>
                <option value="claude">Claude</option>
              </select>
            </label>
          </div>
          <label className="field">
            Your API key
            <input
              type="password"
              autoComplete="off"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Used for this research job only"
            />
          </label>
          <p className="helper">
            Usage is billed to your provider account. The key is encrypted for
            the job and removed afterward. The original diagram stays intact
            until you apply the draft.
          </p>
          {signedIn ? (
            <button
              className="button primary full"
              disabled={
                !config.research || busy || !game.trim() || key.length < 20
              }
              onClick={generate}
            >
              <Sparkles size={16} />
              Research economy
            </button>
          ) : (
            <button
              className="button primary full"
              disabled={!config.cloud}
              onClick={onSignIn}
            >
              Sign in to run research
            </button>
          )}
          {!config.research && (
            <p className="helper">
              Hosted research is not activated yet. You can copy the research
              brief and import the resulting JSON.
            </p>
          )}
          <button
            className="text-button"
            disabled={!game.trim()}
            onClick={() =>
              navigator.clipboard.writeText(
                `${createResearchBrief(game, depth)}\n\n${createEconomyJsonPrompt(game, depth)}`,
              )
            }
          >
            <Copy size={14} />
            Copy research instructions
          </button>
        </>
      ) : (
        <div className="research-progress">
          {job?.status === "completed" ? (
            <>
              <span className="success">
                <Sparkles size={18} />
                Your draft is ready
              </span>
              <h3>{job.result?.document.name}</h3>
              <p>
                {job.result?.document.cards.length} cards ·{" "}
                {job.result?.document.edges.length} pipes
              </p>
              {job.result?.notices.map((n, i) => (
                <p className="helper" key={i}>
                  {n}
                </p>
              ))}
              <button
                className="button primary full"
                onClick={() => {
                  if (job.result)
                    onApply(validateDocument(job.result.document));
                }}
              >
                <ArrowRight size={16} />
                Open draft as a new diagram
              </button>
            </>
          ) : job?.status === "failed" || job?.status === "cancelled" ? (
            <>
              <p className="error-box">{job.error || "Research cancelled."}</p>
              <button
                className="button"
                onClick={() => {
                  setJobId("");
                  setJob(null);
                }}
              >
                Start again
              </button>
            </>
          ) : (
            <>
              <LoaderCircle className="spin" size={25} />
              <h3>
                {job?.status === "building"
                  ? "Building your diagram…"
                  : "Researching the economy…"}
              </h3>
              <progress max="100" value={job?.progress || 5} />
              <p className="helper">
                You can close this window and return while research continues.
              </p>
              <button
                className="button"
                onClick={async () => {
                  try {
                    await api(`/research/${jobId}`, { method: "DELETE" });
                    setJob((j) => (j ? { ...j, status: "cancelled" } : null));
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : "Could not cancel.",
                    );
                  }
                }}
              >
                Cancel research
              </button>
            </>
          )}
          {job?.brief && (
            <details>
              <summary>Research and sources</summary>
              <pre className="research-brief">{job.brief}</pre>
            </details>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="error-box">
          {error}
        </p>
      )}
    </Modal>
  );
}
