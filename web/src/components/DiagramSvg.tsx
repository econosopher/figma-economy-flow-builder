import { useId } from "react";
import {
  cardLayer,
  type Card,
  type CardLayer,
  type Settings,
  type EconomyDocument,
} from "../core/document";
import {
  BOX_KEY_ROW,
  BOX_KEY_SWATCH,
  LEGEND_ROW,
  TAG_SIZE,
  pipeEnds,
  spacingFor,
  type CardMetrics,
  type Layout,
  type ResourceLegend,
  type Route,
} from "../core/layout";
import type { Focus } from "../core/trace";
/** The selection gold, used for a selected pipe that has no resource colour. */
export const SELECTED = "#b08716";
/** Opacity of pipes and cards outside the focused path. */
export const DIM_PIPE = 0.15,
  DIM_CARD = 0.45;
export function ink(fill: string) {
  const rgb = [1, 3, 5].map((i) => {
    const c = parseInt(fill.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] > 0.179
    ? "#000000"
    : "#ffffff";
}
/** An id that is unique per drawing and safe inside `url(#...)`. */
const usePatternId = () => `layer-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
/** The layer pattern, in the ink of the bar it covers: thin diagonal lines, leaning right for
 * designed-not-built and left for a proposal. A live box has no pattern, so this is never drawn for one. */
function LayerPattern({
  id,
  layer,
  ink,
}: {
  id: string;
  layer: Exclude<CardLayer, "live">;
  ink: string;
}) {
  return (
    <pattern
      id={id}
      width="7"
      height="7"
      patternUnits="userSpaceOnUse"
      patternTransform={`rotate(${layer === "design" ? 45 : -45})`}
    >
      <rect width="1.1" height="7" fill={ink} />
    </pattern>
  );
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
  const sp = spacingFor(settings);
  const layer = cardLayer(card);
  const patternId = usePatternId();
  // Over a pattern the title keeps a halo in the bar colour so it stays readable.
  const halo =
    layer === "live"
      ? {}
      : {
          stroke: fill,
          strokeWidth: 5,
          strokeLinejoin: "round" as const,
          paintOrder: "stroke",
        };
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
      {layer !== "live" && (
        <>
          <defs>
            <LayerPattern id={patternId} layer={layer} ink={tint} />
          </defs>
          <rect
            data-layer={layer}
            x="1.5"
            y="1.5"
            width={metrics.width - 3}
            height={metrics.header - 1}
            rx="7"
            fill={`url(#${patternId})`}
          />
        </>
      )}
      {isFinal && (
        <>
          <path
            d={`M 8 1.5 H ${metrics.width - 8} Q ${metrics.width - 1.5} 1.5 ${metrics.width - 1.5} 8 V ${sp.finalBand} H 1.5 V 8 Q 1.5 1.5 8 1.5`}
            fill="#000000"
          />
          <text
            x={sp.titleInset}
            y={sp.finalBand - 7}
            fontSize={sp.finalSize}
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
          x={sp.titleInset}
          y={
            metrics.anchorY -
            (metrics.title.length * sp.titleLine) / 2 +
            Math.round(sp.titleLine * 0.74) +
            i * sp.titleLine
          }
          fontSize={sp.titleSize}
          fontWeight="600"
          fill={tint}
          {...halo}
        >
          {t}
        </text>
      ))}
      {metrics.rows.map((row, i) => (
        <g key={i}>
          <rect
            x={sp.chipInset}
            y={row.y}
            width={metrics.width - 2 * sp.chipInset}
            height={row.height}
            rx="4"
            fill={settings[row.kind]}
          />
          <text
            x={sp.symbolX}
            y={row.y + sp.rowPad / 2 + sp.rowLine * 0.75}
            fontSize={sp.rowSize + 1}
            fill={ink(settings[row.kind])}
            fontWeight="600"
          >
            {row.kind === "source" ? "+" : row.kind === "sink" ? "−" : "="}
          </text>
          {row.lines.map((line, j) => (
            <text
              key={j}
              x={sp.rowTextX}
              y={row.y + sp.rowPad / 2 + sp.rowLine * 0.75 + j * sp.rowLine}
              fontSize={sp.rowSize}
              fill={ink(settings[row.kind])}
            >
              {line}
            </text>
          ))}
        </g>
      ))}
      {metrics.notes.length > 0 && (
        <line
          x1={sp.titleInset}
          y1={metrics.notesY - sp.notesGap + 5}
          x2={metrics.width - sp.titleInset}
          y2={metrics.notesY - sp.notesGap + 5}
          stroke="#e9edea"
        />
      )}
      {metrics.notes.map((line, j) => (
        <text
          key={j}
          x={sp.titleInset}
          y={
            metrics.notesY + Math.round(sp.notesLine * 0.69) + j * sp.notesLine
          }
          fontSize={sp.notesSize}
          fill="#68736d"
        >
          {line}
        </text>
      ))}
    </g>
  );
}
/** A pipe's own colour: its resource colour while resources show, else value or grey. */
export const pipeColor = (route: Route, s: Settings) =>
  (s.showResources && route.resource?.color) ||
  (route.edge.type === "value" ? s.value : "#89978f");
