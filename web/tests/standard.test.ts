import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  importDocument,
  validateDocument,
  type EconomyDocument,
} from "../src/core/document";
import {
  ECONOMY_FLOW_RULES,
  ECONOMY_FLOW_RULES_SOURCE,
  ECONOMY_FLOW_RULES_VERSION,
  rulesMarkdown,
  rulesPrompt,
  STANDARD_GUIDE,
} from "../src/core/rules";
import {
  checkStandard,
  resourceWords,
  sameResource,
} from "../src/core/standard";
import { starter } from "../src/core/presets";

/** Gears of War: E-Day Horde Siege, the diagram that passed review on 2026-10-27. */
const horde: EconomyDocument = validateDocument(
  JSON.parse(
    readFileSync(
      new URL("./fixtures/horde-siege-v2.json", import.meta.url),
      "utf8",
    ),
  ),
);
const card = (d: EconomyDocument, id: string) => {
  const found = d.cards.find((c) => c.id === id);
  if (!found) throw new Error(`fixture has no card ${id}`);
  return found;
};
const withCard = (
  d: EconomyDocument,
  id: string,
  patch: Partial<EconomyDocument["cards"][number]>,
): EconomyDocument => ({
  ...d,
  cards: d.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)),
});
const rules = (issues: ReturnType<typeof checkStandard>) =>
  issues.map((i) => i.rule);

