import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import {
  blankDocument,
  cardSchema,
  importDocument,
  validateDocument,
  type Card,
  type EconomyDocument,
} from "../src/core/document";
import { applyEdits } from "../src/core/edits";
import {
  GAP_HALF,
  TAG_HEIGHT,
  layoutDocument,
  pipeEnds,
  type Point,
  type Route,
} from "../src/core/layout";
import {
  RESOURCE_PALETTE,
  effectiveResource,
  inferResource,
  pipeResources,
  resourceCandidates,
} from "../src/core/pipeResource";
import { presets } from "../src/core/presets";
import {
  DIM_CARD,
  DIM_PIPE,
  DiagramDrawing,
  DiagramSvg,
  pipeColor,
  withEnds,
} from "../src/components/DiagramSvg";

const card = (id: string, stage: number, extra: Partial<Card> = {}) =>
  cardSchema.parse({
    id,
    label: id,
    stageId: `s${stage}`,
    groupId: "g",
    order: 0,
    ...extra,
  });
const pipe = (id: string, from: string, to: string, resource = "") => ({
  id,
  from,
  to,
  type: "normal" as const,
  feedback: false,
  label: "",
  resource,
});
/** Two producers of Gold feed one upgrade card; a third pipe carries Gems. */
function goldDocument(): EconomyDocument {
  return validateDocument({
    schemaVersion: 3,
    id: "gold",
    name: "Gold",
    stages: [0, 1, 2].map((i) => ({ id: `s${i}`, label: `Stage ${i}` })),
    groups: [{ id: "g", label: "Loop", color: "#f7f8fa" }],
    cards: [
      card("quests", 0, { sources: ["Gold: quest rewards"] }),
      card("shop", 0, { order: 1, sources: ["Gold", "Gems"] }),
      card("upgrade", 1, { sinks: ["Gold: upgrades"], values: ["Level"] }),
      card("cosmetic", 2, { sinks: ["Gems"] }),
    ],
    edges: [
      pipe("q", "quests", "upgrade"),
      pipe("s", "shop", "upgrade"),
      pipe("g", "shop", "cosmetic", "Gems"),
    ],
    settings: {},
  });
}
const examples = readdirSync(new URL("../../examples/", import.meta.url))
  .filter((f) => f.endsWith(".json"))
  .map(
    (f) =>
      importDocument(
        JSON.parse(
          readFileSync(new URL(`../../examples/${f}`, import.meta.url), "utf8"),
        ),
      ).document,
  );
const library = [...examples, ...presets.map((p) => p.document)];

