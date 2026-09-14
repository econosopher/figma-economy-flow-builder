import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  addConnectedCard,
  blankDocument,
  cardSchema,
  settingsSchema,
  validateDocument,
} from "../src/core/document";
import { layoutDocument, tracksConflict, type Point } from "../src/core/layout";
import {
  CardDrawing,
  DiagramDrawing,
  PipeDrawing,
} from "../src/components/DiagramSvg";
import { Inspector } from "../src/components/Inspector";

function fixture() {
  const d = blankDocument();
  d.cards = d.stages.map((s, i) =>
    cardSchema.parse({
      id: `c${i}`,
      label: `Card ${i}`,
      stageId: s.id,
      groupId: d.groups[0].id,
      order: 0,
    }),
  );
  return d;
}
describe("direct canvas editing", () => {
  it("loads existing settings with new palette defaults without changing custom colors", () => {
    const settings = settingsSchema.parse({
      source: "#123456",
      sink: "#654321",
      value: "#abcdef",
    });
    expect(settings).toMatchObject({
      actionHeader: "#000000",
      finalGood: "#F5C95C",
      source: "#123456",
      sink: "#654321",
      value: "#abcdef",
    });
  });
  it("adds one connected action in the next stage and keeps the original immutable", () => {
    const d = fixture(),
      result = addConnectedCard(d, "c0");
    expect(d.edges).toHaveLength(0);
    expect(result.document.cards).toHaveLength(d.cards.length + 1);
    expect(result.document.cards.at(-1)).toMatchObject({
      stageId: d.stages[1].id,
      groupId: d.groups[0].id,
      kind: "action",
    });
    expect(result.document.edges).toEqual([
      expect.objectContaining({
        from: "c0",
        to: result.cardId,
        feedback: false,
      }),
    ]);
  });
  it("extends the terminal stage atomically while keeping final goods terminal", () => {
    const d = fixture();
    d.cards.push(
      cardSchema.parse({
        id: "final",
        label: "Final good",
        kind: "final_good",
        stageId: d.stages.at(-1)!.id,
        groupId: d.groups[0].id,
        order: 1,
      }),
    );
    const result = addConnectedCard(d, d.cards.at(-2)!.id);
    expect(result.document.stages).toHaveLength(d.stages.length + 1);
    expect(result.document.cards.find((c) => c.id === "final")!.stageId).toBe(
      result.document.stages.at(-1)!.id,
    );
    expect(() => validateDocument(result.document)).not.toThrow();
    expect(() => addConnectedCard(d, "final")).toThrow(
      "Final goods end the flow",
    );
  });
  it("uses common anchors and straight unobstructed approaches but distinct parallel routes", () => {
    const d = fixture();
    d.edges = ["one", "two", "three"].map((id) => ({
      id,
      from: "c0",
      to: "c1",
      type: "normal" as const,
      feedback: false,
      label: "",
    }));
    const l = layoutDocument(d);
    expect(l.issues).toEqual([]);
    expect(l.routes[0].points).toHaveLength(2);
    expect(new Set(l.routes.map((r) => JSON.stringify(r.points[0]))).size).toBe(
      1,
    );
    expect(
      new Set(l.routes.map((r) => JSON.stringify(r.points.at(-1)))).size,
    ).toBe(1);
    expect(new Set(l.routes.map((r) => r.path)).size).toBe(3);
    expect(l.routes.filter((r) => r.arrowhead)).toHaveLength(1);
    for (const r of l.routes) {
      expect(r.points[0].y).toBe(r.points[1].y);
      expect(r.points.at(-1)!.y).toBe(r.points.at(-2)!.y);
      for (const other of l.routes)
        if (r !== other) expect(tracksConflict(r, other)).toBe(false);
    }
  });
  it("does not permit unrelated terminal overlap or shared middle tracks", () => {
    const edge = {
      id: "a",
      from: "a",
      to: "b",
      type: "normal" as const,
      feedback: false,
      label: "",
    };
    const a = {
      edge,
      points: [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 100 },
        { x: 100, y: 100 },
      ],
    };
    const b = (points: Point[], from = "a", to = "c") => ({
      edge: { ...edge, id: "b", from, to },
      points,
    });
    expect(
      tracksConflict(
        a,
        b([
          { x: 0, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 150 },
          { x: 100, y: 150 },
        ]),
      ),
    ).toBe(false);
    expect(
      tracksConflict(
        a,
        b(
          [
            { x: 0, y: 0 },
            { x: 20, y: 0 },
            { x: 20, y: 150 },
            { x: 100, y: 150 },
          ],
          "unrelated",
        ),
      ),
    ).toBe(true);
    expect(
      tracksConflict(
        a,
        b([
          { x: 0, y: 0 },
          { x: 40, y: 0 },
          { x: 40, y: 150 },
          { x: 100, y: 150 },
        ]),
      ),
    ).toBe(true);
    expect(tracksConflict(a, b(a.points, "a", "b"))).toBe(true);
  });
  it("renders the black action title and yellow final good through the shared SVG", () => {
    const d = fixture();
    d.cards[1].kind = "final_good";
    const l = layoutDocument(d);
    const action = renderToStaticMarkup(
      <CardDrawing
        card={d.cards[0]}
        metrics={l.cards[0].metrics}
        settings={d.settings}
      />,
    );
    const final = renderToStaticMarkup(
      <CardDrawing
        card={d.cards[1]}
        metrics={l.cards[1].metrics}
        settings={d.settings}
      />,
    );
    expect(action).toContain('fill="#000000"');
    expect(action).toContain('fill="#ffffff"');
    expect(final).toContain('fill="#F5C95C"');
    expect(final).toContain('fill="#000000"');
    expect(final).toContain("FINAL GOOD");
  });
  it("retains arrowheads when selection export omits the first incoming edge", () => {
    const d = fixture();
    d.edges = [
      {
        id: "one",
        from: "c0",
        to: "c2",
        type: "normal",
        feedback: false,
        label: "",
      },
      {
        id: "two",
        from: "c1",
        to: "c2",
        type: "normal",
        feedback: false,
        label: "",
      },
    ];
    const svg = renderToStaticMarkup(
      <DiagramDrawing
        document={d}
        layout={layoutDocument(d)}
        selection={["c1", "c2"]}
      />,
    );
    expect(svg.match(/marker-end=/g)).toHaveLength(1);
    expect(svg).not.toContain("card-control");
  });
  it("renders the explanation directly on a feedback pipe", () => {
    const d = fixture();
    const svg = renderToStaticMarkup(
      <PipeDrawing
        settings={d.settings}
        route={{
          edge: {
            id: "return",
            from: "c2",
            to: "c1",
            type: "normal",
            feedback: true,
            label: "Prestige reset",
          },
          points: [
            { x: 200, y: 80 },
            { x: 100, y: 80 },
          ],
          path: "M 200 80 L 100 80",
          bridges: [],
          unresolved: false,
        }}
      />,
    );
    expect(svg).toContain("↩ Prestige reset");
    expect(svg).toContain("translate(150 80)");
    expect(svg).toContain("Feedback: Prestige reset");
  });
  it("exposes typed input roles and feedback explanations in correction controls", () => {
    const d = fixture();
    d.cards[0] = {
      ...d.cards[0],
      kind: "initial_sink_node",
      inputRole: "time",
    };
    d.edges = [
      {
        id: "return",
        from: "c2",
        to: "c1",
        type: "normal",
        feedback: true,
        label: "Prestige reset",
      },
    ];
    const cardInspector = renderToStaticMarkup(
      <Inspector
        document={d}
        selection={{ kind: "card", id: "c0" }}
        onChange={() => {}}
        onDelete={() => {}}
        onClose={() => {}}
      />,
    );
    const edgeInspector = renderToStaticMarkup(
      <Inspector
        document={d}
        selection={{ kind: "edge", id: "return" }}
        onChange={() => {}}
        onDelete={() => {}}
        onClose={() => {}}
      />,
    );

    expect(cardInspector).toContain("Player input role");
    expect(cardInspector).toContain('value="time" selected=""');
    expect(edgeInspector).toContain("Feedback explanation");
    expect(edgeInspector).toContain('value="Prestige reset"');
  });
});
