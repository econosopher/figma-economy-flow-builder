import { ArrowRight, BookOpen } from "lucide-react";
import type { ReactNode } from "react";
import type { EconomyDocument } from "../core/document";
import { presetDescription } from "../core/presets";
import { Modal } from "./Modal";

export function PresetTile({
  doc,
  preview,
  onOpen,
  onSources,
  views,
}: {
  views?: number | null;
  doc: EconomyDocument;
  preview: ReactNode;
  onOpen: () => void;
  onSources: () => void;
}) {
  return (
    <article className="preset-card">
      <button
        className="preset-open"
        onClick={onOpen}
        aria-label={`Open ${doc.name}`}
      >
        <div className="preset-preview">{preview}</div>
        <div className="preset-info">
          <h3>{doc.name}</h3>
          <p className="preset-summary">
            {doc.research?.summary ??
              "Start with a simple, editable economy loop."}
          </p>
          <p>{presetDescription(doc)}</p>
          {views !== undefined && (
            <p>
              {views === null
                ? "Views unavailable"
                : `${views.toLocaleString()} views`}
            </p>
          )}
          <span>
            {doc.research?.category ?? "START HERE"}
            <ArrowRight size={15} />
          </span>
        </div>
      </button>
      {doc.research && (
        <div className="preset-evidence">
          <span>Researched {doc.research.checkedAt}</span>
          <button
            className="text-button"
            aria-label={`Sources for ${doc.name}`}
            onClick={onSources}
          >
            <BookOpen size={13} /> Sources
          </button>
        </div>
      )}
    </article>
  );
}

export function PresetSources({
  doc,
  onClose,
}: {
  doc: EconomyDocument;
  onClose: () => void;
}) {
  const research = doc.research;
  if (!research) return null;
  return (
    <Modal
      title={`Sources: ${doc.name}`}
      description="Original preset research"
      onClose={onClose}
      wide
    >
      <div className="research-notes">
        <p>
          <strong>{research.category}</strong> · Reviewed {research.checkedAt} ·
          Revision {research.revision}
        </p>
        <p>{research.scope}</p>
        <p className="research-origin">
          These references document the original preset. Your edits are not
          independently verified. Source mappings refer to original card and
          pipe IDs, which may have since changed or been removed.
        </p>
        <h3>Evidence</h3>
        {research.sources.map((s) => (
          <section className="research-source" key={s.id}>
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              {s.title}
            </a>
            <small>
              {s.publisher} · {s.kind}
            </small>
            <p>{s.note}</p>
            <details>
              <summary>
                Original mappings: {s.cardIds.length} cards, {s.edgeIds.length}{" "}
                pipes
              </summary>
              <p>Cards: {s.cardIds.join(", ") || "None"}</p>
              <p>Pipes: {s.edgeIds.join(", ") || "None"}</p>
            </details>
          </section>
        ))}
        <h3>Interpretations</h3>
        {research.interpretations.map((i, n) => (
          <p key={n}>{i.note}</p>
        ))}
        <h3>Coverage and limitations</h3>
        <ul>
          {research.limitations.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
