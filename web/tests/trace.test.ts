import { describe, expect, it } from "vitest";
import { traceInvestments } from "../src/core/trace";
import type { Card, EconomyDocument } from "../src/core/document";
const card = (id: string, label = id, root = false): Card => ({
  id,
  label,
  kind: root ? "initial_sink_node" : "action",
  stageId: "s",
  groupId: "g",
  order: 0,
  sources: [],
  sinks: [],
  values: [],
  notes: "",
});
const cards = [
  card("t", "Invest time", true),
  card("m", "Money", true),
  ...["play", "buy", "craft", "benefit", "other", "orphan"].map((id) =>
    card(id),
  ),
];
const edge = (
  from: string,
  to: string,
  id = from + to,
  feedback = false,
): EconomyDocument["edges"][number] => ({
  id,
  from,
  to,
  type: "normal",
  feedback,
  label: "",
});
const edges = [
  edge("t", "play"),
  edge("m", "buy"),
  edge("play", "craft"),
  edge("buy", "craft"),
  edge("play", "craft", "parallel"),
  edge("craft", "benefit"),
  edge("play", "other"),
  edge("orphan", "craft"),
  edge("benefit", "play", "return", true),
];
describe("investment path highlighting", () => {
  it("traces both roots and every parallel input without downstream or orphan branches", () => {
    const path = traceInvestments({ cards, edges }, ["craft"]);
    expect([...path.cards].sort()).toEqual(["buy", "craft", "m", "play", "t"]);
    expect([...path.edges].sort()).toEqual(
      ["buycraft", "parallel", "playcraft", "mbuy", "tplay"].sort(),
    );
  });
  it("traces a terminal benefit through the complete acquisition chain", () => {
    const path = traceInvestments({ cards, edges }, ["benefit"]);
    expect(path.edges.has("craftbenefit")).toBe(true);
    expect(path.cards.has("t") && path.cards.has("m")).toBe(true);
    expect(path.edges.has("return")).toBe(false);
  });
  it("clears, handles disconnected selections and stops safely at roots", () => {
    expect(traceInvestments({ cards, edges }, []).edges.size).toBe(0);
    expect([...traceInvestments({ cards, edges }, ["orphan"]).cards]).toEqual([
      "orphan",
    ]);
    expect(
      traceInvestments({ cards, edges: [...edges, edge("craft", "t")] }, ["t"])
        .edges.size,
    ).toBe(0);
  });
});
