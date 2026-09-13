import { describe, it, expect } from "vitest";
import {
  blankDocument,
  forkDocument,
  validateDocument,
} from "../src/core/document";
import { starter } from "../src/core/presets";

describe("visibility compatibility", () => {
  it("defaults new diagrams and preset copies to public", () => {
    expect(blankDocument().visibility).toBe("public");
    expect(forkDocument(starter).visibility).toBe("public");
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
});