/** A selected pipe keeps its resource colour; one without turns gold, as before. */
const strokeColor = (route: Route, s: Settings, selected: boolean) =>
  selected
    ? (s.showResources && route.resource?.color) || SELECTED
    : pipeColor(route, s);
export function PipeDrawing({
  route,
  settings,
  selected = false,
  dimmed = false,
  markerId = "arrow",
}: {
  route: Route;
  settings: Settings;
  selected?: boolean;
  /** Outside the focused path: drawn at low opacity. */
  dimmed?: boolean;
  markerId?: string;
}) {
  const color = strokeColor(route, settings, selected);
  const sp = spacingFor(settings);
  const label = route.label;
  return (
    <g className="pipe-drawing" opacity={dimmed ? DIM_PIPE : undefined}>
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
        strokeWidth={selected ? 2.8 : route.edge.feedback ? 1.5 : 2}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray={route.edge.type === "final" ? "6 5" : undefined}
        markerEnd={
          route.arrowhead === false
            ? undefined
            : `url(#${markerId}-${route.edge.id})`
        }
      />
      {label && (
        <g
          transform={`translate(${label.x} ${label.y})${label.vertical ? " rotate(-90)" : ""}`}
          fontFamily="Inter, Arial, sans-serif"
          fontSize={sp.labelSize}
          textAnchor="middle"
          fill={selected ? color : "#5b6a62"}
          stroke="white"
          strokeWidth="3"
          strokeLinejoin="round"
          paintOrder="stroke"
        >
          {label.lines.map((line, i) => (
            <text key={i} y={-(label.lines.length - 1 - i) * sp.labelLine - 4}>
              {line}
            </text>
          ))}
        </g>
      )}
    </g>
  );
}
/** Arrowheads and join dots for the pipes being drawn. In a focus the focused pipes get
 * their own: a focused pipe whose card's first pipe is dimmed still ends in a full-strength
 * arrowhead instead of a dot on a faded line. */
