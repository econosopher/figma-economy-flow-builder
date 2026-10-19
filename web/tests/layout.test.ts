import { textEditKey } from "../src/core/history";
import { presets } from "../src/core/presets";
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import {
  importDocument,
  validateDocument,
  blankDocument,
  cardSchema,
  deleteCard,
  type EconomyDocument,
} from "../src/core/document";
import {
  layoutDocument,
  measureCards,
  routeHitsCard,
  spacingFor,
  tracksConflict,
} from "../src/core/layout";
const examples = readdirSync(new URL("../../examples/", import.meta.url))
  .filter((f) => f.endsWith(".json"))
  .map((f) => ({
    name: f,
    doc: importDocument(
      JSON.parse(
        readFileSync(new URL(`../../examples/${f}`, import.meta.url), "utf8"),
      ),
    ).document,
  }));
function assertReadable(d: EconomyDocument) {
  const l = layoutDocument(d);
  expect(l.issues).toEqual([]);
  expect(l.routes.length).toBe(d.edges.length);
  for (const a of l.cards)
    for (const b of l.cards) {
      if (a === b) continue;
      expect(
        a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y,
      ).toBe(true);
    }
  for (const r of l.routes) {
    expect(r.points.length).toBeGreaterThan(1);
    for (const c of l.cards) {
      if ([r.edge.from, r.edge.to].includes(c.card.id)) continue;
      expect(routeHitsCard(r.points, c)).toBe(false);
    }
    for (const g of l.groups)
      expect(
        routeHitsCard(r.points, {
          x: g.x + l.spacing.groupInset,
          y: g.y + 12,
          width: l.spacing.cardWidth,
          height: g.lines.length * l.spacing.groupLine,
        }),
      ).toBe(false);
    for (const other of l.routes) {
      if (r !== other) {
        expect(
          tracksConflict(r, other),
          `${r.edge.id} conflicts with ${other.edge.id}`,
        ).toBe(false);
      }
    }
  }
  return l;
}
describe("economy layout", () => {
  it("keeps deletion and connections separate from a preceding text edit", () => {
    const d = examples[0].doc;
    const renamed = { ...d, name: "A new title" };
    expect(textEditKey(d, renamed)).not.toBeNull();
    expect(
      textEditKey(renamed, deleteCard(renamed, renamed.cards[0].id)),
    ).toBeNull();
    expect(textEditKey(d, { ...d, edges: d.edges.slice(1) })).toBeNull();
  });

  it("bundles the approved public presets", () => {
    expect(presets.length).toBe(6);
    expect(presets.map((p) => p.id)).toContain("apex_legends");
    expect(presets.map((p) => p.id)).toContain("royal_match");
  });
  for (const { document: doc } of presets)
    it(`routes researched ${doc.name} without content collisions or merged pipes`, () =>
      assertReadable(doc));
  for (const { name, doc } of examples)
    it(`routes ${name} without content collisions or merged pipes`, () =>
      assertReadable(doc));
  it("keeps measured wrapped text inside expanded cards", () => {
    const d = examples[0].doc;
    const card = d.cards[0];
    const next = {
      ...d,
      cards: [
        {
          ...card,
          label: "W".repeat(100),
          notes: "Long note with many resources ".repeat(30),
          sources: ["Longest resource name ".repeat(15)],
        },
        ...d.cards.slice(1),
      ],
    };
    const m = measureCards(next)[card.id];
    expect(m.title.length).toBeGreaterThan(3);
    expect(m.height).toBeGreaterThan(m.notesY + m.notes.length * 16);
    assertReadable(next);
  });
  it("expands group and stage headings without clipping content", () => {
    const d = structuredClone(examples[0].doc);
    d.groups[0].label = "A long background section heading ".repeat(12);
    d.stages[0].label = "A long ordered stage title ".repeat(12);
    const l = assertReadable(d);
    expect(l.groups[0].lines.length).toBeGreaterThan(3);
    expect(l.stages[0].lines.length).toBeGreaterThan(3);
    expect(Math.min(...l.cards.map((c) => c.y))).toBeGreaterThan(
      l.stages[0].y + l.stages[0].height,
    );
  });
  it("supports explicit feedback, same-stage connections and parallel relationships", () => {
    const d = blankDocument();
    d.cards = d.stages.slice(0, 3).map((s, i) =>
      cardSchema.parse({
        id: `n${i}`,
        label: `Card ${i}`,
        stageId: s.id,
        groupId: d.groups[0].id,
        order: 0,
      }),
    );
    d.edges = [
      {
        id: "a",
        from: "n0",
        to: "n1",
        type: "normal",
        feedback: false,
        label: "",
      },
      {
        id: "b",
        from: "n0",
        to: "n1",
        type: "normal",
        feedback: false,
        label: "",
      },
      {
        id: "c",
        from: "n2",
        to: "n0",
        type: "value",
        feedback: true,
        label: "",
      },
      {
        id: "d",
        from: "n1",
        to: "n1",
        type: "value",
        feedback: true,
        label: "",
      },
    ];
    assertReadable(validateDocument(d));
  });
  it("routes the anonymized private return-loop topology", () =>
    assertReadable(
      importDocument(
        JSON.parse(
          readFileSync(
            new URL("./fixtures/return-routing.json", import.meta.url),
            "utf8",
          ),
        ),
      ).document,
    ));
  it("is deterministic", () =>
    expect(layoutDocument(examples[0].doc)).toEqual(
      layoutDocument(examples[0].doc),
    ));
  it("preserves resource semantics and reports return edges on import", () => {
    const old = {
      schemaVersion: 2,
      stages: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      nodes: [
        { id: "a", label: "A", stageId: "a", values: ["XP"] },
        { id: "b", label: "B", stageId: "b", sources: ["Gold"] },
      ],
      edges: [{ from: "b", to: "a", type: "value" }],
    };
    const result = importDocument(old);
    expect(result.notices).toHaveLength(1);
    expect(result.document.edges[0]).toMatchObject({
      type: "value",
      feedback: true,
    });
    expect(result.document.cards[0].values).toEqual(["XP"]);
  });
  it("removes a card and its incident edges atomically", () => {
    const d = examples[0].doc;
    const id = d.cards[0].id;
    const next = deleteCard(d, id);
    expect(next.cards.some((c) => c.id === id)).toBe(false);
    expect(next.edges.some((e) => e.from === id || e.to === id)).toBe(false);
    expect(d.cards.some((c) => c.id === id)).toBe(true);
  });
  it("rejects dangling edges and implicit backwards pipes", () => {
    const d = examples[0].doc;
    expect(() =>
      validateDocument({
        ...d,
        edges: [{ id: "x", from: "missing", to: d.cards[0].id }],
      }),
    ).toThrow();
    expect(() =>
      validateDocument({
        ...d,
        edges: [{ id: "x", from: d.cards[0].id, to: d.cards[0].id }],
      }),
    ).toThrow("explicit return pipe");
  });
  it("lays out 100 cards and 300 edges within one second", () => {
    const d = blankDocument();
    d.stages = Array.from({ length: 10 }, (_, i) => ({
      id: `s${i}`,
      label: `Stage ${i}`,
    }));
    d.groups = Array.from({ length: 5 }, (_, i) => ({
      id: `g${i}`,
      label: `Group ${i}`,
      color: "#f7f8fa",
    }));
    d.cards = Array.from({ length: 100 }, (_, i) =>
      cardSchema.parse({
        id: `n${i}`,
        label: `Action ${i}`,
        stageId: `s${i % 10}`,
        groupId: `g${Math.floor(i / 20)}`,
        order: Math.floor((i % 20) / 10),
        sources: ["Coins"],
        sinks: ["Time"],
      }),
    );
    let index = 0;
    for (let i = 0; i < 100 && index < 300; i++) {
      const stage = i % 10;
      if (stage === 9) continue;
      for (let j = 1; j <= 4 && index < 300; j++) {
        const target = Math.floor(i / 10) * 10 + Math.min(9, stage + j);
        d.edges.push({
          id: `e${String(index++).padStart(4, "0")}`,
          from: `n${i}`,
          to: `n${target}`,
          type: "normal",
          feedback: false,
          label: "",
        });
      }
    }
    const start = performance.now();
    const l = layoutDocument(d);
    const elapsed = performance.now() - start;
    console.log("100-card/300-edge layout ms:", elapsed.toFixed(1));
    expect(l.issues).toEqual([]);
    expect(elapsed).toBeLessThan(1000);
  });
  it("keeps compact and comfortable geometry exactly as before the spacing table", () => {
    const expected = JSON.parse(
      readFileSync(
        new URL("./fixtures/layout-geometry.json", import.meta.url),
        "utf8",
      ),
    ) as Record<string, { width: number; height: number; digest: string }>;
    const docs = [
      ...examples,
      ...presets.map((p) => ({ name: `preset:${p.id}`, doc: p.document })),
    ];
    for (const { name, doc } of docs)
      for (const spacing of ["compact", "comfortable"] as const) {
        const l = layoutDocument(
          validateDocument({
            ...doc,
            settings: { ...doc.settings, spacing },
          }),
        );
        const digest = createHash("sha1")
          .update(
            JSON.stringify({
              cards: l.cards.map((c) => [
                c.card.id,
                c.x,
                c.y,
                c.width,
                c.height,
              ]),
              groups: l.groups.map((g) => [g.id, g.x, g.y, g.width, g.height]),
              stages: l.stages.map((s) => [s.id, s.x, s.y, s.width, s.height]),
              routes: l.routes.map((r) => [r.edge.id, r.points, r.path]),
            }),
          )
          .digest("hex");
        expect(
          { width: l.bounds.width, height: l.bounds.height, digest },
          `${name} ${spacing}`,
        ).toEqual(expected[`${name}|${spacing}`]);
      }
  });
});
describe("slide spacing", () => {
  /** Five columns, one lane, Time and Money roots, a labelled Money pipe and a return pipe. */
  function slideDocument(spacing: "compact" | "slide", showTitle = true) {
    const stages = ["Inputs", "Prepare", "Run", "Return", "Outcomes"].map(
      (label, i) => ({ id: `s${i}`, label }),
    );
    const card = (
      id: string,
      label: string,
      stage: number,
      extra: Record<string, unknown> = {},
    ) =>
      cardSchema.parse({
        id,
        label,
        stageId: `s${stage}`,
        groupId: "g",
        order: 0,
        ...extra,
      });
    return validateDocument({
      schemaVersion: 3,
      id: "slide-test",
      name: "Slide test",
      stages,
      groups: [{ id: "g", label: "Loop", color: "#f7f8fa" }],
      cards: [
        card("time", "Time", 0, { kind: "initial_sink_node" }),
        card("money", "Money", 0, { kind: "initial_sink_node", order: 1 }),
        card("prep", "To Kit a Loadout in the Hub", 1, {
          sinks: ["Materials, coins", "Tokens: cosmetics"],
          values: ["Workshop stations", "Stash size"],
          notes: "A free loadout risks nothing",
        }),
        card("run", "To Raid Topside", 2, {
          sources: ["Materials, loot"],
          sinks: ["Loadout on death", "Ammo, meds"],
          values: ["Level, skill tree"],
        }),
        card("ret", "To Finish an Expedition", 3, {
          sinks: ["Stash and level: reset"],
          values: ["Skill points", "Cosmetics kept"],
        }),
        card("fg", "The haul and the escape", 4, { kind: "final_good" }),
      ],
      edges: [
        { id: "t", from: "time", to: "prep" },
        {
          id: "m",
          from: "money",
          to: "prep",
          label: "buys the game and tokens",
        },
        { id: "a", from: "prep", to: "run" },
        { id: "b", from: "run", to: "ret" },
        { id: "c", from: "run", to: "prep", feedback: true },
        { id: "d", from: "run", to: "fg", type: "final" },
      ],
      settings: {
        spacing,
        showLegend: false,
        showTitle,
        showLabels: true,
        background: "transparent",
      },
    });
  }
  it("is accepted by the schema and reads narrower than compact without collisions", () => {
    const compact = layoutDocument(slideDocument("compact"));
    const slide = assertReadable(slideDocument("slide"));
    expect(slide.spacing.cardWidth).toBe(160);
    expect(slide.bounds.width).toBeLessThan(compact.bounds.width * 0.8);
    // Chip text on a 10-inch slide: px font × 720pt / px width.
    expect(
      (slide.spacing.rowSize * 720) / slide.bounds.width,
    ).toBeGreaterThanOrEqual(7);
    expect((compact.spacing.rowSize * 720) / compact.bounds.width).toBeLessThan(
      7,
    );
    expect(slide.cards.map((c) => c.card.id)).toEqual(
      compact.cards.map((c) => c.card.id),
    );
  });
  it("moves the stage headings up when the title band is hidden", () => {
    const shown = layoutDocument(slideDocument("slide"));
    const hidden = layoutDocument(slideDocument("slide", false));
    expect(hidden.stages[0].y).toBeLessThan(shown.stages[0].y);
    expect(hidden.bounds.height).toBeLessThan(shown.bounds.height);
    expect(spacingFor(slideDocument("compact").settings).stagesY).toBe(60);
  });
  it("draws no labels unless showLabels is set, so researched presets keep their look", () => {
    for (const { document: doc } of presets) {
      expect(doc.settings.showLabels).toBe(false);
      expect(layoutDocument(doc).routes.every((r) => !r.label)).toBe(true);
    }
    const d = slideDocument("slide");
    const off = validateDocument({
      ...d,
      settings: { ...d.settings, showLabels: false },
    });
    expect(layoutDocument(off).routes.every((r) => !r.label)).toBe(true);
  });
  it("places a pipe label on its route and never on another card", () => {
    for (const spacing of ["compact", "slide"] as const) {
      const l = layoutDocument(slideDocument(spacing));
      const labelled = l.routes.find((r) => r.edge.id === "m")!;
      expect(labelled.label).toBeDefined();
      expect(labelled.label!.lines.join(" ")).toBe("buys the game and tokens");
      const on = labelled.points.some((p, i) => {
        const q = labelled.points[i + 1];
        if (!q) return false;
        const { x, y } = labelled.label!;
        return (
          (p.x === q.x &&
            x === p.x &&
            y >= Math.min(p.y, q.y) &&
            y <= Math.max(p.y, q.y)) ||
          (p.y === q.y &&
            y === p.y &&
            x >= Math.min(p.x, q.x) &&
            x <= Math.max(p.x, q.x))
        );
      });
      expect(on).toBe(true);
      for (const c of l.cards)
        if (![labelled.edge.from, labelled.edge.to].includes(c.card.id))
          expect(
            labelled.label!.x > c.x &&
              labelled.label!.x < c.x + c.width &&
              labelled.label!.y > c.y &&
              labelled.label!.y < c.y + c.height,
          ).toBe(false);
      expect(
        l.routes.filter((r) => r.edge.id !== "m").every((r) => !r.label),
      ).toBe(true);
    }
  });
});
