import type { Card, EconomyDocument } from "./document";
import {
  approximateMeasure,
  measureCards,
  spacingFor,
  type Measure,
} from "./layout";
import { ECONOMY_FLOW_RULES_VERSION } from "./rules";

/**
 * Soft checks for the GEC economy-flow standard (docs/ECONOMY_FLOW_RULES.md, "Validator
 * coverage"). `validateDocument` keeps the hard errors; everything here is a warning that
 * names the card, pipe or resource so the author can fix the diagram or record the unknown
 * in `research.limitations`. The checks never block a save and never change the layout.
 */
export interface StandardIssue {
  rule: string;
  severity: "warning";
  message: string;
  cardId?: string;
  edgeId?: string;
  resource?: string;
}

/** Words that mark a row as a spendable currency or inventory rather than progression. */
const SPENDABLE_WORDS = new Set([
  "ammo",
  "ammunition",
  "buck",
  "bucks",
  "cash",
  "coin",
  "coins",
  "credit",
  "credits",
  "crystal",
  "crystals",
  "currency",
  "diamond",
  "diamonds",
  "dust",
  "energy",
  "gem",
  "gems",
  "gold",
  "iron",
  "item",
  "items",
  "inventory",
  "key",
  "keys",
  "lives",
  "loot",
  "material",
  "materials",
  "money",
  "part",
  "parts",
  "revive",
  "revives",
  "scrap",
  "shard",
  "shards",
  "silver",
  "stamina",
  "ticket",
  "tickets",
  "token",
  "tokens",
]);
/** Words that mark a row as progression even when it borrows a currency word (`Gold rank`). */
const PROGRESSION_WORDS = new Set([
  "badge",
  "badges",
  "league",
  "level",
  "levels",
  "mastery",
  "medal",
  "medals",
  "rank",
  "ranks",
  "rating",
  "reputation",
  "star",
  "stars",
  "tier",
  "tiers",
  "unlock",
  "unlocks",
  "xp",
]);

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

interface Row {
  card: Card;
  kind: "source" | "sink" | "value";
  text: string;
  words: string[];
}

