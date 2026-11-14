import type { Card, EconomyDocument, Pipe } from "./document";

/** The resource a row names: the words before any colon, dash or bracket, lower-cased. */
export function resourceWords(row: string): string[] {
  return row
    .split(/[:(\[]|\s[-–—]\s/)[0]
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}
/** Two rows name the same resource when the shorter name is a word-prefix of the longer. */
export function sameResource(a: string[], b: string[]): boolean {
  if (!a.length || !b.length) return false;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.every((word, i) => long[i] === word);
}
/** A row's display name: its text before any colon, dash or bracket. */
export const resourceName = (row: string) =>
  row.split(/[:(\[]|\s[-–—]\s/)[0].trim();

/** Pipe colours by resource, in assignment order. None reads as the row-sign colours
 * (green +, red -, ochre =), the selection gold or the default pipe grey, and each keeps
 * contrast on white and on the pale group fills. */
export const RESOURCE_PALETTE = [
  "#2563c9",
  "#c23787",
  "#7f4cc9",
  "#0b8aa0",
  "#8a5a44",
  "#1f3b73",
  "#db6bb8",
  "#3f454d",
] as const;

/** The rows that could name what a pipe carries: produced or held at the source, and spent
 * or held at the target. */
export function resourceCandidates(card: Card | undefined): string[] {
  if (!card) return [];
  const names: string[] = [];
  for (const row of [...card.sources, ...card.values]) {
    const name = resourceName(row);
    if (name && !names.some((n) => n.toLowerCase() === name.toLowerCase()))
      names.push(name);
  }
  return names;
}

/** Group rows that name the same resource; one group means one resource. Returns the
 * shortest name of the only group, or "" when there are none or several. */
function single(rows: string[]): string {
  const clusters: { name: string; words: string[] }[][] = [];
  for (const row of rows) {
    const words = resourceWords(row);
    if (!words.length) continue;
    const entry = { name: resourceName(row), words };
    const cluster = clusters.find((c) =>
      c.some((m) => sameResource(m.words, words)),
    );
    if (cluster) cluster.push(entry);
    else clusters.push([entry]);
  }
  if (clusters.length !== 1) return "";
  return [...clusters[0]].sort((a, b) => a.words.length - b.words.length)[0]
    .name;
}

/** What a pipe carries when its field is empty. First, the single resource named on both
 * ends (a source `+` or `=` row matching a target `-` or `=` row). Failing that, the single
 * resource among those rows on either card that the pipe's label names ("cash" names
 * "Cash balance"). Several matches, or none, infer nothing. */
export function inferResource(
  from: Card | undefined,
  to: Card | undefined,
  label = "",
): string {
  if (!from || !to) return "";
  const out = [...from.sources, ...from.values],
    into = [...to.sinks, ...to.values];
  const targets = into.map(resourceWords).filter((w) => w.length);
  const both = single(
    out.filter((row) =>
      targets.some((t) => sameResource(resourceWords(row), t)),
    ),
  );
  if (both) return both;
  const named = resourceWords(label);
  if (!named.length) return "";
  return single(
    // The label must be the row's name or a shorter form of it. A longer label
    // ("free bet or points boost") names more than one thing and infers nothing.
    [...out, ...into].filter((row) => {
      const words = resourceWords(row);
      return (
        named.length <= words.length && named.every((w, i) => words[i] === w)
      );
    }),
  );
}

export function effectiveResource(
  edge: Pick<Pipe, "from" | "to"> & { resource?: string; label?: string },
  cards: ReadonlyMap<string, Card>,
): string {
  return (
    edge.resource?.trim() ||
    inferResource(cards.get(edge.from), cards.get(edge.to), edge.label)
  );
}

export interface PipeResource {
  /** Shared by every pipe of the same resource: the lower-case words of its shortest name. */
  key: string;
  /** What this pipe's tag says. */
  name: string;
  /** Undefined from the ninth resource on: those pipes keep the default grey. */
  color?: string;
}
export interface ResourceKeyEntry {
  key: string;
  name: string;
  color: string;
}

/** Every pipe's effective resource, and a colour for the first eight resources in order of
 * first appearance on a card (document card order, then row order). */
export function pipeResources(d: Pick<EconomyDocument, "cards" | "edges">): {
  byEdge: Map<string, PipeResource>;
  legend: ResourceKeyEntry[];
} {
  const cards = new Map(d.cards.map((c) => [c.id, c]));
  const clusters: { words: string[]; name: string; edges: number }[] = [];
  const named: {
    id: string;
    name: string;
    cluster: (typeof clusters)[number];
  }[] = [];
  d.edges.forEach((edge, index) => {
    const name = effectiveResource(edge, cards);
    const words = resourceWords(name);
    if (!words.length) return;
    let cluster = clusters.find((c) => sameResource(c.words, words));
    if (!cluster) {
      cluster = { words, name, edges: index };
      clusters.push(cluster);
    } else if (words.length < cluster.words.length) {
      cluster.words = words;
      cluster.name = name;
    }
    named.push({ id: edge.id, name, cluster });
  });
  const rows = d.cards.flatMap((c) =>
    [...c.sources, ...c.sinks, ...c.values].map(resourceWords),
  );
  const firstRow = (c: (typeof clusters)[number]) => {
    const i = rows.findIndex((w) => sameResource(w, c.words));
    return i < 0 ? rows.length + c.edges : i;
  };
  const ordered = [...clusters].sort((a, b) => firstRow(a) - firstRow(b));
  const colors = new Map(
    ordered
      .slice(0, RESOURCE_PALETTE.length)
      .map((c, i) => [c, RESOURCE_PALETTE[i] as string]),
  );
  return {
    byEdge: new Map(
      named.map(({ id, name, cluster }) => [
        id,
        { key: cluster.words.join(" "), name, color: colors.get(cluster) },
      ]),
    ),
    legend: ordered
      .filter((c) => colors.has(c))
      .map((c) => ({
        key: c.words.join(" "),
        name: c.name,
        color: colors.get(c)!,
      })),
  };
}
