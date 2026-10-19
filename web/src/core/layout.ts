import type { Card, EconomyDocument, Pipe, Settings } from "./document";
export interface Point {
  x: number;
  y: number;
}
export interface Rect extends Point {
  width: number;
  height: number;
}
export interface Row {
  kind: "source" | "sink" | "value";
  lines: string[];
  y: number;
  height: number;
}
export interface CardMetrics {
  width: number;
  height: number;
  header: number;
  anchorY: number;
  title: string[];
  rows: Row[];
  notes: string[];
  notesY: number;
}
export interface PlacedCard extends Rect {
  card: Card;
  metrics: CardMetrics;
}
export interface RouteLabel {
  lines: string[];
  x: number;
  y: number;
  /** Set along a vertical track: the drawing rotates the text to run with the pipe. */
  vertical: boolean;
}
export interface Route {
  edge: Pipe;
  points: Point[];
  path: string;
  bridges: string[];
  unresolved: boolean;
  arrowhead?: boolean;
  label?: RouteLabel;
}
export interface Layout {
  documentId: string;
  cards: PlacedCard[];
  groups: (Rect & {
    id: string;
    label: string;
    lines: string[];
    header: number;
    color: string;
  })[];
  stages: (Rect & { id: string; label: string; lines: string[] })[];
  routes: Route[];
  bounds: Rect;
  issues: string[];
  spacing: Spacing;
}
export const TRACK = 12,
  CARD_WIDTH = 196;
/** Every geometry literal the layout and drawing share, chosen by `settings.spacing`. */
export interface Spacing {
  cardWidth: number;
  /** Narrowest channel that carries at least one track. */
  gapMin: number;
  /** Width of a channel with no tracks (the margins beside the first and last stage). */
  gapEmpty: number;
  /** Clearance added around the tracks in a channel; half of it precedes the first track. */
  gapPad: number;
  stackGap: number;
  marginLeft: number;
  marginRight: number;
  nameX: number;
  nameY: number;
  nameSize: number;
  brandSize: number;
  stagesY: number;
  stageSize: number;
  stageLine: number;
  stageIndent: number;
  /** Distance from the stage heading block to the first group. */
  stageGap: number;
  groupInset: number;
  groupHeader: number;
  groupSize: number;
  groupLine: number;
  groupPad: number;
  titleInset: number;
  titleSize: number;
  titleLine: number;
  headerMin: number;
  headerPad: number;
  headerGap: number;
  finalBand: number;
  finalSize: number;
  chipInset: number;
  symbolX: number;
  rowTextX: number;
  rowSize: number;
  rowLine: number;
  rowPad: number;
  rowGap: number;
  bottomPad: number;
  notesGap: number;
  notesSize: number;
  notesLine: number;
  labelSize: number;
  labelLine: number;
}
const comfortable: Spacing = {
  cardWidth: CARD_WIDTH,
  gapMin: 100,
  gapEmpty: 100,
  gapPad: 48,
  stackGap: 52,
  marginLeft: 40,
  marginRight: 28,
  nameX: 28,
  nameY: 28,
  nameSize: 16,
  brandSize: 10,
  stagesY: 60,
  stageSize: 12,
  stageLine: 18,
  stageIndent: 25,
  stageGap: 24,
  groupInset: 18,
  groupHeader: 34,
  groupSize: 12,
  groupLine: 18,
  groupPad: 36,
  titleInset: 16,
  titleSize: 13,
  titleLine: 19,
  headerMin: 60,
  headerPad: 30,
  headerGap: 8,
  finalBand: 24,
  finalSize: 9,
  chipInset: 12,
  symbolX: 21,
  rowTextX: 37,
  rowSize: 11,
  rowLine: 16,
  rowPad: 12,
  rowGap: 4,
  bottomPad: 8,
  notesGap: 12,
  notesSize: 11,
  notesLine: 16,
  labelSize: 11,
  labelLine: 14,
};
const compact: Spacing = {
  ...comfortable,
  gapMin: 72,
  gapEmpty: 72,
  stackGap: 40,
};
/** Sized so a five-column diagram across a 10-inch slide keeps chip text at 7pt or larger:
 * narrower cards, channels no wider than their tracks need, and larger type relative to width. */
