import { expect, it } from "vitest";
import { trustedParent } from "../src/lib/embed";
it("only accepts the GEC website as an embed parent", () => {
  expect(trustedParent("https://www.gameeconomistconsulting.com/blog/")).toBe(
    "https://www.gameeconomistconsulting.com",
  );
  expect(trustedParent("https://gameeconomistconsulting.com/")).toBe(
    "https://gameeconomistconsulting.com",
  );
  for (const value of [
    "",
    "https://www.gameeconomistconsulting.com.evil.test/",
    "http://www.gameeconomistconsulting.com/",
    "https://evil.test/",
  ])
    expect(trustedParent(value)).toBeNull();
});
