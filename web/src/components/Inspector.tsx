import {
  Plus,
  Minus,
  ArrowRight,
  ArrowLeft,
  Trash2,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useState } from "react";
import {
  originalPalette,
  uid,
  type EconomyDocument,
  type Card,
} from "../core/document";
import type { Selection } from "./Canvas";
export function Inspector({
  document: d,
  selection,
  onChange,
  onDelete,
  onClose,
}: {
  document: EconomyDocument;
  selection: Selection;
  onChange: (d: EconomyDocument) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [connectTo, setConnectTo] = useState("");
  const [returnPipe, setReturnPipe] = useState(false);
  const card =
    selection?.kind === "card"
      ? d.cards.find((c) => c.id === selection.id)
      : undefined;
  const edge =
    selection?.kind === "edge"
      ? d.edges.find((e) => e.id === selection.id)
      : undefined;
  const group =
    selection?.kind === "group"
      ? d.groups.find((g) => g.id === selection.id)
      : undefined;
  const stage =
    selection?.kind === "stage"
      ? d.stages.find((s) => s.id === selection.id)
      : undefined;
  const changeCard = (patch: Partial<Card>) =>
    onChange({
      ...d,
      cards: d.cards.map((c) => (c.id === card!.id ? { ...c, ...patch } : c)),
    });
  return (
    <aside className="inspector">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">
            {card
              ? "CARD"
              : edge
                ? "PIPE"
                : group
                  ? "GROUP"
                  : stage
                    ? "STAGE"
                    : "DIAGRAM"}
          </span>
          <h2>
            {card
              ? "Edit card"
              : edge
                ? "Edit connection"
                : group
                  ? "Edit group"
                  : stage
                    ? "Edit stage"
                    : "Appearance"}
          </h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close inspector"
          onClick={onClose}
        >
          <X size={17} />
        </button>
      </div>
      {card && (
        <>
          <label className="field">
            Title
            <textarea
              aria-label="Card title"
              value={card.label}
              rows={2}
              onChange={(e) => changeCard({ label: e.target.value })}
            />
          </label>
          <label className="field">
            Card type
            <select
              value={card.kind}
              onChange={(e) =>
                changeCard({
                  kind: e.target.value as Card["kind"],
                  ...(e.target.value === "final_good"
                    ? { stageId: d.stages.at(-1)!.id }
                    : {}),
                })
              }
            >
              <option value="action">Action</option>
              <option value="initial_sink_node">Player investment</option>
              <option value="final_good">Final good</option>
            </select>
          </label>
          <div className="field-pair">
            <label className="field">
              Stage
              <select
                aria-label="Card stage"
                value={card.stageId}
                onChange={(e) => changeCard({ stageId: e.target.value })}
              >
                {d.stages.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Group
              <select
                aria-label="Card group"
                value={card.groupId}
                onChange={(e) => changeCard({ groupId: e.target.value })}
              >
                {d.groups.map((g) => (
                  <option value={g.id} key={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="divider" />
          {(["sources", "sinks", "values"] as const).map((key) => (
            <div className={`resource-editor ${key}`} key={key}>
              <div className="section-label">
                <span>
                  {key === "values"
                    ? "Stores of value"
                    : key === "sources"
                      ? "Sources"
                      : "Sinks"}
                </span>
                <button
                  className="icon-button"
                  aria-label={`Add ${key === "values" ? "store of value" : key.slice(0, -1)}`}
                  onClick={() =>
                    changeCard({ [key]: [...card[key], "New resource"] })
                  }
                >
                  <Plus size={15} />
                </button>
              </div>
              {card[key].map((r, i) => (
                <div className="resource-input" key={i}>
                  <span>
                    {key === "sources" ? "+" : key === "sinks" ? "−" : "="}
                  </span>
                  <input
                    aria-label={`${key} ${i + 1}`}
                    value={r}
                    onChange={(e) =>
                      changeCard({
                        [key]: card[key].map((v, j) =>
                          j === i ? e.target.value : v,
                        ),
                      })
                    }
                  />
                  <button
                    className="icon-button"
                    aria-label={`Remove ${key} ${i + 1}`}
                    onClick={() =>
                      changeCard({ [key]: card[key].filter((_, j) => i !== j) })
                    }
                  >
                    <Minus size={13} />
                  </button>
                </div>
              ))}
              {!card[key].length && (
                <p className="empty-hint">
                  No {key === "values" ? "stores of value" : key} yet
                </p>
              )}
            </div>
          ))}
          <label className="field">
            Notes
            <textarea
              aria-label="Card notes"
              rows={3}
              placeholder="Add context to the diagram…"
              value={card.notes}
              onChange={(e) => changeCard({ notes: e.target.value })}
            />
          </label>
          <div className="divider" />
          <label className="field">
            Connect to
            <select
              aria-label="Connect to"
              value={connectTo}
              onChange={(e) => setConnectTo(e.target.value)}
            >
              <option value="">Choose a card…</option>
              {d.cards
                .filter((c) => c.id !== card.id)
                .map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.label}
                  </option>
                ))}
            </select>
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={returnPipe}
              onChange={(e) => setReturnPipe(e.target.checked)}
            />
            Return pipe / feedback loop
          </label>
          <button
            className="button full"
            disabled={!connectTo}
            onClick={() => {
              onChange({
                ...d,
                edges: [
                  ...d.edges,
                  {
                    id: uid(),
                    from: card.id,
                    to: connectTo,
                    type: "normal",
                    feedback: returnPipe,
                    label: "",
                  },
                ],
              });
              setConnectTo("");
            }}
          >
            <ArrowRight size={15} />
            Add connection
          </button>
        </>
      )}
      {edge && (
        <>
          <label className="field">
            From
            <select
              value={edge.from}
              onChange={(e) =>
                onChange({
                  ...d,
                  edges: d.edges.map((p) =>
                    p.id === edge.id ? { ...p, from: e.target.value } : p,
                  ),
                })
              }
            >
              {d.cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            To
            <select
              value={edge.to}
              onChange={(e) =>
                onChange({
                  ...d,
                  edges: d.edges.map((p) =>
                    p.id === edge.id ? { ...p, to: e.target.value } : p,
                  ),
                })
              }
            >
              {d.cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Relationship
            <select
              value={edge.type}
              onChange={(e) =>
                onChange({
                  ...d,
                  edges: d.edges.map((p) =>
                    p.id === edge.id
                      ? { ...p, type: e.target.value as typeof edge.type }
                      : p,
                  ),
                })
              }
            >
              <option value="normal">Resource or action flow</option>
              <option value="value">Store-of-value connection</option>
              <option value="final">Final-good connection</option>
              <option value="cross-lane">Cross-group connection</option>
            </select>
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={edge.feedback}
              onChange={(e) =>
                onChange({
                  ...d,
                  edges: d.edges.map((p) =>
                    p.id === edge.id ? { ...p, feedback: e.target.checked } : p,
                  ),
                })
              }
            />
            <ArrowLeft size={14} />
            Return pipe
          </label>
          <p className="helper">
            Return pipes travel outside the main flow. Each connection keeps its
            own track.
          </p>
        </>
      )}
      {group && (
        <>
          <label className="field">
            Group name
            <input
              value={group.label}
              onChange={(e) =>
                onChange({
                  ...d,
                  groups: d.groups.map((g) =>
                    g.id === group.id ? { ...g, label: e.target.value } : g,
                  ),
                })
              }
            />
          </label>
          <label className="field">
            Background
            <input
              type="color"
              value={group.color}
              onChange={(e) =>
                onChange({
                  ...d,
                  groups: d.groups.map((g) =>
                    g.id === group.id ? { ...g, color: e.target.value } : g,
                  ),
                })
              }
            />
          </label>
          <p className="helper">
            The background grows with its cards. Drag cards between groups to
            organize your economy.
          </p>
        </>
      )}
      {stage && (
        <>
          <label className="field">
            Stage name
            <input
              value={stage.label}
              onChange={(e) =>
                onChange({
                  ...d,
                  stages: d.stages.map((s) =>
                    s.id === stage.id ? { ...s, label: e.target.value } : s,
                  ),
                })
              }
            />
          </label>
          <p className="helper">
            Stages establish the left-to-right order. Move cards using their
            Stage control or drag them to a different column.
          </p>
        </>
      )}
      {!selection && (
        <>
          <div className="appearance-illustration">
            <SlidersHorizontal size={24} />
            <p>Make it yours.</p>
            <span>A clear diagram starts with a little structure.</span>
          </div>
          <label className="field">
            Spacing
            <select
              value={d.settings.spacing}
              onChange={(e) =>
                onChange({
                  ...d,
                  settings: {
                    ...d.settings,
                    spacing: e.target.value as "compact" | "comfortable",
                  },
                })
              }
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>
          </label>
          {(
            ["actionHeader", "finalGood", "source", "sink", "value"] as const
          ).map((k) => (
            <label className="color-field" key={k}>
              <span>
                {k === "actionHeader"
                  ? "Action headers"
                  : k === "finalGood"
                    ? "Final goods"
                    : k === "value"
                      ? "Stores of value"
                      : k === "source"
                        ? "Sources"
                        : "Sinks"}
              </span>
              <input
                aria-label={`${k} color`}
                type="color"
                value={d.settings[k]}
                onChange={(e) =>
                  onChange({
                    ...d,
                    settings: { ...d.settings, [k]: e.target.value },
                  })
                }
              />
            </label>
          ))}
          <button
            className="button full"
            onClick={() =>
              onChange({
                ...d,
                settings: { ...d.settings, ...originalPalette },
              })
            }
          >
            Use original economy palette
          </button>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={d.settings.showLegend}
              onChange={(e) =>
                onChange({
                  ...d,
                  settings: { ...d.settings, showLegend: e.target.checked },
                })
              }
            />
            Include resource key in exports
          </label>
          <label className="field">
            Export background
            <select
              value={d.settings.background}
              onChange={(e) =>
                onChange({
                  ...d,
                  settings: {
                    ...d.settings,
                    background: e.target.value as "white" | "transparent",
                  },
                })
              }
            >
              <option value="white">White</option>
              <option value="transparent">Transparent</option>
            </select>
          </label>
          <p className="helper">
            Your preferences are saved for this diagram and used for new
            diagrams.
          </p>
        </>
      )}
      {selection && (
        <button className="button danger full remove-item" onClick={onDelete}>
          <Trash2 size={14} />
          Remove {selection.kind}
        </button>
      )}
    </aside>
  );
}
