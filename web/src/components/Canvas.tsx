import { EvidenceBadge } from "./CardEvidence";
import { GEC_CANVAS } from "../lib/embed";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ViewportPortal,
  Background,
  Controls,
  Handle,
  Position,
  useReactFlow,
  type Node,
  type Edge,
  type NodeProps,
  type EdgeProps,
  type Connection,
  type NodeChange,
  type FitViewOptions,
  applyNodeChanges,
} from "@xyflow/react";
import { Plus, Minus, MoreHorizontal, GripVertical } from "lucide-react";
import {
  validateDocument,
  type EconomyDocument,
  type Card,
  type Settings,
} from "../core/document";
import {
  AddResourceMenu,
  InlineEdit,
  ItemMenu,
  Popover,
  type ResourceKind,
} from "./DirectEditing";
import { ink } from "./DiagramSvg";
import { traceInvestments } from "../core/trace";
import type { Layout, PlacedCard, Route } from "../core/layout";
import { CardDrawing, PipeDrawing, BridgeDrawing } from "./DiagramSvg";
export type Selection = {
  kind: "card" | "edge" | "group" | "stage";
  id: string;
} | null;
type CardNode = Node<
  {
    placed: PlacedCard;
    document: EconomyDocument;
    openEvidence: (id: string) => void;
    settings: Settings;
    highlight: boolean;
    readOnly: boolean;
    add: (id: string) => void;
    remove: (id: string) => void;
    edit: (id: string, patch: Partial<Card>) => void;
    resource: (kind: ResourceKind, value?: string, cardId?: string) => void;
    menu: (selection: NonNullable<Selection>, anchor: HTMLElement) => void;
    focus: boolean;
    focusConsumed: () => void;
    focusTarget: string | null;
    select: (id: string) => void;
  },
  "card"
