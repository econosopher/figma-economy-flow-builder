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
  "#0b8aa0",
  "#7f4cc9",
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

/** The single resource named on both ends of a pipe, or "" when none or several match. */
export function inferResource(
  from: Card | undefined,
  to: Card | undefined,
): string {
  if (!from || !to) return "";
  const targets = [...to.sinks, ...to.values]
    .map(resourceWords)
    .filter((w) => w.length);
  const matched: { name: string; words: string[] }[][] = [];
  for (const row of [...from.sources, ...from.values]) {
    const words = resourceWords(row);
    if (!targets.some((t) => sameResource(words, t))) continue;
    const cluster = matched.find((c) =>
      c.some((m) => sameResource(m.words, words)),
    );
    const entry = { name: resourceName(row), words };
    if (cluster) cluster.push(entry);
    else matched.push([entry]);
  }
  if (matched.length !== 1) return "";
  return [...matched[0]].sort((a, b) => a.words.length - b.words.length)[0]
    .name;
}

export function effectiveResource(
  edge: Pick<Pipe, "from" | "to"> & { resource?: string },
  cards: ReadonlyMap<string, Card>,
): string {
  return (
    edge.resource?.trim() ||
    inferResource(cards.get(edge.from), cards.get(edge.to))
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
