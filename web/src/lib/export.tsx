import { reportEvent } from "./api";
import { DiagramSvg } from "../components/DiagramSvg";
import type { EconomyDocument } from "../core/document";
import type { Layout } from "../core/layout";
import { assertReleaseReady, checkReleaseReadiness } from "../core/conventions";
import regularCss from "@fontsource/inter/400.css?raw";
import mediumCss from "@fontsource/inter/500.css?raw";
import semiboldCss from "@fontsource/inter/600.css?raw";
const fontUrls = import.meta.glob(
  "../../node_modules/@fontsource/inter/files/*-{400,500,600}-normal.woff2",
  { query: "?url", import: "default", eager: true },
) as Record<string, string>;
let fontPromise: Promise<string> | undefined;
async function fonts() {
  return (fontPromise ??= Promise.all(
    [regularCss, mediumCss, semiboldCss]
      .flatMap((css) => css.match(/@font-face\s*\{[^}]+\}/g) || [])
      .map(async (css) => {
        const name = css.match(/url\(\.\/files\/([^)]*\.woff2)\)/)?.[1];
        const url = Object.entries(fontUrls).find(([path]) =>
          path.endsWith("/" + name),
        )?.[1];
        if (!url) throw new Error("Export font is unavailable.");
        const response = await fetch(url);
        if (!response.ok) throw new Error("Could not load export font.");
        const bytes = new Uint8Array(await response.arrayBuffer());
        let binary = "";
        bytes.forEach((b) => (binary += String.fromCharCode(b)));
        return css.replace(
          /src:[^;]+;/,
          `src:url(data:font/woff2;base64,${btoa(binary)}) format('woff2');`,
        );
      }),
  ).then((parts) => parts.join("\n")));
}
export async function svgBlob(
  document: EconomyDocument,
  layout: Layout,
  selection?: string[],
) {
  assertReleaseReady(document);
  const { renderToStaticMarkup } = await import("react-dom/server");
  return new Blob(
    [
      renderToStaticMarkup(
        <DiagramSvg
          document={document}
          layout={layout}
          selection={selection}
          fontCss={await fonts()}
        />,
      ),
    ],
    { type: "image/svg+xml;charset=utf-8" },
  );
}
async function renderPng(
  document: EconomyDocument,
  layout: Layout,
  selection?: string[],
  scale = 2,
): Promise<Blob> {
  if (layout.issues.length)
    throw new Error("Resolve the highlighted routing issues before exporting.");
  const blob = await svgBlob(document, layout, selection);
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = window.document.createElement("canvas");
    canvas.width = Math.ceil(image.width * scale);
    canvas.height = Math.ceil(image.height * scale);
    if (
      canvas.width > 32767 ||
      canvas.height > 32767 ||
      canvas.width * canvas.height > 120_000_000
    )
      throw new Error(
        "This diagram is too large for a full PNG. Export a selection or download SVG.",
      );
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Image export is unavailable.");
    ctx.scale(scale, scale);
    ctx.drawImage(image, 0, 0);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Could not create PNG."))),
        "image/png",
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const filename = (name: string, ext: string) =>
  `${name.replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "economy"}.${ext}`;

export function draftBackupJson(document: EconomyDocument): string {
  const readiness = checkReleaseReadiness(document);
  const payload = readiness.ready
    ? document
    : {
        ...document,
        draftStatus: {
          status: "draft-noncompliant",
          message:
            "Backup only. Fix the listed economy conventions before sharing, publishing, or final export.",
          violations: readiness.violations,
        },
      };
  return JSON.stringify(payload, null, 2);
}

export function draftBackupBlob(document: EconomyDocument): Blob {
  return new Blob([draftBackupJson(document)], {
    type: "application/json",
  });
}

export function backupFilename(name: string, ext: string, ready: boolean) {
  return filename(ready ? name : `${name} DRAFT-NONCOMPLIANT`, ext);
}
export async function copyPng(
  d: EconomyDocument,
  l: Layout,
  selection?: string[],
) {
  if (!navigator.clipboard?.write)
    throw new Error(
      "Image clipboard is unavailable in this browser. Download PNG instead.",
    );
  await navigator.clipboard.write([
    new ClipboardItem({ "image/png": pngBlob(d, l, selection) }),
  ]);
}

export async function pngBlob(
  document: EconomyDocument,
  layout: Layout,
  selection?: string[],
  scale = 2,
): Promise<Blob> {
  try {
    return await renderPng(document, layout, selection, scale);
  } catch (error) {
    reportEvent("export_failed", {
      cards: document.cards.length,
      edges: document.edges.length,
    });
    throw error;
  }
}
