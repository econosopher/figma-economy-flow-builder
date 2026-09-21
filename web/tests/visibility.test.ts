import { describe, it, expect } from "vitest";
import {
  blankDocument,
  forkDocument,
  validateDocument,
} from "../src/core/document";
import { presets, starter } from "../src/core/presets";
import { initial } from "../src/App";

describe("visibility compatibility", () => {
  it("defaults new diagrams and preset copies to private", () => {
    expect(blankDocument().visibility).toBe("private");
    expect(forkDocument(starter).visibility).toBe("private");
  });
  it("copies published diagrams privately", () => {
    expect(forkDocument({ ...starter, visibility: "public" }).visibility).toBe(
      "private",
    );
  });
  it("does not opt legacy saved diagrams into automatic publication", () => {
    expect(validateDocument(starter).visibility).toBeUndefined();
  });
  it("retains an explicit private preference when copying and importing", () => {
    const privateDoc = { ...starter, visibility: "private" as const };
    expect(forkDocument(privateDoc).visibility).toBe("private");
    expect(
      validateDocument(JSON.parse(JSON.stringify(privateDoc))).visibility,
    ).toBe("private");
  });
  it("makes fresh bundled-preset forks private", () => {
    const wardogs = presets.find((preset) => preset.id === "wardogs");
    expect(wardogs).toBeDefined();
    const fresh = initial("?preset=wardogs");
    expect(fresh.visibility).toBe("private");
    expect(fresh.id).not.toBe(wardogs!.document.id);
  });
});
