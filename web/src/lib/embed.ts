import { useEffect, useState } from "react";
export const GEC_HOME = "https://www.gameeconomistconsulting.com/";
export const GEC_CANVAS = "#DCDCDC";
export function trustedParent(referrer: string): string | null {
  try {
    const origin = new URL(referrer).origin;
    return [
      "https://www.gameeconomistconsulting.com",
      "https://gameeconomistconsulting.com",
      ...(import.meta.env.VITE_GEC_EMBED_PREVIEW_ORIGIN
        ? [import.meta.env.VITE_GEC_EMBED_PREVIEW_ORIGIN]
        : []),
    ].includes(origin)
      ? origin
      : null;
  } catch {
    return null;
  }
}
export function useGecEmbed() {
  const [parentOrigin] = useState(() =>
    new URLSearchParams(location.search).get("embed") === "1" &&
    window.parent !== window
      ? trustedParent(document.referrer)
      : null,
  );
  const close = () => {
    if (parentOrigin)
      window.parent.postMessage({ type: "gec-flow:close" }, parentOrigin);
    else window.location.assign(GEC_HOME);
  };
  useEffect(() => {
    if (!parentOrigin) return;
    window.parent.postMessage({ type: "gec-flow:ready" }, parentOrigin);
    const blocked = new WeakSet<Event>();
    const capture = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        (document.querySelector('dialog[open], [role="dialog"]') ||
          (e.target as Element)?.closest(
            'input,textarea,select,[contenteditable="true"]',
          ))
      )
        blocked.add(e);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || blocked.has(e) || e.defaultPrevented) return;
      e.preventDefault();
      window.parent.postMessage({ type: "gec-flow:close" }, parentOrigin);
    };
    window.addEventListener("keydown", capture, true);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", capture, true);
      window.removeEventListener("keydown", key);
    };
  }, [parentOrigin]);
  return { embedded: !!parentOrigin, close };
}