export function withEnds(
  routes: Route[],
  dimmed?: ReadonlySet<string>,
): Route[] {
  const ends = pipeEnds(routes);
  const focused = dimmed
    ? routes.filter((r) => !dimmed.has(r.edge.id))
    : routes;
  const own = new Map(pipeEnds(focused).map((e, i) => [focused[i].edge.id, e]));
  return routes.map((r, i) => {
    const e = (dimmed && own.get(r.edge.id)) || ends[i];
    return { ...r, arrowhead: e.arrowhead, join: e.join };
  });
}
/** Join dots and resource tags, painted after every pipe so no later pipe covers them. */
export function PipeMarks({
  routes,
  settings,
  selectedId,
  dimmedIds,
}: {
  routes: Route[];
  settings: Settings;
  selectedId?: string;
  /** Pipes outside the focused path. */
  dimmedIds?: ReadonlySet<string>;
}) {
  return (
    <g pointerEvents="none" fontFamily="Inter, Arial, sans-serif">
      {routes
        .filter((r) => r.join || (settings.showResources && r.tag))
        .map((route) => {
          const color = strokeColor(
            route,
            settings,
            selectedId === route.edge.id,
          );
          const tag = settings.showResources ? route.tag : undefined;
          return (
            <g
              key={route.edge.id}
              className="pipe-drawing"
              opacity={dimmedIds?.has(route.edge.id) ? DIM_PIPE : undefined}
            >
              {route.join && (
                <circle
                  cx={route.join.x}
                  cy={route.join.y}
                  r="3"
                  fill={color}
                />
              )}
              {tag && (
                <g
                  transform={`translate(${tag.x} ${tag.y})${tag.vertical ? " rotate(-90)" : ""}`}
                >
                  <rect
                    x={-tag.width / 2}
                    y={-tag.height / 2}
                    width={tag.width}
                    height={tag.height}
                    rx={tag.height / 2}
                    fill="white"
                    stroke={color}
                    strokeWidth="1"
                  />
                  <text
                    y={TAG_SIZE * 0.36}
                    textAnchor="middle"
                    fontSize={TAG_SIZE}
                    fontWeight="500"
                    fill="#2b3530"
                  >
                    {tag.text}
                  </text>
                </g>
              )}
            </g>
          );
        })}
    </g>
  );
}
export function LegendDrawing({
  settings,
  legend,
}: {
  settings: Settings;
  legend?: ResourceLegend;
}) {
  const patternId = usePatternId();
  const boxKeyY = LEGEND_ROW * Math.max(0, (legend?.rows ?? 0) - 1) + 12;
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
      {settings.showResources &&
        legend?.items.map((item) => (
          <g
            key={item.key}
            transform={`translate(${item.x} ${item.row * LEGEND_ROW})`}
          >
            <line
              x1="1"
              x2="17"
              y1="-4"
              y2="-4"
              stroke={item.color}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <text x="26" fontSize="11" fill="#637168">
              {item.name}
            </text>
          </g>
        ))}
      {!!legend?.layers.length && (
        <g transform={`translate(0 ${boxKeyY})`}>
          <text y="14" fontSize="10" fill="#8a968f">
            BOX KEY
          </text>
          {legend.layers.map((item) => (
            <g
              key={item.layer}
              transform={`translate(${item.x} ${item.row * BOX_KEY_ROW})`}
            >
              <rect
                width={BOX_KEY_SWATCH.width}
                height={BOX_KEY_SWATCH.height}
                rx="5"
                fill={settings.actionHeader}
              />
              {item.layer !== "live" && (
                <>
                  <defs>
                    <LayerPattern
                      id={`${patternId}-${item.layer}`}
                      layer={item.layer}
                      ink={ink(settings.actionHeader)}
                    />
                  </defs>
                  <rect
                    width={BOX_KEY_SWATCH.width}
                    height={BOX_KEY_SWATCH.height}
                    rx="5"
                    fill={`url(#${patternId}-${item.layer})`}
                  />
                </>
              )}
              <text
                x={BOX_KEY_SWATCH.width + 10}
                y="14"
                fontSize="11"
                fill="#637168"
              >
                {item.key}
              </text>
            </g>
          ))}
        </g>
      )}
    </g>
  );
}
export function DiagramDrawing({
  document: d,
  layout,
  selection,
  focus,
}: {
  document: EconomyDocument;
  layout: Layout;
  selection?: string[];
  /** Draws everything outside these cards and pipes dimmed, as the canvas focus does. */
  focus?: Focus;
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
  const focusCards = focus && new Set(focus.cards),
    dimmedPipes =
      focus &&
      new Set(
        routes
          .filter((r) => !focus.edges.includes(r.edge.id))
          .map((r) => r.edge.id),
      );
  // A selection drops pipes, so the first arrowhead and the joins are found again.
  const drawnRoutes = withEnds(routes, dimmedPipes);
  const sp = spacingFor(d.settings);
  return (
    <g fontFamily="Inter, Arial, sans-serif">
      {!selection?.length && d.settings.showTitle && (
        <>
          <text
            x={sp.nameX}
            y={sp.nameY}
            fontSize={sp.nameSize}
            fontWeight="600"
            fill="#23332b"
          >
            {d.name}
          </text>
          <text
            x={layout.bounds.width - sp.nameX}
            y={sp.nameY}
            textAnchor="end"
            fontSize={sp.brandSize}
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
                x={g.x + sp.groupInset}
                y={g.y + sp.groupHeader - 8 + i * sp.groupLine}
                fontSize={sp.groupSize}
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
            y={s.y + Math.round(sp.stageLine * 0.72)}
            fontSize={sp.stageSize - 2}
            fontWeight="500"
            letterSpacing="1"
            fill="#839087"
          >
            {String(i + 1).padStart(2, "0")}
          </text>
          {s.lines.map((line, i) => (
            <text
              key={i}
              x={s.x + sp.stageIndent}
              y={s.y + Math.round(sp.stageLine * 0.72) + i * sp.stageLine}
              fontSize={sp.stageSize}
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
          dimmed={dimmedPipes?.has(r.edge.id)}
          markerId="export"
        />
      ))}
      <PipeMarks
        routes={drawnRoutes}
        settings={d.settings}
        dimmedIds={dimmedPipes}
      />
      {cards.map((c) => (
        <g
          key={c.card.id}
          transform={`translate(${c.x} ${c.y})`}
          opacity={
            focusCards && !focusCards.has(c.card.id) ? DIM_CARD : undefined
          }
        >
          <CardDrawing
            card={c.card}
            metrics={c.metrics}
            settings={d.settings}
          />
        </g>
      ))}
      {d.settings.showLegend && !selection?.length && (
        <g
          transform={`translate(28 ${layout.bounds.height - 26 - LEGEND_ROW * Math.max(0, layout.legend.rows - 1) - BOX_KEY_ROW * layout.legend.layerRows})`}
        >
          <LegendDrawing settings={d.settings} legend={layout.legend} />
        </g>
      )}
    </g>
  );
}
export function DiagramSvg({
  document,
  layout,
  selection,
  focus,
  fontCss = "",
}: {
  document: EconomyDocument;
  layout: Layout;
  selection?: string[];
  focus?: Focus;
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
        focus={focus}
      />
    </svg>
  );
}