describe("pipe resource", () => {
  it("infers the one resource named at both ends, and nothing when none or several match", () => {
    const from = card("a", 0, {
      sources: ["Coins: daily reward", "Gems"],
      values: ["Account level"],
    });
    expect(inferResource(from, card("b", 1, { sinks: ["Coins"] }))).toBe(
      "Coins",
    );
    // Two rows of one resource still count once; the shorter name wins.
    expect(
      inferResource(
        card("a", 0, { sources: ["Weapon Parts kept", "Weapon Parts"] }),
        card("b", 1, { sinks: ["Weapon Parts: buy a mod"] }),
      ),
    ).toBe("Weapon Parts");
    expect(
      inferResource(from, card("b", 1, { sinks: ["Coins", "Gems"] })),
    ).toBe("");
    expect(inferResource(from, card("b", 1, { sinks: ["Energy"] }))).toBe("");
    // Held progression at both ends counts; a source row on the target does not.
    expect(
      inferResource(from, card("b", 1, { values: ["Account level cap"] })),
    ).toBe("Account level");
    expect(inferResource(from, card("b", 1, { sources: ["Coins"] }))).toBe("");
    expect(resourceCandidates(from)).toEqual([
      "Coins",
      "Gems",
      "Account level",
    ]);
  });
  it("falls back to the one resource the pipe's label names", () => {
    const from = card("a", 0, { sources: ["Cash balance", "Points"] }),
      to = card("b", 1, { sinks: ["Draw entries"], values: ["Tier"] });
    expect(inferResource(from, to)).toBe("");
    expect(inferResource(from, to, "draw entries")).toBe("Draw entries");
    expect(inferResource(from, to, "cash")).toBe("Cash balance");
    // A label naming two different resources, or nothing on either card, infers nothing.
    expect(
      inferResource(
        card("a", 0, { sources: ["Gold coins"] }),
        card("b", 1, { sinks: ["Gold bars"] }),
        "gold",
      ),
    ).toBe("");
    expect(inferResource(from, to, "Next mission")).toBe("");
    expect(inferResource(from, to, "")).toBe("");
    // Rows matching at both ends still come first.
    expect(
      inferResource(
        card("a", 0, { sources: ["Coins", "Gems"] }),
        card("b", 1, { sinks: ["Coins"] }),
        "gems",
      ),
    ).toBe("Coins");
    const cards = new Map([from, to].map((c) => [c.id, c]));
    const edge = { from: "a", to: "b", label: "cash", resource: "" };
    expect(effectiveResource(edge, cards)).toBe("Cash balance");
    expect(effectiveResource({ ...edge, resource: "Tickets" }, cards)).toBe(
      "Tickets",
    );
  });
  it("prefers the explicit field over inference", () => {
    const d = goldDocument();
    const cards = new Map(d.cards.map((c) => [c.id, c]));
    expect(effectiveResource(d.edges[0], cards)).toBe("Gold");
    expect(
      effectiveResource({ ...d.edges[0], resource: " Bullion " }, cards),
    ).toBe("Bullion");
  });
  it("colours resources in order of first appearance on a card and leaves the ninth grey", () => {
    const names = Array.from({ length: 10 }, (_, i) => `Res${i}`);
    const d = validateDocument({
      schemaVersion: 3,
      id: "many",
      name: "Many",
      stages: [
        { id: "s0", label: "A" },
        { id: "s1", label: "B" },
      ],
      groups: [{ id: "g", label: "G", color: "#f7f8fa" }],
      // Cards list the resources in reverse, so card order, not pipe order, decides.
      cards: [
        card("src", 0, { sources: [...names].reverse() }),
        card("dst", 1, { sinks: names }),
      ],
      edges: names.map((n, i) => pipe(`e${i}`, "src", "dst", n)),
      settings: {},
    });
    const { byEdge, legend } = pipeResources(d);
    expect(legend.map((l) => l.name)).toEqual([...names].reverse().slice(0, 8));
    expect(legend.map((l) => l.color)).toEqual([...RESOURCE_PALETTE]);
    expect(byEdge.get("e9")!.color).toBe(RESOURCE_PALETTE[0]);
    expect(byEdge.get("e1")!.color).toBeUndefined();
    expect(byEdge.get("e0")!.color).toBeUndefined();
    expect(byEdge.get("e0")!.name).toBe("Res0");
  });
  it("gives explicit and inferred pipes of one resource one colour and one key entry", () => {
    const d = goldDocument();
    d.edges[1].resource = "gold";
    const { byEdge, legend } = pipeResources(d);
    expect(byEdge.get("q")!.color).toBe(byEdge.get("s")!.color);
    expect(byEdge.get("q")!.key).toBe("gold");
    expect(legend.map((l) => l.name)).toEqual(["Gold", "Gems"]);
  });
  it("keeps the palette clear of the row-sign, selection and default pipe colours", () => {
    const d = blankDocument();
    const reserved = [
      d.settings.source,
      d.settings.sink,
      d.settings.value,
      "#b08716",
      "#89978f",
    ].map((c) => c.toLowerCase());
    expect(new Set(RESOURCE_PALETTE).size).toBe(8);
    for (const c of RESOURCE_PALETTE) expect(reserved).not.toContain(c);
  });
});

