import { beforeEach, describe, it, expect, vi } from "vitest";
import { blankDocument } from "../src/core/document";
import {
  listLocal,
  readSaved,
  saveLocal,
  storagePrefix,
} from "../src/lib/storage";
import { accountBootstrap, editorRoute, initial } from "../src/App";
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
  it("honors explicit local and preset routes without replacing a saved guest document", () => {
    const existing = { ...blankDocument(), name: "Existing guest diagram" };
    const selected = { ...blankDocument(), name: "Explicit local diagram" };
    saveLocal(existing, 0);
    saveLocal(selected, 0);

    expect(initial(`?local=${selected.id}`).id).toBe(selected.id);
    expect(initial("?local=missing").id).toBe(selected.id);

    const preset = initial("?preset=wardogs");
    expect(preset.id).not.toBe("wardogs");
    expect(preset.visibility).toBe("private");
    expect(initial("?preset=missing").id).toBe(selected.id);
  });
  it("gives read-only snapshot and account routes precedence", () => {
    expect(editorRoute("?preset=wardogs&local=one")).toEqual({
      kind: "local",
      id: "one",
    });
    expect(editorRoute("?gallery=published&preset=wardogs")).toEqual({
      kind: "snapshot",
    });
    expect(editorRoute("?share=token&local=one")).toEqual({
      kind: "snapshot",
    });
    expect(editorRoute("?document=mine&preset=wardogs")).toEqual({
      kind: "account",
    });
  });
  it("keeps an explicit preset fork when an authenticated owner has a last document", () => {
    const owner = "authenticated-owner";
    const oldAccountDocument = {
      ...blankDocument(),
      name: "Old private account document",
    };
    const saved = saveLocal(oldAccountDocument, 0, owner);
    localStorage.setItem(
      `${storagePrefix}last:${owner}`,
      oldAccountDocument.id,
    );
    const routedPreset = initial("?preset=wardogs");

    const result = accountBootstrap(
      "?preset=wardogs",
      routedPreset,
      readSaved(oldAccountDocument.id, owner),
    );

    expect(result.document.id).toBe(routedPreset.id);
    expect(result.document.id).not.toBe(saved.document.id);
    expect(result.document.name).not.toBe(oldAccountDocument.name);
    expect(result.document.visibility).toBe("private");
    expect(result.dirty).toBe(true);
    expect(result.preservePresetRoute).toBe(true);

    const invalid = accountBootstrap(
      "?preset=missing",
      routedPreset,
      readSaved(oldAccountDocument.id, owner),
    );
    expect(invalid.document.id).toBe(oldAccountDocument.id);
    expect(invalid.preservePresetRoute).toBe(false);
  });
});
