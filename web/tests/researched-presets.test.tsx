import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { presets, starter } from "../src/core/presets";
import {
  deleteCard,
  forkDocument,
  importDocument,
  validateDocument,
} from "../src/core/document";
import { DiagramSvg } from "../src/components/DiagramSvg";
import { PresetTile } from "../src/components/PresetSources";
import { layoutDocument } from "../src/core/layout";
import { checkReleaseReadiness } from "../src/core/conventions";

describe("researched public catalog", () => {
  const preset = (id: string) => {
    const found = presets.find((entry) => entry.id === id);
    if (!found) throw new Error(`Missing preset ${id}`);
    return found.document;
  };
  const originals = presets.filter((p) =>
    [
      "gossip_harbor",
      "royal_match",
      "monopoly_go",
      "world_of_warcraft",
      "warzone",
      "apex_legends",
    ].includes(p.id),
  );
  it("retains the researched launch lineup while allowing new manifest contributions", () => {
    expect(originals.map((p) => p.id)).toEqual([
      "gossip_harbor",
      "royal_match",
      "monopoly_go",
      "world_of_warcraft",
      "warzone",
      "apex_legends",
    ]);
    expect(originals.map((p) => p.document.research!.category)).toEqual([
      "Mobile",
      "Mobile",
      "Mobile",
      "PC / console",
      "PC / console",
      "PC / console",
    ]);
    expect(starter.research).toBeUndefined();
  });
  it("keeps every bundled preset and the starter behind the economy convention gate", () => {
    for (const { document } of presets)
      expect(checkReleaseReadiness(document)).toEqual({
        ready: true,
        violations: [],
      });
    expect(checkReleaseReadiness(starter)).toEqual({
      ready: true,
      violations: [],
    });
  });
  for (const { document: d } of originals)
    it(`accounts for every original card and relationship in ${d.name}`, () => {
      const r = d.research!;
      expect(d.cards.length).toBeGreaterThanOrEqual(15);
      expect(d.cards.length).toBeLessThanOrEqual(25);
      expect(r.sources.length).toBeGreaterThanOrEqual(3);
      expect(new Set(r.sources.map((s) => s.id)).size).toBe(r.sources.length);
      const mappings = [...r.sources, ...r.interpretations];
      expect(new Set(mappings.flatMap((s) => s.cardIds))).toEqual(
        new Set(d.cards.map((c) => c.id)),
      );
      expect(new Set(mappings.flatMap((s) => s.edgeIds))).toEqual(
        new Set(d.edges.map((e) => e.id)),
      );
      for (const s of r.sources) expect(new URL(s.url).protocol).toBe("https:");
    });
  it("preserves original evidence through copying, user deletion and JSON round trips", () => {
    const original = preset("gossip_harbor");
    const copy = forkDocument(original);
    expect(copy.id).not.toBe(original.id);
    const edited = deleteCard(copy, copy.cards[0].id);
    edited.cards[0].label = "My changed action";
    const recovered = importDocument(
      JSON.parse(JSON.stringify(edited)),
    ).document;
    expect(recovered.research).toEqual(original.research);
    expect(recovered.cards[0].label).toBe("My changed action");
    expect(original.cards[1].label).not.toBe("My changed action");
    expect(validateDocument(starter).cards).toEqual(starter.cards);
  });
  it("rejects executable source links on JSON import", () => {
    const d = structuredClone(preset("gossip_harbor"));
    d.research!.sources[0].url = "javascript:alert(1)";
    expect(() => importDocument(d)).toThrow();
  });
  it("keeps evidence and controls outside SVG exports", () => {
    const document = preset("royal_match");
    const svg = renderToStaticMarkup(
      <DiagramSvg document={document} layout={layoutDocument(document)} />,
    );
    expect(svg).not.toContain("Original preset research");
    expect(svg).not.toContain("helpshift.com");
    expect(svg).not.toContain("Sources for");
    const tile = renderToStaticMarkup(
      <PresetTile
        doc={document}
        preview={null}
        onOpen={() => {}}
        onSources={() => {}}
      />,
    );
    expect(tile).toContain('aria-label="Open Royal Match"');
    expect(tile).toContain('aria-label="Sources for Royal Match"');
    expect(tile.match(/<button/g)).toHaveLength(2);
  });
  it("keeps failure and currency semantics distinct", () => {
    const royal = preset("royal_match");
    expect(royal.cards.find((c) => c.id === "attempt")!.sinks).not.toContain(
      "Life",
    );
    expect(royal.cards.find((c) => c.id === "fail")!.sinks).toContain("Life");
    const warzone = preset("warzone");
    expect(warzone.cards.find((c) => c.id === "buy")!.sinks).toEqual([
      "Match cash",
    ]);
    expect(warzone.cards.find((c) => c.id === "bundle")!.sinks).toEqual([
      "COD Points",
    ]);
    const wow = preset("world_of_warcraft");
    expect(wow.cards.find((c) => c.id === "upgrade")!.sinks).toContain(
      "Matching Mistcrests",
    );
    expect(JSON.stringify(wow.cards)).not.toContain("Valorstones");
  });
  it("keeps Wardogs transfers, rewards, death costs and access gates distinct", () => {
    const wardogs = preset("wardogs_mechanics");
    const card = (id: string) => {
      const found = wardogs.cards.find((entry) => entry.id === id);
      if (!found) throw new Error(`Missing Wardogs card ${id}`);
      return found;
    };

    expect(card("tip").sources).toEqual([]);
    expect(card("tip").sinks).toEqual([]);
    expect(card("tip").values).toContain("Cash moves between players");
    expect(card("revive").sources).toEqual(["System cash reward"]);

    expect(card("death").sinks).toEqual([]);
    expect(card("kit").sinks).toEqual(["Vendor cash"]);
    expect(wardogs.edges.some((edge) => edge.id === "death__kit")).toBe(true);

    expect(card("unlock").sinks).toEqual(["Access-unlock cash"]);
    expect(card("unlock").sinks).not.toEqual(card("kit").sinks);
  });
});