describe("pipe schema", () => {
  it("round-trips the resource field through import, v2 import and the edit path", () => {
    const d = goldDocument();
    const json = JSON.parse(JSON.stringify(d));
    expect(importDocument(json).document.edges[2].resource).toBe("Gems");
    expect(importDocument(json).document.settings.showResources).toBe(true);
    const v2 = importDocument({
      schemaVersion: 2,
      stages: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      nodes: [
        { id: "x", label: "X", stageId: "a" },
        { id: "y", label: "Y", stageId: "b" },
      ],
      edges: [
        { from: "x", to: "y", resource: "Coins" },
        { from: "x", to: "y" },
      ],
    }).document;
    expect(v2.edges.map((e) => e.resource)).toEqual(["Coins", ""]);
    const edited = applyEdits(d, [
      {
        op: "put",
        entity: "edges",
        value: { id: "q", resource: "Bullion" },
      },
      { op: "settings", value: { showResources: false } },
    ]);
    expect(edited.edges[0]).toMatchObject({ id: "q", resource: "Bullion" });
    expect(edited.settings.showResources).toBe(false);
    expect(() =>
      validateDocument({
        ...d,
        edges: [{ ...d.edges[0], resource: "x".repeat(161) }],
      }),
    ).toThrow();
  });
});

const box = (r: Route) => {
  const t = r.tag!;
  const w = t.vertical ? t.height : t.width,
    h = t.vertical ? t.width : t.height;
  return { x: t.x - w / 2, y: t.y - h / 2, width: w, height: h };
};
const overlap = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;
const onSegment = (p: Point, a: Point, b: Point) =>
  (a.x === b.x &&
    p.x === a.x &&
    p.y >= Math.min(a.y, b.y) &&
    p.y <= Math.max(a.y, b.y)) ||
  (a.y === b.y &&
    p.y === a.y &&
    p.x >= Math.min(a.x, b.x) &&
    p.x <= Math.max(a.x, b.x));
const onRoute = (p: Point, r: Pick<Route, "points">) =>
  r.points.slice(1).some((b, i) => onSegment(p, r.points[i], b));

/** The straight pieces a path actually draws (M starts a new piece, L draws one). */
function drawn(path: string): [Point, Point][] {
  const pieces: [Point, Point][] = [];
  let at: Point | undefined;
  for (const [, op, x, y] of path.matchAll(/([ML]) (-?[\d.]+) (-?[\d.]+)/g)) {
    const p = { x: Number(x), y: Number(y) };
    if (op === "L" && at) pieces.push([at, p]);
    at = p;
  }
  return pieces;
}

