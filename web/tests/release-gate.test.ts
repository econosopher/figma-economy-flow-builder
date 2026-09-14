import { describe, expect, it } from "vitest";
import { blankDocument, cardSchema } from "../src/core/document";
import { checkReleaseReadiness } from "../src/core/conventions";
import { layoutDocument } from "../src/core/layout";
import { backupFilename, draftBackupBlob, svgBlob } from "../src/lib/export";

describe("release export gate", () => {
  it("blocks final SVG generation while leaving a clearly marked JSON backup", async () => {
    const draft = blankDocument();
    expect(checkReleaseReadiness(draft).ready).toBe(false);

    await expect(svgBlob(draft, layoutDocument(draft))).rejects.toThrow(
      "not ready to release",
    );
    const backup = JSON.parse(await draftBackupBlob(draft).text());
    expect(backup.draftStatus).toMatchObject({
      status: "draft-noncompliant",
    });
    expect(backup.draftStatus.violations.length).toBeGreaterThan(0);
    expect(backupFilename(draft.name, "json", false)).toContain(
      "DRAFT-NONCOMPLIANT",
    );
  });

  it("unlocks release after both canonical inputs reach the flow", () => {
    const document = blankDocument();
    document.cards[1].notes =
      "Not applicable: this game has no real-money spending.";
    document.cards.push(
      cardSchema.parse({
        id: "final",
        label: "Mastery",
        stageId: document.stages.at(-1)!.id,
        groupId: document.groups[0].id,
        order: 0,
        kind: "final_good",
      }),
    );
    document.edges.push({
      id: "time-to-final",
      from: "spend_time",
      to: "final",
      type: "final",
      feedback: false,
      label: "",
    });

    expect(checkReleaseReadiness(document)).toEqual({
      ready: true,
      violations: [],
    });
  });
});