>;
function EconomyCard({ data, selected }: NodeProps<CardNode>) {
  const { placed: c } = data;
  const [drop, setDrop] = useState(false);
  const fill =
    c.card.kind === "action"
      ? data.settings.actionHeader
      : c.card.kind === "final_good"
        ? data.settings.finalGood
        : data.settings.sink;
  return (
    <div
      className={`economy-card ${selected ? "is-selected" : ""} ${data.highlight ? "investment-path" : ""} ${drop ? "resource-drop-target" : ""}`}
      onDragOver={(e) => {
        if (
          !data.readOnly &&
          e.dataTransfer.types.includes("application/economy-resource")
        ) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setDrop(true);
        }
      }}
      onDragLeave={() => setDrop(false)}
      onDrop={(e) => {
        setDrop(false);
        if (data.readOnly) return;
        const raw = e.dataTransfer.getData("application/economy-resource");
        if (!raw) return;
        e.preventDefault();
        e.stopPropagation();
        try {
          const r = JSON.parse(raw);
          if (["sources", "sinks", "values", "notes"].includes(r.kind))
            data.resource(
              r.kind,
              typeof r.value === "string" ? r.value : undefined,
              c.card.id,
            );
        } catch {}
      }}
      onClickCapture={(e) => {
        if ((e.target as HTMLElement).closest(".inline-hit"))
          data.select(c.card.id);
      }}
      style={{ width: c.width, height: c.height }}
    >
      <EvidenceBadge
        document={data.document}
        cardId={c.card.id}
        onOpen={() => data.openEvidence(c.card.id)}
      />
      <Handle
        type="target"
        position={Position.Left}
        style={{ top: c.metrics.anchorY }}
        isConnectable={!data.readOnly}
      />
      <svg width={c.width} height={c.height}>
        <CardDrawing
          card={c.card}
          metrics={c.metrics}
          settings={data.settings}
          selected={selected || data.highlight}
        />
      </svg>
      <Handle
        type="source"
        position={Position.Right}
        style={{ top: c.metrics.anchorY }}
        isConnectable={!data.readOnly}
      />
      {!data.readOnly && (
        <>
          <InlineEdit
            value={c.card.label}
            label="Card title"
            autoEdit={data.focus}
            onAutoEdit={data.focusConsumed}
            style={{
              left: 16,
              top: c.metrics.anchorY - (c.metrics.title.length * 19) / 2 - 2,
              width: c.width - 32,
              height: c.metrics.title.length * 19 + 4,
              backgroundColor: fill,
              color: ink(fill),
              fontSize: 13,
              fontWeight: 600,
              lineHeight: "19px",
            }}
            onSave={(label) => data.edit(c.card.id, { label })}
          />
          {c.metrics.rows.map((row, i) => {
            const key =
              row.kind === "source"
                ? "sources"
                : row.kind === "sink"
                  ? "sinks"
                  : "values";
            const index = c.metrics.rows
              .slice(0, i)
              .filter((r) => r.kind === row.kind).length;
            return (
              <div key={`${key}-${index}`}>
                <InlineEdit
                  autoEdit={data.focusTarget === `${c.card.id}:${key}:${index}`}
                  onAutoEdit={data.focusConsumed}
                  value={c.card[key][index]}
                  label={`${row.kind} ${index + 1}`}
                  style={{
                    left: 37,
                    top: row.y + 4,
                    width: c.width - 52,
                    height: row.height - 8,
                    backgroundColor: data.settings[row.kind],
                    color: ink(data.settings[row.kind]),
                    fontSize: 11,
                    lineHeight: "16px",
                  }}
                  onSave={(value) =>
                    data.edit(c.card.id, {
                      [key]: c.card[key].map((v, j) =>
                        j === index ? value : v,
                      ),
                    })
                  }
                />
                <button
                  className="row-minus nodrag nopan"
                  aria-label={`Remove ${row.kind} ${index + 1}`}
                  style={{ top: row.y + 4 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    data.edit(c.card.id, {
                      [key]: c.card[key].filter((_, j) => j !== index),
                    });
                  }}
                >
                  <Minus size={12} />
                </button>
              </div>
            );
          })}
          {!!c.card.notes && (
            <InlineEdit
              autoEdit={data.focusTarget === `${c.card.id}:notes:0`}
              onAutoEdit={data.focusConsumed}
              value={c.card.notes}
              label="Card notes"
              multiline
              style={{
                left: 16,
                top: c.metrics.notesY - 2,
                width: c.width - 32,
                height: c.metrics.notes.length * 16 + 4,
                fontSize: 11,
                lineHeight: "16px",
              }}
              onSave={(notes) => data.edit(c.card.id, { notes })}
            />
          )}
          <span className="card-grip" title="Drag to move">
            <GripVertical size={13} />
          </span>
          <button
            className="card-control action-plus nodrag nopan"
            aria-label="Add connected card"
            disabled={c.card.kind === "final_good"}
            title={
              c.card.kind === "final_good"
                ? "Final goods end the flow"
                : "Add connected action"
            }
            onClick={(e) => {
              e.stopPropagation();
              data.add(c.card.id);
            }}
          >
            <Plus size={14} />
          </button>
          <button
            className="card-control action-minus nodrag nopan"
            aria-label="Remove card"
            title="Remove card"
            onClick={(e) => {
              e.stopPropagation();
              data.remove(c.card.id);
            }}
          >
            <Minus size={14} />
          </button>
          <button
            className="card-more nodrag nopan"
            aria-label="Card options"
            onClick={(e) => {
              e.stopPropagation();
              data.menu({ kind: "card", id: c.card.id }, e.currentTarget);
            }}
          >
            <MoreHorizontal size={15} />
          </button>
          <AddResourceMenu
            onAdd={(kind) => data.resource(kind, undefined, c.card.id)}
          />
        </>
      )}
    </div>
  );
}
function GroupNode({ data }: NodeProps) {
  return (
    <div className="group-heading-wrap">
      <svg width={Number(data.width)} height={Number(data.height)}>
        <rect
          x=".5"
          y=".5"
          width={Number(data.width) - 1}
          height={Number(data.height) - 1}
          rx="10"
          fill={String(data.color)}
          stroke="#e4e9e5"
        />
        {(data.lines as string[]).map((line, i) => (
          <text
            key={i}
            x="18"
            y={26 + i * 18}
            fontFamily="Inter, Arial, sans-serif"
            fontSize="12"
            fontWeight="600"
            fill="#627168"
          >
            {line}
          </text>
        ))}
      </svg>
      {!data.readOnly && (
        <>
          <InlineEdit
            value={String(data.label)}
            label="Group name"
            style={{
              left: 18,
              top: 12,
              width: 196,
              height: (data.lines as string[]).length * 18 + 5,
              backgroundColor: String(data.color),
              fontSize: 12,
              fontWeight: 600,
              lineHeight: "18px",
            }}
            onSave={(label) => (data.rename as (label: string) => void)(label)}
          />
          <button
            className="heading-more nodrag nopan"
            aria-label="Group options"
            style={{ left: 218 }}
            onClick={(e) => {
              e.stopPropagation();
              (data.menu as (el: HTMLElement) => void)(e.currentTarget);
            }}
          >
            <MoreHorizontal size={15} />
          </button>
        </>
      )}
    </div>
  );
}
function StageNode({ data }: NodeProps) {
  return (
    <div className="stage-heading-wrap">
      <svg width="196" height={(data.lines as string[]).length * 18}>
        <text
          y="13"
          fontFamily="Inter, Arial, sans-serif"
          fontSize="10"
          fontWeight="500"
          letterSpacing="1"
          fill="#839087"
        >
          {String(data.index).padStart(2, "0")}
        </text>
        {(data.lines as string[]).map((line, i) => (
          <text
            key={i}
            x="25"
            y={13 + i * 18}
            fontFamily="Inter, Arial, sans-serif"
            fontSize="12"
            fontWeight="600"
            fill="#4d5f53"
          >
            {line}
          </text>
        ))}
      </svg>
      {!data.readOnly && (
        <>
          <InlineEdit
            value={String(data.label)}
            label="Stage name"
            style={{
              left: 25,
              top: -2,
              width: 171,
              height: (data.lines as string[]).length * 18 + 4,
              fontSize: 12,
              fontWeight: 600,
              lineHeight: "18px",
            }}
            onSave={(label) => (data.rename as (label: string) => void)(label)}
          />
          <button
            className="heading-more nodrag nopan"
            aria-label="Stage options"
            style={{ left: 200, top: -6 }}
            onClick={(e) => {
              e.stopPropagation();
              (data.menu as (el: HTMLElement) => void)(e.currentTarget);
            }}
          >
            <MoreHorizontal size={15} />
          </button>
        </>
      )}
    </div>
  );
}
function GhostNode({ data }: NodeProps) {
  return (
    <div
      className="drop-preview"
      style={{ width: Number(data.width), height: Number(data.height) }}
    >
      {data.valid ? "Move here" : "Invalid placement"}
    </div>
  );
}
function EconomyEdge({ data, selected }: EdgeProps) {
  const r = data!.route as Route;
  return (
    <g>
      <path
        d={r.path}
        className="react-flow__edge-interaction"
        strokeWidth="18"
        stroke="transparent"
        fill="none"
      />
      <PipeDrawing
        route={r}
        settings={data!.settings as Settings}
        selected={selected || Boolean(data!.highlight)}
      />
    </g>
  );
}
const nodeTypes = {
  card: EconomyCard,
  band: GroupNode,
  stage: StageNode,
  ghost: GhostNode,
};
const edgeTypes = { pipe: EconomyEdge };
const FIT_OPTIONS: FitViewOptions = {
  padding: { top: "96px", right: "60px", bottom: "52px", left: "60px" },
  minZoom: 0.08,
  maxZoom: 1,
};
export function Canvas({
  document: d,
  layout,
  selection,
  onSelect,
  onMove,
  onConnect,
  onAdd,
  onDelete,
  readOnly = false,
  fitKey,
  onSelectedIds,
  onChange,
  onResource,
  onRemoveSelection,
  focusTarget,
  onFocusConsumed,
  onOpenEvidence,
}: {
  document: EconomyDocument;
  layout: Layout;
  selection: Selection;
  onSelect: (s: Selection) => void;
  onMove: (id: string, stageId: string, groupId: string, order: number) => void;
  onConnect: (c: Connection) => void;
  onAdd: (id: string) => void;
  onDelete: (id: string) => void;
  readOnly?: boolean;
  fitKey: number;
  onSelectedIds: (ids: string[]) => void;
  onChange: (d: EconomyDocument) => void;
  onResource: (kind: ResourceKind, value?: string, cardId?: string) => void;
  onRemoveSelection: (s: NonNullable<Selection>) => void;
  focusTarget: string | null;
  onFocusConsumed: () => void;
  onOpenEvidence: (id: string) => void;
}) {
  const flow = useReactFlow();
  const activeDrag = useRef(false);
  const previewWorker = useRef<Worker | null>(null);
  const previewRequest = useRef(0),
    previewKey = useRef("");
  const previewCard = useRef<string | null>(null);
  const pendingDrop = useRef<{
    id: string;
    stageId: string;
    groupId: string;
    order: number;
  } | null>(null);
  const [menu, setMenu] = useState<{
    selection: NonNullable<Selection>;
    anchor: HTMLElement;
  } | null>(null);
  const openMenu = useCallback(
    (selection: NonNullable<Selection>, anchor: HTMLElement) => {
      onSelect(selection);
      setMenu({ selection, anchor });
    },
    [onSelect],
  );
  const edit = useCallback(
    (id: string, patch: Partial<Card>) =>
      onChange({
        ...d,
        cards: d.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      }),
    [d, onChange],
  );
  const [dragNodes, setDragNodes] = useState<Node[] | null>(null);
  const [ghost, setGhost] = useState<Node | null>(null);
  useEffect(() => {
    const worker = new Worker(
      new URL("../core/layout.worker.ts", import.meta.url),
      { type: "module" },
    );
    previewWorker.current = worker;
    worker.onmessage = (event) => {
      if (
        event.data.id !== previewRequest.current ||
        !previewCard.current ||
        !event.data.layout
      )
        return;
      const c = (event.data.layout as Layout).cards.find(
        (c) => c.card.id === previewCard.current,
      );
      if (c)
        setGhost({
          id: "drop-ghost",
          type: "ghost",
          width: c.width,
          height: c.height,
          measured: { width: c.width, height: c.height },
          handles: [],
          position: { x: c.x, y: c.y },
          data: { width: c.width, height: c.height, valid: true },
          draggable: false,
          selectable: false,
          zIndex: 3,
        });
    };
    return () => {
      worker.terminate();
      previewWorker.current = null;
    };
  }, []);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  useEffect(() => {
    if (selection?.kind === "card")
      setSelectedCards((ids) =>
        ids.includes(selection.id) ? ids : [selection.id],
      );
    else setSelectedCards([]);
  }, [selection]);
  useEffect(() => onSelectedIds(selectedCards), [selectedCards, onSelectedIds]);
  const investmentPath = useMemo(
    () =>
      traceInvestments(
        d,
        hoveredCard
          ? [hoveredCard]
          : selection?.kind === "card"
            ? [...new Set([...selectedCards, selection.id])]
            : [],
      ),
    [d, hoveredCard, selectedCards, selection],
  );
  const linked = useMemo(() => {
    const e = d.edges.find(
      (e) => selection?.kind === "edge" && e.id === selection.id,
    );
    return new Set(e ? [e.from, e.to] : []);
  }, [d.edges, selection]);
  const nodes: Node[] = useMemo(
    () => [
      ...layout.groups.map((g) => ({
        id: `group-${g.id}`,
        type: "band",
        position: { x: g.x, y: g.y },
        data: {
          ...g,
          readOnly,
          rename: (label: string) =>
            onChange({
              ...d,
              groups: d.groups.map((item) =>
                item.id === g.id ? { ...item, label } : item,
              ),
            }),
          menu: (anchor: HTMLElement) =>
            openMenu({ kind: "group", id: g.id }, anchor),
        },
        zIndex: -2,
        draggable: false,
        selectable: !readOnly,
        width: g.width,
        height: g.height,
        measured: { width: g.width, height: g.height },
        handles: [],
        style: { width: g.width, height: g.height },
      })),
      ...layout.stages.map((s, i) => ({
        id: `stage-${s.id}`,
        type: "stage",
        width: s.width,
        height: s.height,
        measured: { width: s.width, height: s.height },
        handles: [],
        position: { x: s.x, y: s.y },
        data: {
          ...s,
          index: i + 1,
          readOnly,
          rename: (label: string) =>
            onChange({
              ...d,
              stages: d.stages.map((item) =>
                item.id === s.id ? { ...item, label } : item,
              ),
            }),
          menu: (anchor: HTMLElement) =>
            openMenu({ kind: "stage", id: s.id }, anchor),
        },
        draggable: false,
        selectable: !readOnly,
      })),
      ...layout.cards.map((c) => ({
        id: c.card.id,
        type: "card",
        position: { x: c.x, y: c.y },
        data: {
          placed: c,
          document: d,
          openEvidence: onOpenEvidence,
          settings: d.settings,
          highlight:
            linked.has(c.card.id) || investmentPath.cards.has(c.card.id),
          readOnly,
          add: onAdd,
          remove: onDelete,
          edit,
          resource: onResource,
          menu: openMenu,
          focusConsumed: onFocusConsumed,
          focus: focusTarget === `${c.card.id}:label`,
          focusTarget:
            JSON.stringify(c.card) ===
            JSON.stringify(d.cards.find((item) => item.id === c.card.id))
              ? focusTarget
              : null,
          select: (id: string) => onSelect({ kind: "card", id }),
        },
        selected: selectedCards.includes(c.card.id),
        draggable: !readOnly,
        width: c.width,
        height: c.height,
        measured: { width: c.width, height: c.height },
        handles: [
          {
            type: "target" as const,
            position: Position.Left,
            x: -5,
            y: c.metrics.anchorY - 5,
            width: 10,
            height: 10,
          },
          {
            type: "source" as const,
            position: Position.Right,
            x: c.width - 5,
            y: c.metrics.anchorY - 5,
            width: 10,
            height: 10,
          },
        ],
        style: { width: c.width, height: c.height },
        ariaLabel: c.card.label,
      })),
    ],
    [
      layout,
      d.settings,
      selection,
      linked,
      investmentPath,
      selectedCards,
      readOnly,
      onAdd,
      onDelete,
      d,
      onChange,
      edit,
      onResource,
      openMenu,
      focusTarget,
      onFocusConsumed,
      onOpenEvidence,
    ],
  );
  const edges: Edge[] = useMemo(
    () =>
      layout.routes
        .filter((r) => !r.unresolved)
        .map((r) => ({
          id: r.edge.id,
          source: r.edge.from,
          target: r.edge.to,
          type: "pipe",
          data: {
            route: r,
            settings: d.settings,
            highlight: investmentPath.edges.has(r.edge.id),
          },
          className: investmentPath.edges.has(r.edge.id)
            ? "investment-path"
            : undefined,
          selected: selection?.kind === "edge" && selection.id === r.edge.id,
          ariaLabel: `${r.edge.feedback ? "Return" : "Pipe"} from ${d.cards.find((c) => c.id === r.edge.from)?.label} to ${d.cards.find((c) => c.id === r.edge.to)?.label}`,
        })),
    [layout, d.settings, d.cards, selection, investmentPath],
  );
  const fitted = useRef("");
  useEffect(() => {
    const key = `${d.id}:${fitKey}`;
    if (layout.documentId !== d.id || fitted.current === key) return;
    const timer = setTimeout(() => {
      fitted.current = key;
      void flow.fitView({ ...FIT_OPTIONS, duration: 180 });
    }, 80);
    return () => clearTimeout(timer);
  }, [fitKey, flow, layout, d.id]);
  const destination = (n: Node) => {
    const stage = [...layout.stages].sort(
      (a, b) => Math.abs(a.x - n.position.x) - Math.abs(b.x - n.position.x),
    )[0];
    const group = [...layout.groups].sort(
      (a, b) =>
        Math.abs(
          a.y + a.height / 2 - n.position.y - (n.measured?.height || 80) / 2,
        ) -
        Math.abs(
          b.y + b.height / 2 - n.position.y - (n.measured?.height || 80) / 2,
        ),
    )[0];
    const others = layout.cards
      .filter(
        (c) =>
          c.card.id !== n.id &&
          c.card.stageId === stage.id &&
          c.card.groupId === group.id,
      )
      .sort((a, b) => a.card.order - b.card.order);
    const after = others.find((c) => c.y > n.position.y),
      before = after ? others[others.indexOf(after) - 1] : others.at(-1);
    const order = after
      ? before
        ? (before.card.order + after.card.order) / 2
        : after.card.order - 1
      : (before?.card.order ?? -1) + 1;
    let valid = true;
    try {
      validateDocument({
        ...d,
        cards: d.cards.map((c) =>
          c.id === n.id
            ? { ...c, stageId: stage.id, groupId: group.id, order }
            : c,
        ),
      });
    } catch {
      valid = false;
    }
    return {
      valid,
      stage,
      group,
      order,
      y:
        after?.y ??
        (before
          ? before.y +
            before.height +
            (d.settings.spacing === "compact" ? 40 : 52)
          : group.y + group.header),
    };
  };
  const onChanges = useCallback(
    (changes: NodeChange[]) => {
      if (activeDrag.current && changes.some((c) => c.type === "position"))
        setDragNodes((old) => applyNodeChanges(changes, old || nodes));
    },
    [nodes],
  );
  const pending = pendingDrop.current;
  const dropAccepted =
    !!pending &&
    layout.cards.some(
      (c) =>
        c.card.id === pending.id &&
        c.card.stageId === pending.stageId &&
        c.card.groupId === pending.groupId &&
        c.card.order === pending.order,
    );
  useEffect(() => {
    if (dropAccepted) {
      pendingDrop.current = null;
      setDragNodes(null);
      setGhost(null);
    }
  }, [dropAccepted]);
  const pendingStillCurrent =
    !pending ||
    d.cards.some(
      (c) =>
        c.id === pending.id &&
        c.stageId === pending.stageId &&
        c.groupId === pending.groupId &&
        c.order === pending.order,
    );
  useEffect(() => {
    if (!pendingStillCurrent) {
      pendingDrop.current = null;
      setDragNodes(null);
      setGhost(null);
    }
  }, [pendingStillCurrent]);
  const visibleNodes =
    dropAccepted || !pendingStillCurrent || (!activeDrag.current && !pending)
      ? nodes
      : dragNodes || nodes;
  return (
    <>
      <ReactFlow
        onKeyDownCapture={(event) => {
          const element = (event.target as HTMLElement).closest(
            ".react-flow__node",
          );
          if (
            !element ||
            (event.target as HTMLElement).closest(
              "button,input,select,textarea",
            )
          )
            return;
          const node = nodes.find(
            (n) => n.id === element.getAttribute("data-id"),
          );
          if (!node) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            if (!readOnly)
              element.querySelector<HTMLButtonElement>(".inline-hit")?.click();
            if (node.type === "card") onSelect({ kind: "card", id: node.id });
            else if (node.type === "band")
              onSelect({ kind: "group", id: node.id.slice(6) });
            else if (node.type === "stage")
              onSelect({ kind: "stage", id: node.id.slice(6) });
          }
          if (
            !readOnly &&
            node.type === "card" &&
            ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
              event.key,
            )
          ) {
            event.preventDefault();
            event.stopPropagation();
            const c = d.cards.find((c) => c.id === node.id)!;
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              const index =
                d.stages.findIndex((s) => s.id === c.stageId) +
                (event.key === "ArrowRight" ? 1 : -1);
              if (d.stages[index])
                onMove(c.id, d.stages[index].id, c.groupId, c.order);
            } else {
              const siblings = d.cards
                .filter(
                  (n) => n.stageId === c.stageId && n.groupId === c.groupId,
                )
                .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
              const index = siblings.findIndex((n) => n.id === c.id),
                direction = event.key === "ArrowDown" ? 1 : -1,
                adjacent = siblings[index + direction],
                beyond = siblings[index + direction * 2];
              if (adjacent)
                onMove(
                  c.id,
                  c.stageId,
                  c.groupId,
                  beyond
                    ? (adjacent.order + beyond.order) / 2
                    : adjacent.order + direction,
                );
            }
          }
        }}
        nodes={ghost && !dropAccepted ? [...visibleNodes, ghost] : visibleNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onChanges}
        onNodeMouseEnter={(_, n) => {
          if (n.type === "card") setHoveredCard(n.id);
        }}
        onNodeMouseLeave={(_, n) =>
          setHoveredCard((id) => (id === n.id ? null : id))
        }
        onNodeClick={(event, n) => {
          if (n.type === "card") {
            const ids = event.shiftKey
              ? selectedCards.includes(n.id)
                ? selectedCards.filter((id) => id !== n.id)
                : [...selectedCards, n.id]
              : [n.id];
            setSelectedCards(ids);
            onSelect(
              ids.length
                ? { kind: "card", id: ids.includes(n.id) ? n.id : ids.at(-1)! }
                : null,
            );
          } else if (n.type === "band")
            onSelect({ kind: "group", id: n.id.slice(6) });
          else if (n.type === "stage")
            onSelect({ kind: "stage", id: n.id.slice(6) });
        }}
        onEdgeClick={(event, e) => {
          onSelect({ kind: "edge", id: e.id });
          if (!readOnly)
            openMenu({ kind: "edge", id: e.id }, event.target as HTMLElement);
        }}
        onPaneClick={() => {
          onSelect(null);
          setMenu(null);
        }}
        onMoveStart={() => setMenu(null)}
        onNodeDragStart={() => {
          activeDrag.current = true;
          pendingDrop.current = null;
          previewKey.current = "";
          setMenu(null);
        }}
        onConnect={onConnect}
        onNodeDrag={(_, n) => {
          const target = destination(n);
          const key = JSON.stringify([
            n.id,
            target.stage.id,
            target.group.id,
            target.order,
            target.valid,
          ]);
          if (key === previewKey.current) return;
          previewKey.current = key;
          previewCard.current = n.id;
          const id = ++previewRequest.current;
          if (!target.valid) {
            setGhost({
              id: "drop-ghost",
              type: "ghost",
              width: 196,
              height: n.measured?.height || 80,
              handles: [],
              position: { x: target.stage.x, y: target.y },
              data: {
                width: 196,
                height: n.measured?.height || 80,
                valid: false,
              },
              draggable: false,
              selectable: false,
              zIndex: 3,
            });
            return;
          }
          previewWorker.current?.postMessage({
            id,
            document: {
              ...d,
              cards: d.cards.map((c) =>
                c.id === n.id
                  ? {
                      ...c,
                      stageId: target.stage.id,
                      groupId: target.group.id,
                      order: target.order,
                    }
                  : c,
              ),
            },
            metrics: Object.fromEntries(
              layout.cards.map((c) => [c.card.id, c.metrics]),
            ),
            headings: {
              stages: Object.fromEntries(
                layout.stages.map((s) => [s.id, s.lines]),
              ),
              groups: Object.fromEntries(
                layout.groups.map((g) => [g.id, g.lines]),
              ),
            },
          });
        }}
        onNodeDragStop={(_, n) => {
          activeDrag.current = false;
          ++previewRequest.current;
          previewCard.current = null;
          const target = destination(n);
          setGhost(null);
          if (!target.valid) {
            setDragNodes(null);
            return;
          }
          // Keep the lifted scene until this placement appears in a worker result.
          pendingDrop.current = {
            id: n.id,
            stageId: target.stage.id,
            groupId: target.group.id,
            order: target.order,
          };
          onMove(n.id, target.stage.id, target.group.id, target.order);
        }}

        autoPanOnNodeFocus={false}
        fitView
        fitViewOptions={FIT_OPTIONS}
        minZoom={0.08}
        maxZoom={2}
        deleteKeyCode={null}
        nodesConnectable={!readOnly}
        nodesDraggable={!readOnly}
        panOnScroll
        selectionOnDrag={false}
        zoomOnDoubleClick={false}
        proOptions={{ hideAttribution: true }}
      >
        <ViewportPortal>
          <svg
            width="1"
            height="1"
            style={{
              position: "absolute",
              overflow: "visible",
              pointerEvents: "none",
            }}
          >
            <BridgeDrawing
              routes={layout.routes}
              settings={d.settings}
              highlightedIds={investmentPath.edges}
              background={GEC_CANVAS}
              selectedId={selection?.kind === "edge" ? selection.id : undefined}
            />
          </svg>
        </ViewportPortal>
        <Background color="#c2c7c3" gap={24} size={0.7} />
        <Controls showInteractive={false} fitViewOptions={FIT_OPTIONS} />
      </ReactFlow>
      {menu && !readOnly && (
        <Popover
          anchor={menu.anchor}
          label={`${menu.selection.kind} options`}
          onClose={() => setMenu(null)}
        >
          <ItemMenu
            document={d}
            selection={menu.selection}
            onChange={onChange}
            onConnect={(source, target) =>
              onConnect({
                source,
                target,
                sourceHandle: null,
                targetHandle: null,
              })
            }
            onRemove={() => {
              onRemoveSelection(menu.selection);
              setMenu(null);
            }}
          />
        </Popover>
      )}
    </>
  );
}