const slide: Spacing = {
  cardWidth: 160,
  gapMin: 40,
  gapEmpty: 20,
  gapPad: 24,
  stackGap: 24,
  marginLeft: 20,
  marginRight: 16,
  nameX: 16,
  nameY: 20,
  nameSize: 13,
  brandSize: 9,
  stagesY: 32,
  stageSize: 11,
  stageLine: 16,
  stageIndent: 22,
  stageGap: 20,
  groupInset: 12,
  groupHeader: 26,
  groupSize: 11,
  groupLine: 16,
  groupPad: 20,
  titleInset: 12,
  titleSize: 13,
  titleLine: 16,
  headerMin: 44,
  headerPad: 22,
  headerGap: 6,
  finalBand: 20,
  finalSize: 8,
  chipInset: 8,
  symbolX: 15,
  rowTextX: 28,
  rowSize: 12,
  rowLine: 15,
  rowPad: 8,
  rowGap: 3,
  bottomPad: 6,
  notesGap: 10,
  notesSize: 11,
  notesLine: 14,
  labelSize: 12,
  labelLine: 14,
};
export function spacingFor(settings: Settings): Spacing {
  const base =
    settings.spacing === "slide"
      ? slide
      : settings.spacing === "compact"
        ? compact
        : comfortable;
  // Without the name band the stage headings move up to where the name was.
  return settings.showTitle
    ? base
    : { ...base, stagesY: base.stagesY - base.nameY + 4 };
}
export type Measure = (text: string, size: number, weight: number) => number;
export const approximateMeasure: Measure = (text, size) =>
  [...text].reduce(
    (w, c) =>
      w +
      ("MW@%".includes(c) ? 0.95 : "il.,:! ".includes(c) ? 0.3 : 0.6) * size,
    0,
  );