export function checkStandard(
  d: EconomyDocument,
  measure: Measure = approximateMeasure,
): StandardIssue[] {
  const issues: StandardIssue[] = [];
  const warn = (
    rule: string,
    message: string,
    ref: Omit<StandardIssue, "rule" | "severity" | "message"> = {},
  ) => issues.push({ rule, severity: "warning", message, ...ref });
  const metrics = measureCards(d, measure);
  const sp = spacingFor(d.settings);
  const cards = new Map(d.cards.map((c) => [c.id, c]));

  // GEC-011: roots carry no resource rows.
  for (const c of d.cards)
    if (
      c.kind === "initial_sink_node" &&
      c.sources.length + c.sinks.length + c.values.length
    )
      warn(
        "GEC-011",
        `“${c.label}” is a root and carries resource rows (${[...c.sources, ...c.sinks, ...c.values].join(", ")}). The red treatment already shows the investment; remove the rows.`,
        { cardId: c.id },
      );

  // GEC-007: every card is reachable from a root.
  const forward = new Map<string, string[]>();
  for (const e of d.edges)
    forward.set(e.from, [...(forward.get(e.from) ?? []), e.to]);
  const reached = new Set<string>();
  const queue = d.cards
    .filter((c) => c.kind === "initial_sink_node")
    .map((c) => c.id);
  while (queue.length) {
    const id = queue.shift()!;
    if (reached.has(id)) continue;
    reached.add(id);
    queue.push(...(forward.get(id) ?? []));
  }
  if (queue.length === 0 && reached.size)
    for (const c of d.cards)
      if (!reached.has(c.id))
        warn(
          "GEC-007",
          `“${c.label}” has no path from a root. Connect it from Spend Time or Spend Money, or remove it.`,
          { cardId: c.id },
        );

  // GEC-013: one-line titles.
  for (const c of d.cards)
    if (metrics[c.id].title.length > 1)
      warn(
        "GEC-013",
        `“${c.label}” wraps to ${metrics[c.id].title.length} lines and moves its connector port. Shorten the title to one line (about ${sp.cardWidth === 196 ? 22 : 18} characters) and keep the detail in the notes.`,
        { cardId: c.id },
      );

  // Resource rows across the diagram, with their normalized names.
  const rows: Row[] = d.cards.flatMap((card) =>
    (
      [
        ["source", card.sources],
        ["sink", card.sinks],
        ["value", card.values],
      ] as const
    ).flatMap(([kind, texts]) =>
      texts.map((text) => ({ card, kind, text, words: resourceWords(text) })),
    ),
  );
  // Rows on roots are already GEC-011 findings; they are not resource chains.
  const spendable = rows.filter(
    (r) => r.kind !== "value" && r.card.kind !== "initial_sink_node",
  );
  const limitations = (d.research?.limitations ?? []).map((l) =>
    l.toLowerCase(),
  );
  const noted = (words: string[]) =>
    limitations.some((l) => l.includes(words.join(" ")));

  // GEC-012: every spendable resource is both produced and spent somewhere.
  // The reported name is the shortest row that names the resource ("Weapon Parts"
  // for "Weapon Parts kept" and "Weapon Parts: buy a mod").
  const baseName = (row: Row) => row.text.split(/[:(\[]|\s[-–—]\s/)[0].trim();
  const canonical = (row: Row) =>
    baseName(
      spendable
        .filter((other) => sameResource(row.words, other.words))
        .sort((a, b) => a.words.length - b.words.length)[0] ?? row,
    );
  const reported = new Set<string>();
  for (const row of spendable) {
    if (!row.words.length) continue;
    const name = canonical(row);
    const key = `${row.kind}:${name.toLowerCase()}`;
    if (reported.has(key)) continue;
    const counterpart = spendable.some(
      (other) =>
        other.kind !== row.kind && sameResource(row.words, other.words),
    );
    if (counterpart || noted(row.words) || noted(resourceWords(name))) continue;
    reported.add(key);
    warn(
      "GEC-012",
      row.kind === "source"
        ? `“${name}” is produced on “${row.card.label}” but no card spends it. Add the spend card, or list the unknown in research.limitations.`
        : `“${name}” is spent on “${row.card.label}” but no card produces it. Add the trigger that creates it, or list the unknown in research.limitations.`,
      { cardId: row.card.id, resource: name },
    );
  }

  // GEC-004: orange rows are progression, never a currency or inventory.
  for (const row of rows) {
    if (row.kind !== "value" || !row.words.length) continue;
    if (row.words.some((w) => PROGRESSION_WORDS.has(w))) continue;
    const name = baseName(row);
    const spentElsewhere = spendable.find(
      (other) =>
        other.card !== row.card && sameResource(row.words, other.words),
    );
    if (spentElsewhere)
      warn(
        "GEC-004",
        `“${name}” is an orange value row on “${row.card.label}” but is spendable on “${spentElsewhere.card.label}”. Orange is for progression the player cannot spend; use a green or red row, or a note for a held amount.`,
        { cardId: row.card.id, resource: name },
      );
    else if (
      SPENDABLE_WORDS.has(row.words[0]) ||
      SPENDABLE_WORDS.has(row.words[row.words.length - 1])
    )
      warn(
        "GEC-004",
        `“${name}” is an orange value row on “${row.card.label}” but reads as a currency or inventory. Orange is for progression the player cannot spend; use a green or red row, or a note for a held amount.`,
        { cardId: row.card.id, resource: name },
      );
  }

  // GEC-014: feedback pipes are labelled and few.
  const feedback = d.edges.filter((e) => e.feedback);
  const label = (id: string) => cards.get(id)?.label ?? id;
  for (const e of feedback)
    if (!e.label.trim())
      warn(
        "GEC-014",
        `The return pipe “${label(e.from)}” → “${label(e.to)}” has no label. Say what returns (for example “Next mission”).`,
        { edgeId: e.id },
      );
  if (feedback.length > 2)
    warn(
      "GEC-014",
      `${feedback.length} return pipes. Keep return pipes to the one or two that matter; merge the rest into one labelled pipe or drop them.`,
    );
  const inbound = new Map<string, typeof feedback>();
  for (const e of feedback)
    inbound.set(e.to, [...(inbound.get(e.to) ?? []), e]);
  for (const [to, pipes] of inbound)
    if (pipes.length > 1)
      warn(
        "GEC-014",
        `“${label(to)}” receives ${pipes.length} return pipes at its left port, which bundle with its forward arrow. Merge them into one labelled pipe or route into a card without a forward inbound pipe.`,
        { cardId: to },
      );

  // GEC-015: cards in the same group row are sized alike.
  const tolerance = sp.rowLine * 2 + sp.rowPad * 2 + sp.rowGap * 2;
  for (const g of d.groups) {
    const stacks = d.stages.map((s) =>
      d.cards
        .filter((c) => c.stageId === s.id && c.groupId === g.id)
        .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)),
    );
    const depth = Math.max(0, ...stacks.map((s) => s.length));
    for (let r = 0; r < depth; r++) {
      const row = stacks.map((s) => s[r]).filter(Boolean);
      if (row.length < 2) continue;
      const sized = row
        .map((c) => ({ card: c, height: metrics[c.id].height }))
        .sort((a, b) => a.height - b.height);
      const shortest = sized[0],
        tallest = sized[sized.length - 1];
      if (tallest.height - shortest.height > tolerance)
        warn(
          "GEC-015",
          `In “${g.label}”, “${tallest.card.label}” is about ${Math.round(tallest.height - shortest.height)}px taller than “${shortest.card.label}” in the same row. Give cards in a row the same number of resource rows and similar note length so their bottoms align.`,
          { cardId: tallest.card.id },
        );
    }
  }
  return issues;
}

export const standardMetadata = Object.freeze({
  rulesVersion: ECONOMY_FLOW_RULES_VERSION,
  severity: "warning" as const,
  note: "Standard warnings never block a save. Hard errors (a final good outside the last stage, a non-feedback pipe to the same or an earlier stage) are thrown by validateDocument.",
});
