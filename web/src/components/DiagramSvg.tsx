import type { Card, Settings, EconomyDocument } from "../core/document";
import type { CardMetrics, Layout, Route } from "../core/layout";
export function ink(fill: string) {
  const rgb = [1, 3, 5].map((i) => {
    const c = parseInt(fill.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] > 0.179
    ? "#000000"
    : "#ffffff";
}
export function CardDrawing({
  card,
  metrics,
  settings,
  selected = false,
}: {
  card: Card;
  metrics: CardMetrics;
  settings: Settings;
  selected?: boolean;
}) {
  const isInput = card.kind === "initial_sink_node",
    isFinal = card.kind === "final_good";
  const fill = isInput
    ? settings.sink
    : isFinal
      ? settings.finalGood
      : settings.actionHeader;
  const tint = ink(fill);
  return (
    <g fontFamily="Inter, Arial, sans-serif">
      <rect
        x="0.8"
        y="0.8"
        width={metrics.width - 1.6}
        height={metrics.height - 1.6}
        rx="8"
        fill={isFinal ? settings.finalGood : "white"}
        stroke={selected ? "#F5C95C" : "#babfbc"}
        strokeWidth={selected ? 2 : 1.2}
      />
      <rect
        x="1.5"
        y="1.5"
        width={metrics.width - 3}
        height={metrics.header - 1}
        rx="7"
        fill={fill}
      />
      {isFinal && (
        <>
          <path
            d={`M 8 1.5 H ${metrics.width - 8} Q ${metrics.width - 1.5} 1.5 ${metrics.width - 1.5} 8 V 24 H 1.5 V 8 Q 1.5 1.5 8 1.5`}
            fill="#000000"
          />
          <text
            x="16"
            y="17"
            fontSize="9"
            fontWeight="600"
            letterSpacing="1"
            fill="white"
          >
            FINAL GOOD
          </text>
        </>
      )}
      {metrics.title.map((t, i) => (
        <text
          key={i}
          x="16"
          y={metrics.anchorY - (metrics.title.length * 19) / 2 + 14 + i * 19}
          fontSize="13"
          fontWeight="600"
          fill={tint}
        >
          {t}
        </text>
      ))}
      {metrics.rows.map((row, i) => (
        <g key={i}>
          <rect
            x="12"
            y={row.y}
            width={metrics.width - 24}
            height={row.height}
            rx="4"
            fill={settings[row.kind]}
          />
          <text
            x="21"
            y={row.y + 18}
            fontSize="12"
            fill={ink(settings[row.kind])}
            fontWeight="600"
          >
            {row.kind === "source" ? "+" : row.kind === "sink" ? "−" : "="}
          </text>
          {row.lines.map((line, j) => (
            <text
              key={j}
              x="37"
              y={row.y + 18 + j * 16}
              fontSize="11"
              fill={ink(settings[row.kind])}
            >
              {line}
            </text>
          ))}
        </g>
      ))}
      {metrics.notes.length > 0 && (
        <line
          x1="16"
          y1={metrics.notesY - 7}
          x2={metrics.width - 16}
          y2={metrics.notesY - 7}
          stroke="#e9edea"
        />
      )}
      {metrics.notes.map((line, j) => (
        <text
          key={j}
          x="16"
          y={metrics.notesY + 11 + j * 16}
          fontSize="11"
          fill="#68736d"
        >
          {line}
        </text>
      ))}
    </g>
  );
}
export const pipeColor = (route: Route, s: Settings) =>
  route.edge.type === "value" ? s.value : "#89978f";
export function PipeDrawing({
  route,
  settings,
  selected = false,
  markerId = "arrow",
}: {
  route: Route;
  settings: Settings;
  selected?: boolean;
  markerId?: string;
}) {
  const color = selected ? "#b08716" : pipeColor(route, settings);
  return (
    <g>
      <defs>
        <marker
          id={`${markerId}-${route.edge.id}`}
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="4"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path
            d="M 1 1 L 7 4 L 1 7"
            fill="none"
            stroke={color}
            strokeWidth="1.4"
          />
        </marker>
      </defs>
      <path
        d={route.path}
        fill="none"
        stroke={color}
        strokeWidth={selected ? 2.4 : 1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray={route.edge.type === "final" ? "6 5" : undefined}
        markerEnd={
          route.arrowhead === false
            ? undefined
            : `url(#${markerId}-${route.edge.id})`
        }
      />
    </g>
  );
}
export function BridgeDrawing({
  routes,
  settings,
  selectedId,
}: {
  routes: Route[];
  settings: Settings;
  selectedId?: string;
}) {
  return (
    <g pointerEvents="none">
      {routes.flatMap((route) =>
        route.bridges.map((path, i) => (
          <g key={`${route.edge.id}-${i}`}>
            <path d={path} fill="none" stroke="white" strokeWidth="5" />
            <path
              d={path}
              fill="none"
              stroke={
                selectedId === route.edge.id
                  ? "#b08716"
                  : pipeColor(route, settings)
              }
              strokeWidth={selectedId === route.edge.id ? 2.4 : 1.5}
            />
          </g>
        )),
      )}
    </g>
  );
}
export function LegendDrawing({ settings }: { settings: Settings }) {
  return (
    <g fontFamily="Inter, Arial, sans-serif">
      <text fontSize="10" fill="#8a968f">
        RESOURCE KEY
      </text>
      {(["source", "sink", "value"] as const).map((k, i) => (
        <g key={k} transform={`translate(${120 + i * 140} 0)`}>
          <circle cy="-4" r="4" fill={settings[k]} />
          <text x="12" fontSize="11" fill="#637168">
            {k === "source"
              ? "Sources"
              : k === "sink"
                ? "Sinks"
                : "Stores of value"}
          </text>
        </g>
      ))}
    </g>
  );
}
export function DiagramDrawing({
  document: d,
  layout,
  selection,
}: {
  document: EconomyDocument;
  layout: Layout;
  selection?: string[];
}) {
  const selected = new Set(selection);
  const cards = selection?.length
    ? layout.cards.filter((c) => selected.has(c.card.id))
    : layout.cards;
  const routes = selection?.length
    ? layout.routes.filter(
        (r) => selected.has(r.edge.from) && selected.has(r.edge.to),
      )
    : layout.routes;
  const arrowTargets = new Set<string>();
  const drawnRoutes = routes.map((r) => {
    const arrowhead = !arrowTargets.has(r.edge.to);
    if (!r.unresolved) arrowTargets.add(r.edge.to);
    return { ...r, arrowhead };
  });
  return (
    <g fontFamily="Inter, Arial, sans-serif">
      {!selection?.length && (
        <>
          <text x="28" y="28" fontSize="16" fontWeight="600" fill="#23332b">
            {d.name}
          </text>
          <text
            x={layout.bounds.width - 28}
            y="28"
            textAnchor="end"
            fontSize="10"
            fill="#839087"
          >
            Game Economist Consulting
          </text>
        </>
      )}
      {layout.groups
        .filter(
          (g) =>
            !selection?.length || cards.some((c) => c.card.groupId === g.id),
        )
        .map((g) => (
          <g key={g.id}>
            <rect
              x={g.x}
              y={g.y}
              width={g.width}
              height={g.height}
              rx="10"
              fill={g.color}
              stroke="#e4e9e5"
            />
            {g.lines.map((line, i) => (
              <text
                key={i}
                x={g.x + 18}
                y={g.y + 26 + i * 18}
                fontSize="12"
                fontWeight="600"
                fill="#627168"
              >
                {line}
              </text>
            ))}
          </g>
        ))}
      {layout.stages.map((s, i) => (
        <g key={s.id}>
          <text
            x={s.x}
            y={s.y + 13}
            fontSize="10"
            fontWeight="500"
            letterSpacing="1"
            fill="#839087"
          >
            {String(i + 1).padStart(2, "0")}
          </text>
          {s.lines.map((line, i) => (
            <text
              key={i}
              x={s.x + 25}
              y={s.y + 13 + i * 18}
              fontSize="12"
              fontWeight="600"
              fill="#4d5f53"
            >
              {line}
            </text>
          ))}
        </g>
      ))}
      {drawnRoutes.map((r) => (
        <PipeDrawing
          key={r.edge.id}
          route={r}
          settings={d.settings}
          markerId="export"
        />
      ))}
      <BridgeDrawing routes={routes} settings={d.settings} />
      {cards.map((c) => (
        <g key={c.card.id} transform={`translate(${c.x} ${c.y})`}>
          <CardDrawing
            card={c.card}
            metrics={c.metrics}
            settings={d.settings}
          />
        </g>
      ))}
      {d.settings.showLegend && !selection?.length && (
        <g transform={`translate(28 ${layout.bounds.height - 26})`}>
          <LegendDrawing settings={d.settings} />
        </g>
      )}
    </g>
  );
}
export function DiagramSvg({
  document,
  layout,
  selection,
  fontCss = "",
}: {
  document: EconomyDocument;
  layout: Layout;
  selection?: string[];
  fontCss?: string;
}) {
  const selected = selection?.length
    ? layout.cards.filter((c) => selection.includes(c.card.id))
    : [];
  const minX = selected.length ? Math.min(...selected.map((c) => c.x)) - 24 : 0,
    minY = selected.length ? Math.min(...selected.map((c) => c.y)) - 24 : 0;
  const width = selected.length
    ? Math.max(...selected.map((c) => c.x + c.width)) - minX + 24
    : layout.bounds.width;
  const height = selected.length
    ? Math.max(...selected.map((c) => c.y + c.height)) - minY + 24
    : layout.bounds.height;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox={`${minX} ${minY} ${width} ${height}`}
    >
      <style>{fontCss}</style>
      {document.settings.background === "white" && (
        <rect x={minX} y={minY} width={width} height={height} fill="white" />
      )}
      <DiagramDrawing
        document={document}
        layout={layout}
        selection={selection}
      />
    </svg>
  );
}