export function wrapText(
  text: string,
  width: number,
  size: number,
  weight: number,
  measure: Measure,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (measure(word, size, weight) > width) {
        if (line) lines.push(line);
        line = "";
        for (const char of word) {
          if (measure(line + char, size, weight) > width) {
            lines.push(line);
            line = "";
          }
          line += char;
        }
      } else if (line && measure(`${line} ${word}`, size, weight) > width) {
        lines.push(line);
        line = word;
      } else line = line ? `${line} ${word}` : word;
    }
    lines.push(line);
  }
  return lines.length ? lines : [""];
}
export function measureHeadings(
  d: EconomyDocument,
  measure: Measure = approximateMeasure,
) {
  const sp = spacingFor(d.settings);
  return {
    stages: Object.fromEntries(
      d.stages.map((s) => [
        s.id,
        wrapText(
          s.label,
          sp.cardWidth - sp.stageIndent,
          sp.stageSize,
          600,
          measure,
        ),
      ]),
    ),
    groups: Object.fromEntries(
      d.groups.map((g) => [
        g.id,
        wrapText(g.label, sp.cardWidth, sp.groupSize, 600, measure),
      ]),
    ),
  };
}
export function measureCards(
  d: EconomyDocument,
  measure: Measure = approximateMeasure,
): Record<string, CardMetrics> {
  const sp = spacingFor(d.settings);
  return Object.fromEntries(
    d.cards.map((c) => {
      const title = wrapText(
        c.label,
        sp.cardWidth - 2 * sp.titleInset,
        sp.titleSize,
        600,
        measure,
      );
      const finalBand = c.kind === "final_good" ? sp.finalBand : 0;
      const header =
        Math.max(sp.headerMin, title.length * sp.titleLine + sp.headerPad) +
        finalBand;
      let y = header + sp.headerGap;
      const rows: Row[] = [];
      for (const [kind, values] of [
        ["source", c.sources],
        ["sink", c.sinks],
        ["value", c.values],
      ] as const)
        for (const value of values) {
          const lines = wrapText(
            value,
            sp.cardWidth - sp.rowTextX - 15,
            sp.rowSize,
            400,
            measure,
          );
          const height = lines.length * sp.rowLine + sp.rowPad;
          rows.push({ kind, lines, y, height });
          y += height + sp.rowGap;
        }
      const notes = c.notes
        ? wrapText(
            c.notes,
            sp.cardWidth - 2 * sp.titleInset,
            sp.notesSize,
            400,
            measure,
          )
        : [];
      const notesY = y + (notes.length ? sp.notesGap : 0);
      return [
        c.id,
        {
          width: sp.cardWidth,
          height: Math.max(
            header + 4,
            (rows.length ? y + sp.bottomPad : y) +
              (notes.length
                ? notes.length * sp.notesLine + sp.notesLine + 10
                : 0),
          ),
          header,
          anchorY: (header + finalBand) / 2,
          title,
          rows,
          notes,
          notesY,
        },
      ];
    }),
  );
}
function segmentHits(a: Point, b: Point, r: Rect, pad = 8): boolean {
  const l = r.x - pad,
    t = r.y - pad,
    rr = r.x + r.width + pad,
    bb = r.y + r.height + pad;
  if (a.x === b.x)
    return (
      a.x > l && a.x < rr && Math.max(a.y, b.y) > t && Math.min(a.y, b.y) < bb
    );
  return (
    a.y > t && a.y < bb && Math.max(a.x, b.x) > l && Math.min(a.x, b.x) < rr
  );
}
export function routeHitsCard(points: Point[], r: Rect, pad = 8) {
  return points.slice(1).some((p, i) => segmentHits(points[i], p, r, pad));
}
function simplify(points: Point[]): Point[] {
  return points
    .filter((p, i) => !i || p.x !== points[i - 1].x || p.y !== points[i - 1].y)
    .filter(
      (p, i, arr) =>
        !i ||
        i === arr.length - 1 ||
        !(
          (arr[i - 1].x === p.x && p.x === arr[i + 1].x) ||
          (arr[i - 1].y === p.y && p.y === arr[i + 1].y)
        ),
    );
}
function length(points: Point[]) {
  return points
    .slice(1)
    .reduce(
      (s, p, i) =>
        s + Math.abs(p.x - points[i].x) + Math.abs(p.y - points[i].y),
      0,
    );
}
export function sharedLength(a: Point[], b: Point[]): number {
  let total = 0;
  for (let i = 1; i < a.length; i++)
    for (let j = 1; j < b.length; j++) {
      const p = a[i - 1],
        q = a[i],
        r = b[j - 1],
        s = b[j];
      if (p.x === q.x && r.x === s.x && Math.abs(p.x - r.x) < 0.1)
        total += Math.max(
          0,
          Math.min(Math.max(p.y, q.y), Math.max(r.y, s.y)) -
            Math.max(Math.min(p.y, q.y), Math.min(r.y, s.y)),
        );
      if (p.y === q.y && r.y === s.y && Math.abs(p.y - r.y) < 0.1)
        total += Math.max(
          0,
          Math.min(Math.max(p.x, q.x), Math.max(r.x, s.x)) -
            Math.max(Math.min(p.x, q.x), Math.min(r.x, s.x)),
        );
    }
  return total;
}
export function parallelTooClose(
  a: Point[],
  b: Point[],
  distance = TRACK - 0.1,
): boolean {
  for (let i = 1; i < a.length; i++)
    for (let j = 1; j < b.length; j++) {
      const p = a[i - 1],
        q = a[i],
        r = b[j - 1],
        s = b[j];
      if (
        p.x === q.x &&
        r.x === s.x &&
        Math.abs(p.x - r.x) < distance &&
        Math.min(Math.max(p.y, q.y), Math.max(r.y, s.y)) -
          Math.max(Math.min(p.y, q.y), Math.min(r.y, s.y)) >
          0.1
      )
        return true;
      if (
        p.y === q.y &&
        r.y === s.y &&
        Math.abs(p.y - r.y) < distance &&
        Math.min(Math.max(p.x, q.x), Math.max(r.x, s.x)) -
          Math.max(Math.min(p.x, q.x), Math.min(r.x, s.x)) >
          0.1
      )
        return true;
    }
  return false;
}
/** Only coincident horizontal terminal segments for the SAME endpoint may overlap.
 * Full duplicate paths, nearby parallel tracks, and shared intermediate segments conflict. */
