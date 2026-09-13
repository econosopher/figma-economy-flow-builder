import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import { validateDocument } from "./core/document";
import { layoutDocument, measureCards, measureHeadings } from "./core/layout";
import { svgBlob, pngBlob } from "./lib/export";

export interface RenderedDiagram {
  svg: string;
  png: string;
  issues: string[];
  width: number;
  height: number;
}
declare global {
  interface Window {
    renderEconomy: (input: unknown) => Promise<RenderedDiagram>;
  }
}
window.renderEconomy = async (input) => {
  const diagram = validateDocument(input);
  await Promise.all(
    [400, 500, 600].map((weight) =>
      document.fonts.load(`${weight} 14px Inter`),
    ),
  );
  await document.fonts.ready;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) throw new Error("Font measurement is unavailable.");
  const measure = (text: string, size: number, weight: number) => {
    ctx.font = `${weight} ${size}px Inter`;
    return ctx.measureText(text).width;
  };
  const layout = layoutDocument(
    diagram,
    measureCards(diagram, measure),
    measureHeadings(diagram, measure),
  );
  const svg = await (await svgBlob(diagram, layout)).text();
  if (layout.issues.length)
    return {
      svg,
      png: "",
      issues: layout.issues,
      width: layout.bounds.width,
      height: layout.bounds.height,
    };
  const bytes = new Uint8Array(
    await (await pngBlob(diagram, layout)).arrayBuffer(),
  );
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return {
    svg,
    png: btoa(binary),
    issues: [],
    width: layout.bounds.width,
    height: layout.bounds.height,
  };
};
