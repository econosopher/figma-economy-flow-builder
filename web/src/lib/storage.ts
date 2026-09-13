import {
  validateDocument,
  settingsSchema,
  type EconomyDocument,
  type Settings,
} from "../core/document";
export interface SavedDocument {
  document: EconomyDocument;
  revision: number;
  updatedAt: string;
  isPreset?: boolean;
  cloudRevision?: number;
  pendingCloud?: boolean;
}
export const storagePrefix = "economy-flow:v3:";
export function localKey(id: string, owner = "guest") {
  return `${storagePrefix}${owner}:${id}`;
}
export function readSaved(id: string, owner = "guest"): SavedDocument | null {
  try {
    const raw = localStorage.getItem(localKey(id, owner));
    if (!raw) return null;
    const value = JSON.parse(raw);
    return { ...value, document: validateDocument(value.document) };
  } catch {
    return null;
  }
}
export function saveLocal(
  document: EconomyDocument,
  revision: number,
  owner = "guest",
  extra: Partial<SavedDocument> = {},
): SavedDocument {
  const current = readSaved(document.id, owner);
  if (current && current.revision !== revision)
    throw new Error(
      "This diagram changed in another tab. Reload its saved version or save your edits as a copy.",
    );
  const next = {
    ...current,
    ...extra,
    document,
    revision: revision + 1,
    updatedAt: new Date().toISOString(),
  };
  if (current)
    localStorage.setItem(
      `${localKey(document.id, owner)}:recovery`,
      JSON.stringify(current),
    );
  localStorage.setItem(localKey(document.id, owner), JSON.stringify(next));
  localStorage.setItem(`${storagePrefix}last:${owner}`, document.id);
  return next;
}
export function listLocal(owner = "guest"): SavedDocument[] {
  return Object.keys(localStorage)
    .filter(
      (k) =>
        k.startsWith(`${storagePrefix}${owner}:`) && !k.endsWith(":recovery"),
    )
    .flatMap((key) => {
      try {
        const data = JSON.parse(localStorage.getItem(key)!);
        return [{ ...data, document: validateDocument(data.document) }];
      } catch {
        return [];
      }
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export function loadSettings(owner = "guest"): Settings | null {
  try {
    const raw = localStorage.getItem(`${storagePrefix}settings:${owner}`);
    return raw ? settingsSchema.parse(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
export function persistSettings(settings: Settings, owner = "guest") {
  localStorage.setItem(
    `${storagePrefix}settings:${owner}`,
    JSON.stringify(settings),
  );
}
