import { describe, expect, it } from "vitest";
import {
  blankDocument,
  defaultSettings,
  importDocument,
  validateDocument,
} from "../src/core/document";
import {
  assertReleaseReady,
  checkReleaseReadiness,
} from "../src/core/conventions";

describe("web release conventions", () => {
  it("starts a private draft with the two canonical inputs", () => {
    const draft = blankDocument();
    expect(draft.visibility).toBe("private");
    expect(draft.cards.map(({ label, inputRole }) => ({ label, inputRole })))
      .toEqual([
        { label: "Spend Time", inputRole: "time" },
        { label: "Spend Money", inputRole: "money" },
      ]);
    expect(checkReleaseReadiness(draft).ready).toBe(false);
  });

  it("keeps semantic convention failures editable as structurally valid drafts", () => {
    const draft = validateDocument({
      schemaVersion: 3,
      id: "draft",
      name: "Draft",
      stages: [
        { id: "one", label: "One" },
        { id: "two", label: "Two" },
      ],
      groups: [{ id: "core", label: "Core" }],
      cards: [
        {
          id: "action",
          label: "Action",
          stageId: "two",
          groupId: "core",
          order: 0,
        },
        {
          id: "goal",
          label: "Goal",
          stageId: "one",
          groupId: "core",
          order: 1,
          kind: "final_good",
        },
      ],
      edges: [{ id: "back", from: "action", to: "goal" }],
      settings: defaultSettings,
      visibility: "private",
    });
    expect(draft.cards).toHaveLength(2);
    expect(checkReleaseReadiness(draft).ready).toBe(false);
    expect(() => assertReleaseReady(draft)).toThrow(
      "This diagram is not ready to release",
    );
  });

  it("preserves v2 input roles, notes, feedback, and visible labels", () => {
    const imported = importDocument({
      schemaVersion: 2,
      name: "Imported",
      stages: [
        { id: "input", label: "Inputs" },
        { id: "play", label: "Play" },
      ],
      nodes: [
        {
          id: "time",
          label: "Player attention",
          stageId: "input",
          kind: "initial_sink_node",
          inputRole: "time",
          notes: "A deliberate time investment.",
        },
        { id: "play", label: "Play", stageId: "play" },
      ],
      edges: [
        {
          from: "play",
          to: "time",
          feedback: true,
          label: "Return to play",
        },
      ],
    }).document;
    expect(imported.cards[0]).toMatchObject({
      inputRole: "time",
      notes: "A deliberate time investment.",
    });
    expect(imported.edges[0]).toMatchObject({
      feedback: true,
      label: "Return to play",
    });
  });
});