describe("GEC rules contract", () => {
  const markdown = readFileSync(
    new URL("../../docs/ECONOMY_FLOW_RULES.md", import.meta.url),
    "utf8",
  );
  it("mirrors docs/ECONOMY_FLOW_RULES.md verbatim: version, source and every rule", () => {
    expect(/^Contract version: `([^`]+)`$/m.exec(markdown)?.[1]).toBe(
      ECONOMY_FLOW_RULES_VERSION,
    );
    expect(
      /^Framework source: \[[^\]]+\]\((https?:\/\/[^)]+)\)/m.exec(
        markdown,
      )?.[1],
    ).toBe(ECONOMY_FLOW_RULES_SOURCE);
    const sections = [
      ...markdown.matchAll(/^## (GEC-\d{3}) - (.+)\n\n([\s\S]*?)(?=\n## |$)/gm),
    ].map((m) => ({ id: m[1], title: m[2].trim(), statement: m[3].trim() }));
    expect(sections).toEqual(ECONOMY_FLOW_RULES);
  });
  it("keeps stable IDs GEC-001 to GEC-015 and the pilot rules unchanged", () => {
    expect(ECONOMY_FLOW_RULES.map((r) => r.id)).toEqual(
      Array.from(
        { length: 15 },
        (_, i) => `GEC-${String(i + 1).padStart(3, "0")}`,
      ),
    );
    expect(ECONOMY_FLOW_RULES_VERSION).toBe("2026.10.27");
    expect(rulesPrompt(["GEC-011"])).toMatch(/^\[GEC-011\] Keep roots free/);
    expect(rulesMarkdown()).toContain(
      "## GEC-015 - Size cards in a group row alike",
    );
    expect(STANDARD_GUIDE).toContain("resource ledger");
    expect(STANDARD_GUIDE).toContain("Origin: what trigger creates it");
  });
});

describe("resource names", () => {
  it("strips the trigger after a colon, dash or bracket and matches word prefixes", () => {
    expect(resourceWords("Energy: mission start grant")).toEqual(["energy"]);
    expect(resourceWords("Weapon Parts lost on a fail")).toEqual([
      "weapon",
      "parts",
      "lost",
      "on",
      "a",
      "fail",
    ]);
    expect(resourceWords("Coins (weekly cap)")).toEqual(["coins"]);
    expect(resourceWords("Iron - premium bundles")).toEqual(["iron"]);
    expect(
      sameResource(
        resourceWords("Weapon Parts kept"),
        resourceWords("Weapon Parts: buy a mod"),
      ),
    ).toBe(true);
    expect(
      sameResource(resourceWords("Player time"), resourceWords("Player XP")),
    ).toBe(false);
    expect(sameResource([], ["coins"])).toBe(false);
  });
});

describe("checkStandard on the Horde Siege v2 diagram", () => {
  it("reports nothing on the reviewed diagram", () => {
    expect(checkStandard(horde)).toEqual([]);
  });
  it("GEC-011: a root with a resource row is named", () => {
    const issues = checkStandard(
      withCard(horde, "time", { sinks: ["Player time"] }),
    );
    expect(rules(issues)).toEqual(["GEC-011"]);
    expect(issues[0]).toMatchObject({ cardId: "time", severity: "warning" });
    expect(issues[0].message).toContain("Spend Time");
    expect(issues[0].message).toContain("Player time");
  });
  it("GEC-007: a card with no path from a root is named", () => {
    const issues = checkStandard({
      ...horde,
      edges: horde.edges.filter((e) => e.to !== "parts"),
    });
    expect(issues.map((i) => [i.rule, i.cardId])).toEqual([
      ["GEC-007", "parts"],
    ]);
    expect(issues[0].message).toContain("Bank Weapon Parts");
  });
  it("GEC-013: a title that wraps to two lines is named, one-line titles are not", () => {
    const issues = checkStandard(
      withCard(horde, "kit", { label: "Kit Out in the Planning Room" }),
    );
    expect(rules(issues)).toEqual(["GEC-013"]);
    expect(issues[0]).toMatchObject({ cardId: "kit" });
    expect(issues[0].message).toContain("2 lines");
    expect(
      checkStandard(withCard(horde, "kit", { label: "Kit Out in the Room" })),
    ).toEqual([]);
  });
  it("GEC-012: a resource spent but never produced names the card and resource", () => {
    // Mod Weapons now spends Scrap, which nothing drops. Weapon Parts is then never
    // spent either, but the fixture's limitations already name Weapon Parts.
    const issues = checkStandard(
      withCard(horde, "mods", { sinks: ["Scrap: buy a mod"] }),
    );
    expect(issues.map((i) => [i.rule, i.resource, i.cardId])).toEqual([
      ["GEC-012", "Scrap", "mods"],
    ]);
    expect(issues[0].message).toContain("no card produces it");
  });
  it("GEC-012: a resource produced but never spent is a ledger gap unless a limitation names it", () => {
    const silent = withCard(
      { ...horde, research: { ...horde.research!, limitations: [] } },
      "mods",
      { sinks: [] },
    );
    const issues = checkStandard(silent).filter((i) => i.resource !== "Iron");
    expect(issues.map((i) => [i.rule, i.resource, i.cardId])).toEqual([
      ["GEC-012", "Weapon Parts", "extract"],
    ]);
    expect(issues[0].message).toContain("no card spends it");
    const noted = {
      ...silent,
      research: {
        ...silent.research!,
        limitations: ["What Weapon Parts buy is not published."],
      },
    };
    expect(checkStandard(noted).filter((i) => i.resource !== "Iron")).toEqual(
      [],
    );
  });
  it("GEC-012: Iron is spent with no producing card but the limitation covers it", () => {
    expect(card(horde, "coins").sinks).toContain("Iron: premium bundles");
    const silent = {
      ...horde,
      research: { ...horde.research!, limitations: [] },
    };
    expect(checkStandard(silent).map((i) => [i.rule, i.resource])).toEqual([
      ["GEC-012", "Iron"],
    ]);
  });
  it("GEC-004: an orange row that is spendable elsewhere, or reads as a currency, is named", () => {
    const spendable = checkStandard(
      withCard(horde, "classlvl", { values: ["Energy: carried over"] }),
    );
    expect(rules(spendable)).toEqual(["GEC-004"]);
    expect(spendable[0]).toMatchObject({
      cardId: "classlvl",
      resource: "Energy",
    });
    expect(spendable[0].message).toContain("spendable on");
    const currency = checkStandard(
      withCard(horde, "acctlvl", {
        values: ["Player level: 100, 4 Re-Ups", "Starting ammo"],
      }),
    );
    expect(rules(currency)).toEqual(["GEC-004"]);
    expect(currency[0].message).toContain("reads as a currency or inventory");
    // Progression that borrows a currency word stays orange.
    expect(
      checkStandard(withCard(horde, "acctlvl", { values: ["Gold rank"] })),
    ).toEqual([]);
  });
  it("GEC-014: return pipes need a label, stay few, and do not bundle at one port", () => {
    const pipe = (id: string, from: string, to: string, label = "") => ({
      id,
      from,
      to,
      type: "normal" as const,
      feedback: true,
      label,
    });
    const unlabelled = checkStandard({
      ...horde,
      edges: [...horde.edges, pipe("fb1", "mods", "kit")],
    });
    expect(unlabelled).toHaveLength(1);
    expect(unlabelled[0]).toMatchObject({ rule: "GEC-014", edgeId: "fb1" });
    expect(unlabelled[0].message).toContain("Mod Weapons");
    expect(unlabelled[0].message).toContain("Kit Out");
    expect(
      checkStandard({
        ...horde,
        edges: [...horde.edges, pipe("fb1", "mods", "kit", "Next mission")],
      }),
    ).toEqual([]);
    const bundled = checkStandard({
      ...horde,
      edges: [
        ...horde.edges,
        pipe("fb1", "mods", "kit", "Next mission"),
        pipe("fb2", "classlvl", "kit", "Class unlocks"),
        pipe("fb3", "status", "fight", "Prestige"),
      ],
    });
    expect(bundled.map((i) => i.message)).toEqual([
      expect.stringContaining("3 return pipes"),
      expect.stringContaining("“Kit Out” receives 2 return pipes"),
    ]);
    expect(bundled.every((i) => i.rule === "GEC-014")).toBe(true);
  });
  it("GEC-015: a much taller card in a group row is named with the row it breaks", () => {
    const tall = withCard(horde, "kit", {
      notes: `${card(horde, "kit").notes} ${"A long note that pushes the card well below its neighbours. ".repeat(4)}`,
    });
    const issues = checkStandard(tall);
    expect(rules(issues)).toEqual(["GEC-015"]);
    expect(issues[0]).toMatchObject({ cardId: "kit" });
    expect(issues[0].message).toContain("Mission economy");
    // Stacked cards in the same stage are compared row by row, not against the stack above.
    expect(checkStandard(horde).filter((i) => i.cardId === "acctlvl")).toEqual(
      [],
    );
  });
});

describe("v2 import keeps what the standard checks", () => {
  it("carries node notes and edge labels through importDocument", () => {
    const { document, notices } = importDocument({
      schemaVersion: 2,
      stages: [
        { id: "a", label: "Inputs" },
        { id: "b", label: "Play" },
      ],
      nodes: [
        {
          id: "t",
          label: "Spend Time",
          stageId: "a",
          kind: "initial_sink_node",
        },
        {
          id: "p",
          label: "Play",
          stageId: "b",
          notes: "Energy source unknown.",
        },
      ],
      edges: [
        { from: "t", to: "p" },
        { from: "p", to: "t", label: "Next round" },
      ],
    });
    expect(document.cards.find((c) => c.id === "p")?.notes).toBe(
      "Energy source unknown.",
    );
    expect(document.edges.map((e) => [e.feedback, e.label])).toEqual([
      [false, ""],
      [true, "Next round"],
    ]);
    expect(notices).toHaveLength(1);
    expect(checkStandard(document).filter((i) => i.rule === "GEC-014")).toEqual(
      [],
    );
  });
});

describe("checkStandard on the bundled starter", () => {
  it("flags the starter's root rows and unlabelled return pipe as warnings only", () => {
    const issues = checkStandard(starter);
    expect(issues.every((i) => i.severity === "warning")).toBe(true);
    expect(
      issues.filter((i) => i.rule === "GEC-011").map((i) => i.cardId),
    ).toEqual(["time", "money"]);
    expect(issues.some((i) => i.rule === "GEC-014" && i.edgeId === "e7")).toBe(
      true,
    );
    expect(
      issues.some((i) => i.rule === "GEC-012" && i.resource === "Player time"),
    ).toBe(false);
  });
});
