import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Plus, X, Search, GripVertical } from "lucide-react";
import type { Card, EconomyDocument } from "../core/document";
import type { Selection } from "./Canvas";
export type ResourceKind = "sources" | "sinks" | "values" | "notes";
export const resourceChoices: {
  kind: ResourceKind;
  label: string;
  symbol: string;
}[] = [
  { kind: "sources", label: "Source", symbol: "+" },
  { kind: "sinks", label: "Sink", symbol: "−" },
  { kind: "values", label: "Store of value", symbol: "=" },
  { kind: "notes", label: "Note", symbol: "≡" },
];
export const resourceColor = (d: EconomyDocument, kind: ResourceKind) =>
  kind === "notes"
    ? "#767676"
    : d.settings[
        kind === "sources" ? "source" : kind === "sinks" ? "sink" : "value"
      ];
export function InlineEdit({
  value,
  label,
  onSave,
  style,
  autoEdit = false,
  onAutoEdit,
  multiline = false,
}: {
  value: string;
  label: string;
  onSave: (value: string) => void;
  style?: CSSProperties;
  autoEdit?: boolean;
  onAutoEdit?: () => void;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(autoEdit),
    [draft, setDraft] = useState(value);
  const input = useRef<HTMLTextAreaElement>(null),
    cancelled = useRef(false);
  useEffect(() => {
    if (editing) {
      input.current?.focus({ preventScroll: true });
      input.current?.select();
    }
  }, [editing]);
  useEffect(() => {
    if (autoEdit) {
      setDraft(value);
      setEditing(true);
      onAutoEdit?.();
    }
  }, [autoEdit]);
  const finish = () => {
    const text = input.current?.value ?? draft;
    setEditing(false);
    if (!cancelled.current && (text.trim() || multiline) && text !== value)
      onSave(text.trim());
    cancelled.current = false;
  };
  return editing ? (
    <textarea
      ref={input}
      aria-label={label}
      className="inline-input nodrag nopan"
      style={style}
      value={draft}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        setDraft(e.target.value);
        e.target.style.height = "auto";
        e.target.style.height = `${e.target.scrollHeight}px`;
      }}
      onBlur={finish}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          cancelled.current = true;
          setEditing(false);
        } else if (
          e.key === "Enter" &&
          (!multiline || e.metaKey || e.ctrlKey)
        ) {
          e.preventDefault();
          finish();
        }
      }}
    />
  ) : (
    <button
      type="button"
      className="inline-hit nodrag nopan"
      style={style}
      aria-label={`Edit ${label.toLowerCase()}`}
      title={`Edit ${label.toLowerCase()}`}
      onClick={(e) => {
        e.stopPropagation();
        setDraft(value);
        setEditing(true);
      }}
    />
  );
}
export function Popover({
  anchor,
  onClose,
  children,
  label,
  width = 256,
  heightEstimate = 360,
}: {
  anchor: HTMLElement;
  onClose: () => void;
  children: ReactNode;
  label: string;
  width?: number;
  heightEstimate?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const rect = anchor.getBoundingClientRect();
  const left = Math.min(
    Math.max(12, rect.left),
    window.innerWidth - width - 12,
  );
  const top = Math.max(
    12,
    Math.min(rect.bottom + 8, window.innerHeight - heightEstimate),
  );
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (
        !box.current?.contains(e.target as Node) &&
        !anchor.contains(e.target as Node)
      )
        onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        anchor.focus?.();
      }
    };
    window.addEventListener("pointerdown", down);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("keydown", key);
    };
  }, [anchor, onClose]);
  return createPortal(
    <div
      ref={box}
      role="dialog"
      aria-label={label}
      className="canvas-popover nodrag nopan"
      style={{ left, top, width }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}
export function AddResourceMenu({
  onAdd,
}: {
  onAdd: (kind: ResourceKind) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null),
    [active, setActive] = useState(0);
  const gesture = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const choose = (i: number) => {
    onAdd(resourceChoices[i].kind);
    setAnchor(null);
    gesture.current = null;
  };
  return (
    <>
      <button
        type="button"
        className="card-control resource-plus nodrag nopan"
        aria-label="Add resource or note"
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        onClick={(e) => {
          e.stopPropagation();
          if (e.detail === 0) {
            setActive(0);
            setAnchor(anchor ? null : e.currentTarget);
          }
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          e.currentTarget.setPointerCapture(e.pointerId);
          gesture.current = { x: e.clientX, y: e.clientY, moved: false };
          setActive(0);
          setAnchor(e.currentTarget);
        }}
        onPointerMove={(e) => {
          const g = gesture.current;
          if (!g) return;
          g.moved ||= Math.hypot(e.clientX - g.x, e.clientY - g.y) > 6;
          const el = document
            .elementFromPoint(e.clientX, e.clientY)
            ?.closest<HTMLElement>("[data-resource-choice]");
          if (el) setActive(Number(el.dataset.resourceChoice));
        }}
        onPointerUp={(e) => {
          const g = gesture.current;
          if (!g) return;
          gesture.current = null;
          if (g.moved) {
            const el = document
              .elementFromPoint(e.clientX, e.clientY)
              ?.closest<HTMLElement>("[data-resource-choice]");
            if (el) choose(Number(el.dataset.resourceChoice));
            else setAnchor(null);
          }
        }}
        onPointerCancel={() => {
          gesture.current = null;
          setAnchor(null);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (!anchor) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i + (e.key === "ArrowDown" ? 1 : 3)) % 4);
          }
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            choose(active);
          }
          if (e.key === "Escape") {
            e.preventDefault();
            setAnchor(null);
          }
        }}
      >
        <Plus size={14} />
      </button>
      {anchor && (
        <Popover
          anchor={anchor}
          onClose={() => setAnchor(null)}
          label="Add to card"
          width={210}
          heightEstimate={240}
        >
          <div
            role="menu"
            aria-label="Add to card"
            onKeyDown={(e) => {
              if (["ArrowDown", "ArrowUp"].includes(e.key)) {
                e.preventDefault();
                const next = (active + (e.key === "ArrowDown" ? 1 : 3)) % 4;
                setActive(next);
                e.currentTarget
                  .querySelectorAll<HTMLButtonElement>("button")
                  [next]?.focus();
              }
            }}
          >
            {resourceChoices.map((item, i) => (
              <button
                role="menuitem"
                aria-label={item.label}
                key={item.kind}
                data-resource-choice={i}
                className={`resource-choice ${active === i ? "active" : ""}`}
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(i)}
              >
                <span>{item.symbol}</span>
                {item.label}
              </button>
            ))}
          </div>
          <p className="gesture-hint">Click, or hold and slide to choose</p>
        </Popover>
      )}
    </>
  );
}
export function ResourceDrawer({
  document: d,
  selection,
  onAdd,
  onClose,
}: {
  document: EconomyDocument;
  selection: Selection;
  onAdd: (kind: ResourceKind, value?: string, cardId?: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const gesture = useRef<{
    x: number;
    y: number;
    moved: boolean;
    target: HTMLElement | null;
  } | null>(null);
  const suppressClick = useRef(false);
  const [dragPreview, setDragPreview] = useState<{
    x: number;
    y: number;
    label: string;
  } | null>(null);
  const clearDrag = () => {
    gesture.current?.target?.classList.remove("resource-drop-target");
    gesture.current = null;
    setDragPreview(null);
  };
  useEffect(
    () => () =>
      gesture.current?.target?.classList.remove("resource-drop-target"),
    [],
  );
  const dragProps = (kind: ResourceKind, value?: string) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      gesture.current = {
        x: e.clientX,
        y: e.clientY,
        moved: false,
        target: null,
      };
      suppressClick.current = false;
    },
    onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => {
      const g = gesture.current;
      if (!g) return;
      g.moved ||= Math.hypot(e.clientX - g.x, e.clientY - g.y) > 6;
      if (!g.moved) return;
      const target =
        document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest<HTMLElement>(".economy-card") || null;
      if (target !== g.target) {
        g.target?.classList.remove("resource-drop-target");
        target?.classList.add("resource-drop-target");
        g.target = target;
      }
      setDragPreview({
        x: e.clientX,
        y: e.clientY,
        label: value || resourceChoices.find((c) => c.kind === kind)!.label,
      });
    },
    onPointerUp: () => {
      const g = gesture.current;
      if (!g) return;
      suppressClick.current = g.moved;
      const id = g.target?.closest<HTMLElement>(".react-flow__node-card")
        ?.dataset.id;
      if (g.moved && id) onAdd(kind, value, id);
      clearDrag();
    },
    onPointerCancel: clearDrag,
    onClick: () => {
      if (suppressClick.current) {
        suppressClick.current = false;
        return;
      }
      onAdd(kind, value);
    },
  });
  const card = d.cards.find(
    (c) => selection?.kind === "card" && c.id === selection.id,
  );
  return (
    <>
      <aside className="resource-drawer" aria-label="Resources">
        <div className="panel-heading">
          <h2>Resources</h2>
          <button
            className="icon-button"
            aria-label="Close resources"
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </div>
        <p className="helper">
          {card
            ? `Add to ${card.label}, or drag onto another card.`
            : "Choose a card, or drag a resource onto one."}
        </p>
        <label className="drawer-search">
          <Search size={15} />
          <input
            aria-label="Search resources"
            placeholder="Find a resource…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        {resourceChoices.map((item) => {
          const values =
            item.kind === "notes"
              ? []
              : [
                  ...new Set(
                    d.cards.flatMap(
                      (c) => c[item.kind as "sources" | "sinks" | "values"],
                    ),
                  ),
                ].filter((v) => v.toLowerCase().includes(search.toLowerCase()));
          return (
            <section className="drawer-resource-section" key={item.kind}>
              <button
                className="drawer-resource-add"
                aria-label={item.label}
                {...dragProps(item.kind)}
              >
                <span
                  className="resource-swatch"
                  style={{ background: resourceColor(d, item.kind) }}
                >
                  {item.symbol}
                </span>
                {item.label}
                <Plus size={14} />
              </button>
              {values.map((value) => (
                <button
                  key={value}
                  className="drawer-resource-item"
                  {...dragProps(item.kind, value)}
                >
                  <GripVertical size={12} />
                  <span>{value}</span>
                </button>
              ))}
            </section>
          );
        })}
      </aside>
      {dragPreview &&
        createPortal(
          <div
            className="resource-drag-preview"
            style={{ left: dragPreview.x + 16, top: dragPreview.y + 12 }}
          >
            {dragPreview.label}
          </div>,
          document.body,
        )}
    </>
  );
}
export function ItemMenu({
  document: d,
  selection,
  onChange,
  onConnect,
  onRemove,
}: {
  document: EconomyDocument;
  selection: NonNullable<Selection>;
  onChange: (d: EconomyDocument) => void;
  onConnect: (source: string, target: string) => void;
  onRemove: () => void;
}) {
  const card = d.cards.find(
    (c) => selection.kind === "card" && c.id === selection.id,
  );
  const edge = d.edges.find(
    (e) => selection.kind === "edge" && e.id === selection.id,
  );
  const group = d.groups.find(
    (g) => selection.kind === "group" && g.id === selection.id,
  );
  const change = (patch: Partial<Card>) =>
    onChange({
      ...d,
      cards: d.cards.map((c) => (c.id === card?.id ? { ...c, ...patch } : c)),
    });
  return (
    <div className="item-menu">
      {card && (
        <>
          <label className="field">
            Card type
            <select
              aria-label="Card type"
              value={card.kind}
              onChange={(e) =>
                change({
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
          <label className="field">
            Stage
            <select
              aria-label="Card stage"
              value={card.stageId}
              onChange={(e) => change({ stageId: e.target.value })}
            >
              {d.stages.map((s) => (
                <option
                  key={s.id}
                  value={s.id}
                  disabled={
                    card.kind === "final_good" && s.id !== d.stages.at(-1)!.id
                  }
                >
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
              onChange={(e) => change({ groupId: e.target.value })}
            >
              {d.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Connect to
            <select
              aria-label="Connect to"
              value=""
              onChange={(e) => {
                if (e.target.value) onConnect(card.id, e.target.value);
              }}
            >
              <option value="">Choose a card…</option>
              {d.cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {edge && (
        <>
          {(["from", "to"] as const).map((key) => (
            <label className="field" key={key}>
              {key === "from" ? "From" : "To"}
              <select
                aria-label={key === "from" ? "Pipe from" : "Pipe to"}
                value={edge[key]}
                onChange={(e) =>
                  onChange({
                    ...d,
                    edges: d.edges.map((p) =>
                      p.id === edge.id ? { ...p, [key]: e.target.value } : p,
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
          ))}
          <label className="field">
            Relationship
            <select
              aria-label="Relationship"
              value={edge.type}
              onChange={(e) =>
                onChange({
                  ...d,
                  edges: d.edges.map((p) =>
                    p.id === edge.id
                      ? { ...p, type: e.target.value as typeof p.type }
                      : p,
                  ),
                })
              }
            >
              <option value="normal">Resource or action flow</option>
              <option value="value">Store of value</option>
              <option value="final">Final good</option>
              <option value="cross-lane">Cross-group</option>
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
            Return pipe / feedback
          </label>
          <label className="field">
            Label
            <input
              aria-label="Pipe label"
              value={edge.label}
              onChange={(e) =>
                onChange({
                  ...d,
                  edges: d.edges.map((p) =>
                    p.id === edge.id ? { ...p, label: e.target.value } : p,
                  ),
                })
              }
            />
          </label>
        </>
      )}
      {group && (
        <label className="field">
          Group background
          <input
            aria-label="Group background"
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
      )}
      <button className="button full" onClick={onRemove}>
        − Remove {selection.kind}
      </button>
    </div>
  );
}
