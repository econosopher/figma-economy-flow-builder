import { textEditKey } from "../src/core/history";
import { presets } from "../src/core/presets";
import { describe, it, expect } from "vitest";
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
          x: g.x + 18,
          y: g.y + 12,
          width: 196,
          height: g.lines.length * 18,
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
});