export function tracksConflict(
  a: { points: Point[]; edge: Pipe; terminal?: "source" | "target" },
  b: { points: Point[]; edge: Pipe; terminal?: "source" | "target" },
): boolean {
  if (
    !a.terminal &&
    !b.terminal &&
    a.points.length > 1 &&
    a.points.length === b.points.length &&
    a.points.every((p, i) => p.x === b.points[i].x && p.y === b.points[i].y)
  )
    return true;
  for (let i = 1; i < a.points.length; i++) {
    for (let j = 1; j < b.points.length; j++) {
      const p = a.points[i - 1],
        q = a.points[i],
        r = b.points[j - 1],
        s = b.points[j];
      if (!parallelTooClose([p, q], [r, s])) continue;
      const sameHorizontal = p.y === q.y && r.y === s.y && p.y === r.y;
      const sharedStart =
        a.edge.from === b.edge.from &&
        a.terminal !== "target" &&
        b.terminal !== "target" &&
        i === 1 &&
        j === 1 &&
        p.x === r.x &&
        p.y === r.y;
      const sharedEnd =
        a.edge.to === b.edge.to &&
        a.terminal !== "source" &&
        b.terminal !== "source" &&
        i === a.points.length - 1 &&
        j === b.points.length - 1 &&
        q.x === s.x &&
        q.y === s.y;
      if (!(sameHorizontal && (sharedStart || sharedEnd))) return true;
    }
  }
  return false;
}
export function crossingBridges(points: Point[], routes: Route[]): string[] {
  const result: string[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    if (a.y !== b.y) continue;
    const crossing = new Set<number>();
    for (const route of routes)
      for (let j = 1; j < route.points.length; j++) {
        const c = route.points[j - 1],
          e = route.points[j];
        if (
          c.x === e.x &&
          c.x > Math.min(a.x, b.x) + 7 &&
          c.x < Math.max(a.x, b.x) - 7 &&
          a.y > Math.min(c.y, e.y) + 5 &&
          a.y < Math.max(c.y, e.y) - 5
        )
          crossing.add(c.x);
      }
    for (const x of crossing)
      result.push(`M ${x - 4} ${a.y} Q ${x} ${a.y - 7} ${x + 4} ${a.y}`);
  }
  return result;
}
function bridgePath(points: Point[], routes: Route[]): string {
  if (!points.length) return "";
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    const crossings: number[] = [];
    if (a.y === b.y)
      for (const route of routes)
        for (let j = 1; j < route.points.length; j++) {
          const c = route.points[j - 1],
            e = route.points[j];
          if (
            c.x === e.x &&
            c.x > Math.min(a.x, b.x) + 7 &&
            c.x < Math.max(a.x, b.x) - 7 &&
            a.y > Math.min(c.y, e.y) + 5 &&
            a.y < Math.max(c.y, e.y) - 5
          )
            crossings.push(c.x);
        }
    const direction = b.x >= a.x ? 1 : -1;
    for (const x of [...new Set(crossings)].sort((x, y) => (x - y) * direction))
      path += ` L ${x - 4 * direction} ${a.y} Q ${x} ${a.y - 7} ${x + 4 * direction} ${a.y}`;
    path += ` L ${b.x} ${b.y}`;
  }
  return path;
}
export function layoutDocument(
  d: EconomyDocument,
  measured = measureCards(d),
  headings = measureHeadings(d),
  measure: Measure = approximateMeasure,
): Layout {
  const sp = spacingFor(d.settings);
  const edges = [...d.edges];
  const edgeOrder = new Map(edges.map((edge, index) => [edge.id, index]));
  const stageIndex = new Map(d.stages.map((s, i) => [s.id, i]));
  const cardData = new Map(d.cards.map((c) => [c.id, c]));
  const channels: Array<string[]> = Array.from(
    { length: d.stages.length + 1 },
    () => [],
  );
  for (const e of edges) {
    const a = cardData.get(e.from),
      b = cardData.get(e.to);
    if (a && b) {
      channels[stageIndex.get(a.stageId)! + 1].push(`o:${e.id}`);
      channels[stageIndex.get(b.stageId)!].push(`i:${e.id}`);
    }
  }
  channels.forEach((c) =>
    c.sort((a, b) =>
      a[0] === b[0]
        ? edgeOrder.get(a.slice(2))! - edgeOrder.get(b.slice(2))!
        : a[0] === "o"
          ? -1
          : 1,
    ),
  );
  const gapWidths = channels.map((c) =>
    c.length ? Math.max(sp.gapMin, c.length * TRACK + sp.gapPad) : sp.gapEmpty,
  );
  const stageXs: number[] = [];
  let x = sp.marginLeft + gapWidths[0];
  for (let i = 0; i < d.stages.length; i++) {
    stageXs.push(x);
    x += sp.cardWidth + gapWidths[i + 1];
  }
  const width = x + sp.marginRight;
  const stackGap = sp.stackGap;
  const groups: Layout["groups"] = [];
  const cards: PlacedCard[] = [];
  let y =
    sp.stagesY +
    sp.stageGap +
    Math.max(
      ...Object.values(headings.stages).map(
        (lines) => lines.length * sp.stageLine,
      ),
    );
  const corridors: number[] = [];
  for (const g of d.groups) {
    const stacks = d.stages.map((s) =>
      d.cards
        .filter((c) => c.stageId === s.id && c.groupId === g.id)
        .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)),
    );
    const stackHeight = Math.max(
      96,
      ...stacks.map(
        (cs) =>
          cs.reduce((h, c) => h + measured[c.id].height, 0) +
          Math.max(0, cs.length - 1) * stackGap,
      ),
    );
    const crossing = edges.filter(
      (e) =>
        cardData.get(e.from)?.groupId === g.id ||
        cardData.get(e.to)?.groupId === g.id,
    ).length;
    const trackSpace = Math.max(36, Math.ceil(crossing / 2) * TRACK + 24);
    const header = sp.groupHeader + headings.groups[g.id].length * sp.groupLine;
    const groupHeight = stackHeight + header + sp.groupPad;
    groups.push({
      id: g.id,
      label: g.label,
      lines: headings.groups[g.id],
      header,
      color: g.color,
      x: stageXs[0] - sp.groupInset,
      y,
      width: width - sp.marginRight - (stageXs[0] - sp.groupInset),
      height: groupHeight,
    });
    stacks.forEach((cs, i) => {
      let yy = y + header;
      for (const c of cs) {
        const metrics = measured[c.id];
        cards.push({
          card: c,
          metrics,
          x: stageXs[i],
          y: yy,
          width: metrics.width,
          height: metrics.height,
        });
        yy += metrics.height + stackGap;
      }
    });
    for (let n = 0; n < Math.ceil(trackSpace / TRACK); n++)
      corridors.push(y + groupHeight + 12 + n * TRACK);
    y += groupHeight + trackSpace;
  }
  const byId = new Map(cards.map((c) => [c.card.id, c]));
  const routes: Route[] = [];
  const issues: string[] = [];
  const sideX = (edgeId: string, stage: number, side: "i" | "o") => {
    const gap = side === "o" ? stage + 1 : stage;
    const left = gap === 0 ? sp.marginLeft : stageXs[gap - 1] + sp.cardWidth;
    return (
      left + sp.gapPad / 2 + channels[gap].indexOf(`${side}:${edgeId}`) * TRACK
    );
  };
  const port = (c: PlacedCard, _e: Pipe, out: boolean) => ({
    x: c.x + (out ? c.width : 0),
    y: c.y + c.metrics.anchorY,
  });
  const reservedStubs = edges.flatMap((e) => {
    const a = byId.get(e.from),
      b = byId.get(e.to);
    if (!a || !b) return [];
    const start = port(a, e, true),
      end = port(b, e, false);
    return [
      {
        edge: e,
        terminal: "source" as const,
        points: [
          start,
          { x: sideX(e.id, stageIndex.get(a.card.stageId)!, "o"), y: start.y },
        ],
      },
      {
        edge: e,
        terminal: "target" as const,
        points: [
          { x: sideX(e.id, stageIndex.get(b.card.stageId)!, "i"), y: end.y },
          end,
        ],
      },
    ];
  });
  for (const e of edges) {
    const a = byId.get(e.from),
      b = byId.get(e.to);
    if (!a || !b) continue;
    const start = port(a, e, true),
      end = port(b, e, false);
    const ai = stageIndex.get(a.card.stageId)!,
      bi = stageIndex.get(b.card.stageId)!;
    const ax = sideX(e.id, ai, "o"),
      bx = sideX(e.id, bi, "i");
    const candidates: Point[][] = [];
    if (!e.feedback) {
      if (start.y === end.y) candidates.push([start, end]);
      candidates.push([start, { x: ax, y: start.y }, { x: ax, y: end.y }, end]);
      candidates.push([start, { x: bx, y: start.y }, { x: bx, y: end.y }, end]);
    }
    for (const cy of [...corridors].sort(
      (p, q) =>
        Math.abs(p - start.y) +
        Math.abs(p - end.y) -
        (Math.abs(q - start.y) + Math.abs(q - end.y)),
    ))
      candidates.push([
        start,
        { x: ax, y: start.y },
        { x: ax, y: cy },
        { x: bx, y: cy },
        { x: bx, y: end.y },
        end,
      ]);
    const obstacleFree = (ps: Point[]) =>
      cards.every((c) => c === a || c === b || !routeHitsCard(ps, c));
    const separate = (ps: Point[]) =>
      reservedStubs.every(
        (r) =>
          r.edge.id === e.id || !tracksConflict({ points: ps, edge: e }, r),
      ) && routes.every((r) => !tracksConflict({ points: ps, edge: e }, r));
    let points = candidates
      .map(simplify)
      .sort((p, q) => length(p) + p.length * 8 - length(q) - q.length * 8)
      .find((ps) => obstacleFree(ps) && separate(ps));
    // A distinct external track is a bounded last resort, never a line through a card.
    if (!points) {
      for (let attempt = 0; attempt < edges.length + 1; attempt++) {
        const cy = y + 24 + attempt * TRACK;
        const candidate = simplify([
          start,
          { x: ax, y: start.y },
          { x: ax, y: cy },
          { x: bx, y: cy },
          { x: bx, y: end.y },
          end,
        ]);
        if (obstacleFree(candidate) && separate(candidate)) {
          points = candidate;
          break;
        }
      }
    }
    const unresolved = !points;
    if (unresolved) {
      issues.push(
        `Could not route ${a.card.label} → ${b.card.label}. Move a card or add a stage.`,
      );
      points = [];
    }
    const resolvedPoints = points || [];
    const route = {
      edge: e,
      points: resolvedPoints,
      path: bridgePath(resolvedPoints, routes),
      bridges: [] as string[],
      unresolved,
    };
    routes.push(route);
  }
  // Paint every crossing after all base pipes, independent of edge insertion order.
  for (const route of routes) {
    const others = routes.filter((r) => r !== route);
    route.path = bridgePath(route.points, others);
    route.bridges = crossingBridges(route.points, others);
    route.label = d.settings.showLabels
      ? placeLabel(route, sp, measure)
      : undefined;
    route.arrowhead = !routes.some(
      (r) =>
        r !== route &&
        !r.unresolved &&
        r.edge.to === route.edge.to &&
        routes.indexOf(r) < routes.indexOf(route),
    );
  }
  const maxY =
    Math.max(y, ...routes.flatMap((r) => r.points.map((p) => p.y))) + 32;
  return {
    documentId: d.id,
    cards,
    groups,
    stages: d.stages.map((s, i) => ({
      ...s,
      x: stageXs[i],
      y: sp.stagesY,
      width: sp.cardWidth,
      height: headings.stages[s.id].length * sp.stageLine,
      lines: headings.stages[s.id],
    })),
    routes,
    bounds: {
      x: 0,
      y: 0,
      width,
      height: maxY + (d.settings.showLegend ? 58 : 0),
    },
    issues,
    spacing: sp,
  };
}
/** A pipe label sits on the longest straight run of its route: above a horizontal segment,
 * or rotated along a vertical track when no horizontal run can hold the text. It never leaves
 * the segment's extent, so it stays clear of cards; it may sit beside neighbouring tracks. */
