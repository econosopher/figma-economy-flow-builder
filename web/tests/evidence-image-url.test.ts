import { describe, expect, it } from "vitest";
import { resolveEvidenceImageUrl } from "../src/lib/evidenceImageUrl";

describe("Wardogs evidence image URLs", () => {
  it("uses the current origin for canonical bundled Wardogs assets", () => {
    expect(
      resolveEvidenceImageUrl(
        "https://flow.gameeconomistconsulting.com/evidence/wardogs/crate-tutorial.jpg",
      ),
    ).toBe("/evidence/wardogs/crate-tutorial.jpg");
  });

  it("preserves external, non-HTTPS and non-Wardogs URLs", () => {
    expect(resolveEvidenceImageUrl("https://images.example.com/a.jpg")).toBe(
      "https://images.example.com/a.jpg",
    );
    expect(
      resolveEvidenceImageUrl(
        "https://flow.gameeconomistconsulting.com/evidence/other/a.jpg",
      ),
    ).toBe("https://flow.gameeconomistconsulting.com/evidence/other/a.jpg");
    expect(
      resolveEvidenceImageUrl(
        "http://flow.gameeconomistconsulting.com/evidence/wardogs/a.jpg",
      ),
    ).toBe("http://flow.gameeconomistconsulting.com/evidence/wardogs/a.jpg");
  });
});
