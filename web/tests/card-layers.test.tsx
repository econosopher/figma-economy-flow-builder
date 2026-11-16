import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import {
  cardLayer,
  importDocument,
  usesLayers,
  validateDocument,
  type EconomyDocument,
} from "../src/core/document";
import { applyEdits } from "../src/core/edits";
import { BOX_KEY_ROW, layoutDocument } from "../src/core/layout";
import { presets } from "../src/core/presets";
import { CardDrawing, DiagramSvg } from "../src/components/DiagramSvg";

const raw = () =>
  JSON.parse(
    readFileSync(
      new URL("./fixtures/layers-demo.json", import.meta.url),
      "utf8",
    ),
  );
const demo = () => validateDocument(raw());
const card = (d: EconomyDocument, id: string) =>
  d.cards.find((c) => c.id === id)!;
const drawn = (d: EconomyDocument, id: string) => {
  const placed = layoutDocument(d).cards.find((c) => c.card.id === id)!;
  return renderToStaticMarkup(
    <CardDrawing
      card={placed.card}
      metrics={placed.metrics}
      settings={d.settings}
    />,
  );
};

describe("card layer field", () => {
  it("defaults to live and leaves a document without the field unchanged", () => {
    const d = demo();
    expect("layer" in card(d, "daily")).toBe(false);
    expect(cardLayer(card(d, "daily"))).toBe("live");
    expect(cardLayer(card(d, "use_shop"))).toBe("design");
    expect(cardLayer(card(d, "season_pass"))).toBe("proposal");
    for (const p of presets) {
      expect(usesLayers(p.document)).toBe(false);
      expect(p.document.cards.every((c) => !("layer" in c))).toBe(true);
    }
  });
  it("rejects an unknown layer", () => {
    const input = raw();
    input.cards[2].layer = "planned";
    expect(() => validateDocument(input)).toThrow();
  });
  it("survives JSON import, a v2 import and a card put edit", () => {
    expect(cardLayer(card(importDocument(raw()).document, "upgrade"))).toBe(
      "design",
    );
    const v2 = importDocument({
      schemaVersion: 2,
      stages: [{ id: "s1", label: "One" }],
      nodes: [
        { id: "a", label: "To Do A", stageId: "s1", layer: "proposal" },
        { id: "b", label: "To Do B", stageId: "s1" },
      ],
      edges: [],
    }).document;
    expect(v2.cards.map(cardLayer)).toEqual(["proposal", "live"]);
    const edited = applyEdits(demo(), [
      { op: "put", entity: "cards", value: { id: "daily", layer: "design" } },
      { op: "put", entity: "cards", value: { id: "use_shop", layer: "live" } },
    ]);
    expect(cardLayer(card(edited, "daily"))).toBe("design");
    expect(cardLayer(card(edited, "use_shop"))).toBe("live");
    expect(card(edited, "daily").label).toBe("To Claim a Login Bonus");
  });
});

describe("layer drawing", () => {
  it("draws a live card with no pattern, halo or extra markup", () => {
    const d = demo();
    const live = drawn(d, "daily");
    expect(live).not.toMatch(/pattern|data-layer|paint-order|<defs/);
    // The same card with the layer cleared is the markup a design card adds to.
    const plain = { ...d, cards: d.cards.map(({ layer: _, ...c }) => c) };
    expect(drawn(plain, "use_shop")).not.toMatch(/pattern|data-layer/);
  });
  it("hatches a designed card and back-hatches a proposal across the whole title bar", () => {
    const d = demo();
    const design = drawn(d, "use_shop"),
      proposal = drawn(d, "season_pass");
    expect(design).toContain('patternTransform="rotate(45)"');
    expect(design).toMatch(
      /<rect data-layer="design" x="1\.5" y="1\.5" width="193" height="59" rx="7" fill="url\(#layer-[\w-]+\)"/,
    );
    expect(proposal).toContain('patternTransform="rotate(-45)"');
    expect(design).not.toContain("rotate(-45)");
    expect(design + proposal).not.toContain("<circle");
    expect(proposal).toMatch(/<rect data-layer="proposal"[^>]*fill="url\(#/);
    // Pattern in the title ink, title haloed in the bar colour: no new colour.
    for (const svg of [design, proposal]) {
      expect(svg).toMatch(
        /<text[^>]*fill="#ffffff" stroke="#000000" stroke-width="5"[^>]*paint-order="stroke"/,
      );
      const colours = new Set(svg.match(/#[0-9a-fA-F]{6}/g));
      expect(colours).toEqual(
        new Set(drawn(d, "daily").match(/#[0-9a-fA-F]{6}/g)),
      );
    }
  });
  it("gives every patterned card its own pattern id in one export", () => {
    const d = demo();
    const svg = renderToStaticMarkup(
      <DiagramSvg document={d} layout={layoutDocument(d)} />,
    );
    const ids = [...svg.matchAll(/<pattern id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(svg).toContain(`fill="url(#${id})"`);
    expect(svg.match(/data-layer="design"/g)).toHaveLength(2);
    expect(svg.match(/data-layer="proposal"/g)).toHaveLength(1);
  });
  it("adds the box key only when a card is designed or proposed", () => {
    const d = demo();
    const live = { ...d, cards: d.cards.map(({ layer: _, ...c }) => c) };
    const withKey = layoutDocument(d),
      without = layoutDocument(live);
    expect(without.legend.layers).toEqual([]);
    expect(withKey.legend.layers.map((l) => l.layer)).toEqual([
      "live",
      "design",
      "proposal",
    ]);
    expect(withKey.bounds.height - without.bounds.height).toBe(
      BOX_KEY_ROW * withKey.legend.layerRows,
    );
    expect(withKey.routes.map((r) => r.points)).toEqual(
      without.routes.map((r) => r.points),
    );
    const svg = (doc: EconomyDocument) =>
      renderToStaticMarkup(
        <DiagramSvg document={doc} layout={layoutDocument(doc)} />,
      );
    expect(svg(d)).toContain("BOX KEY");
    expect(svg(d)).toContain("Hatched: designed, not built");
    expect(svg(d)).toContain(
      "Hatched the other way: proposal, not a game fact",
    );
    expect(svg(live)).not.toMatch(/BOX KEY|<pattern/);
    const hidden = {
      ...d,
      settings: { ...d.settings, showLegend: false },
    };
    expect(svg(hidden)).not.toContain("BOX KEY");
    expect(svg(hidden)).toContain('data-layer="design"');
  });
});
