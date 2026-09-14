import { beforeEach, describe, it, expect, vi } from "vitest";
import { blankDocument } from "../src/core/document";
import { saveLocal, readSaved, listLocal } from "../src/lib/storage";
import { initial } from "../src/App";
class MemoryStorage {
  [key: string]: unknown;
  getItem(key: string) {
    return typeof this[key] === "string" ? this[key] : null;
  }
  setItem(key: string, value: string) {
    this[key] = value;
  }
  removeItem(key: string) {
    delete this[key];
  }
}
beforeEach(() => vi.stubGlobal("localStorage", new MemoryStorage()));
describe("local recovery and conflicts", () => {
  it("does not overwrite a more recent tab revision", () => {
    const d = blankDocument();
    saveLocal(d, 0);
    const later = { ...d, name: "Edited in other tab" };
    saveLocal(later, 1);
    expect(() => saveLocal({ ...d, name: "Stale tab" }, 1)).toThrow(
      "another tab",
    );
    expect(readSaved(d.id)?.document.name).toBe(later.name);
  });
  it("keeps a recovery copy, restores exact settings and isolates account libraries", () => {
    const d = blankDocument();
    const first = saveLocal(d, 0, "alice");
    saveLocal(
      { ...d, settings: { ...d.settings, spacing: "compact" } },
      first.revision,
      "alice",
    );
    expect(readSaved(d.id, "alice")?.document.settings.spacing).toBe("compact");
    expect(readSaved(d.id, "bob")).toBeNull();
    expect(listLocal("alice")).toHaveLength(1);
    expect(listLocal("bob")).toHaveLength(0);
  });
  it("opens the existing guest document before choosing a fresh-user default", () => {
    const saved = { ...blankDocument(), name: "Returning guest diagram" };
    saveLocal(saved, 0);
    expect(initial().id).toBe(saved.id);
    expect(initial().name).toBe("Returning guest diagram");
  });
});