describe("pipe drawing", () => {
  it("tags each resource into each card once, clear of cards, labels, tags and other pipes", () => {
    let tagged = 0;
    for (const doc of library)
      for (const showLabels of [false, true]) {
        const l = layoutDocument(
          validateDocument({
            ...doc,
            settings: { ...doc.settings, showLabels },
          }),
        );
        const tags = l.routes.filter((r) => r.tag);
        tagged += tags.length;
        const pairs = tags.map((r) => `${r.resource!.key}|${r.edge.to}`);
        expect(new Set(pairs).size).toBe(pairs.length);
        for (const r of tags) {
          // Only a card whose incoming pipes all carry this resource shares its terminal run.
          const into = l.routes.filter(
            (o) => !o.unresolved && o.edge.to === r.edge.to,
          );
          const shared = into.every((o) => o.resource?.key === r.resource!.key);
          expect(r.resource).toBeDefined();
          expect(r.tag!.height).toBe(TAG_HEIGHT);
          expect(onRoute(r.tag!, r)).toBe(true);
          const b = box(r);
          for (const o of l.routes)
            if (o.label) {
              const inside =
                o.label.x > b.x &&
                o.label.x < b.x + b.width &&
                o.label.y > b.y &&
                o.label.y < b.y + b.height;
              expect(inside).toBe(false);
            }
          for (const c of l.cards) expect(overlap(b, c)).toBe(false);
          for (const o of tags)
            if (o !== r) expect(overlap(b, box(o))).toBe(false);
          for (const o of l.routes) {
            if (o === r) continue;
            for (let i = 1; i < o.points.length; i++) {
              if (shared && into.includes(o) && i === o.points.length - 1)
                continue;
              const p = o.points[i - 1],
                q = o.points[i];
              expect(
                Math.min(p.x, q.x) < b.x + b.width &&
                  Math.max(p.x, q.x) > b.x &&
                  Math.min(p.y, q.y) < b.y + b.height &&
                  Math.max(p.y, q.y) > b.y,
              ).toBe(false);
            }
          }
        }
      }
    expect(tagged).toBeGreaterThan(20);
  });
  it("draws one tag for pipes of one resource into one card, on the arrowhead pipe", () => {
    const l = layoutDocument(goldDocument());
    const [q, s, g] = l.routes;
    expect(q.arrowhead).toBe(true);
    expect(q.tag).toBeDefined();
    expect(q.tag!.vertical).toBe(false);
    expect(s.tag).toBeUndefined();
    // The same resource into a different card keeps its own tag.
    expect(g.tag).toBeDefined();
  });
  it("turns colour, tags and key entries off with showResources", () => {
    const d = goldDocument();
    const on = layoutDocument(d);
    expect(on.resources.map((r) => r.name)).toEqual(["Gold", "Gems"]);
    expect(on.routes.every((r) => r.resource)).toBe(true);
    expect(on.routes.some((r) => r.tag)).toBe(true);
    expect(pipeColor(on.routes[0], d.settings)).toBe(RESOURCE_PALETTE[0]);
    const offDoc = validateDocument({
      ...d,
      settings: { ...d.settings, showResources: false },
    });
    const off = layoutDocument(offDoc);
    expect(off.resources).toEqual([]);
    expect(off.legend).toEqual({ rows: 0, items: [] });
    expect(off.routes.every((r) => !r.resource && !r.tag)).toBe(true);
    expect(off.routes.map((r) => r.points)).toEqual(
      on.routes.map((r) => r.points),
    );
    expect(pipeColor(off.routes[0], offDoc.settings)).toBe("#89978f");
    const svg = renderToStaticMarkup(
      <DiagramSvg document={offDoc} layout={off} />,
    );
    for (const color of RESOURCE_PALETTE) expect(svg).not.toContain(color);
    expect(svg).not.toContain('fill="white" stroke="#89978f"');
    expect(svg).not.toMatch(/rx="7" fill="white"/);
  });
  it("wraps the resource key only when it does not fit one line", () => {
    const d = goldDocument();
    const l = layoutDocument(d);
    expect(l.legend.rows).toBe(1);
    expect(l.legend.items.map((i) => i.x)).toEqual([560, expect.any(Number)]);
    const plain = layoutDocument(
      validateDocument({
        ...d,
        settings: { ...d.settings, showResources: false },
      }),
    );
    expect(l.bounds.height).toBe(plain.bounds.height);
  });
  it("draws a dot where a later pipe joins a run already drawn into the same card", () => {
    const l = layoutDocument(goldDocument());
    const [q, s] = l.routes;
    expect(q.arrowhead).toBe(true);
    expect(q.join).toBeUndefined();
    expect(s.arrowhead).toBe(false);
    expect(s.join).toBeDefined();
    expect(onRoute(s.join!, s)).toBe(true);
    expect(onRoute(s.join!, q)).toBe(true);
    // The dot sits where the shared stub starts, not at the card port.
    expect(s.join!).not.toEqual(s.points.at(-1));
    expect(
      renderToStaticMarkup(
        <DiagramDrawing document={goldDocument()} layout={l} />,
      ).match(/<circle cx/g),
    ).toHaveLength(1);
    // Across the library: a dot on every later pipe that shares a terminal run, on both routes.
    for (const doc of library) {
      const lib = layoutDocument(doc);
      for (const r of lib.routes)
        if (r.join) {
          expect(r.arrowhead).toBe(false);
          expect(onRoute(r.join, r)).toBe(true);
          expect(
            lib.routes.some(
              (o) =>
                o !== r &&
                o.edge.to === r.edge.to &&
                lib.routes.indexOf(o) < lib.routes.indexOf(r) &&
                onRoute(r.join!, o),
            ),
          ).toBe(true);
        }
    }
  });
  it("recomputes arrowheads and dots for a selection export", () => {
    const d = goldDocument();
    const l = layoutDocument(d);
    expect(pipeEnds(l.routes.slice(1))[0]).toEqual({ arrowhead: true });
    const svg = renderToStaticMarkup(
      <DiagramDrawing
        document={d}
        layout={l}
        selection={["shop", "upgrade", "cosmetic"]}
      />,
    );
    expect(svg).not.toContain("<circle cx");
    expect(svg.match(/marker-end=/g)).toHaveLength(2);
  });
  it("breaks a horizontal pipe around each pipe it crosses instead of hopping", () => {
    let gaps = 0;
    for (const doc of library) {
      const l = layoutDocument(doc);
      for (const r of l.routes) {
        expect(r.path).not.toContain(" Q ");
        for (const g of r.gaps) {
          gaps++;
          expect(onRoute(g, r)).toBe(true);
          expect(
            l.routes.some(
              (o) =>
                o !== r &&
                o.points.slice(1).some((b, i) => {
                  const a = o.points[i];
                  return a.x === b.x && a.x === g.x && onSegment(g, a, b);
                }),
            ),
          ).toBe(true);
          // No drawn piece comes within GAP_HALF of the crossing on its row.
          for (const [a, b] of drawn(r.path))
            if (a.y === g.y && b.y === g.y)
              expect(
                Math.min(a.x, b.x) >= g.x + GAP_HALF ||
                  Math.max(a.x, b.x) <= g.x - GAP_HALF,
              ).toBe(true);
        }
        // Neighbouring gaps merge: no zero-length piece is left to draw a dot.
        for (const [a, b] of drawn(r.path))
          expect(a.x === b.x && a.y === b.y).toBe(false);
        // The break hides nothing else: the drawn pieces cover the route minus the gaps.
        const drawnLength = drawn(r.path).reduce(
          (n, [a, b]) => n + Math.abs(a.x - b.x) + Math.abs(a.y - b.y),
          0,
        );
        const routeLength = r.points
          .slice(1)
          .reduce(
            (n, b, i) =>
              n + Math.abs(b.x - r.points[i].x) + Math.abs(b.y - r.points[i].y),
            0,
          );
        expect(drawnLength).toBeLessThanOrEqual(routeLength);
        expect(drawnLength).toBeGreaterThanOrEqual(
          routeLength - r.gaps.length * 2 * GAP_HALF,
        );
      }
    }
    expect(gaps).toBeGreaterThan(10);
  });
});