export function placeLabel(
  route: Pick<Route, "edge" | "points">,
  sp: Spacing,
  measure: Measure = approximateMeasure,
): RouteLabel | undefined {
  const text = route.edge.label.trim();
  if (!text || route.points.length < 2) return undefined;
  const segments = route.points.slice(1).map((b, i) => {
    const a = route.points[i];
    return {
      a,
      b,
      vertical: a.x === b.x,
      length: Math.abs(b.x - a.x) + Math.abs(b.y - a.y),
    };
  });
  const longest = (list: typeof segments) =>
    list.reduce<(typeof segments)[number] | undefined>(
      (best, s) => (!best || s.length > best.length ? s : best),
      undefined,
    );
  const horizontal = longest(segments.filter((s) => !s.vertical));
  const fits = (s: { length: number }) =>
    measure(text, sp.labelSize, 400) <= s.length - 8;
  const chosen =
    horizontal && fits(horizontal) ? horizontal : longest(segments);
  if (!chosen) return undefined;
  return {
    lines: wrapText(
      text,
      Math.max(chosen.length - 8, 40),
      sp.labelSize,
      400,
      measure,
    ),
    x: (chosen.a.x + chosen.b.x) / 2,
    y: (chosen.a.y + chosen.b.y) / 2,
    vertical: chosen.vertical,
  };
}
