import type { EconomyDocument } from "./document";
// Coalesce only repeated typing in one text field. Structural edits are separate actions.
export function textEditKey(
  before: EconomyDocument,
  after: EconomyDocument,
): string | null {
  const changes: {
    path: (string | number)[];
    before: unknown;
    after: unknown;
  }[] = [];
  function walk(a: unknown, b: unknown, path: (string | number)[]) {
    if (a === b) return;
    if (a && b && typeof a === "object" && typeof b === "object") {
      if (Array.isArray(a) !== Array.isArray(b)) {
        changes.push({ path, before: a, after: b });
        return;
      }
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      for (const key of keys)
        walk(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
          [...path, key],
        );
    } else changes.push({ path, before: a, after: b });
  }
  walk(before, after, []);
  if (changes.length !== 1) return null;
  const change = changes[0];
  if (typeof change.before !== "string" || typeof change.after !== "string")
    return null;
  const key = change.path.at(-1),
    parent = change.path.at(-2);
  return ["label", "name", "notes"].includes(String(key)) ||
    ["sources", "sinks", "values"].includes(String(parent))
    ? JSON.stringify(change.path)
    : null;
}