describe("focused export", () => {
  it("dims every card and pipe outside the focus, and nothing without one", () => {
    const d = goldDocument();
    const l = layoutDocument(d);
    const plain = renderToStaticMarkup(<DiagramSvg document={d} layout={l} />);
    expect(plain).not.toContain(`opacity="${DIM_PIPE}"`);
    expect(plain).not.toContain(`opacity="${DIM_CARD}"`);
    const focused = renderToStaticMarkup(
      <DiagramSvg
        document={d}
        layout={l}
        focus={{ cards: ["shop", "cosmetic"], edges: ["g"] }}
      />,
    );
    // Pipes q and s are dimmed, with their tags and the join dot.
    expect(
      (focused.match(new RegExp(`opacity="${DIM_PIPE}"`, "g")) || []).length,
    ).toBeGreaterThanOrEqual(3);
    expect(
      focused.match(new RegExp(`opacity="${DIM_CARD}"`, "g")),
    ).toHaveLength(2);
    // The focused pipe keeps its own colour at full strength.
    expect(focused).toContain(`stroke="${RESOURCE_PALETTE[1]}"`);
  });
  it("gives a focused pipe its own arrowhead when the card's first pipe is dimmed", () => {
    const d = goldDocument();
    const l = layoutDocument(d);
    expect(l.routes[1].arrowhead).toBe(false);
    const drawn = withEnds(l.routes, new Set(["q", "g"]));
    expect(drawn[1]).toMatchObject({ arrowhead: true, join: undefined });
    // The dimmed pipes keep what the full drawing gives them.
    expect(drawn[0].arrowhead).toBe(true);
    expect(drawn[2].arrowhead).toBe(true);
    const svg = renderToStaticMarkup(
      <DiagramSvg
        document={d}
        layout={l}
        focus={{ cards: ["shop", "upgrade"], edges: ["s"] }}
      />,
    );
    expect(svg).not.toContain("<circle cx");
    expect(svg.match(/marker-end=/g)).toHaveLength(3);
  });
});
