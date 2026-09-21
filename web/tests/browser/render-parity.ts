import "../../src/render";
import { checkReleaseReadiness } from "../../src/core/conventions";
import {
  importDocument,
  blankDocument,
  cardSchema,
} from "../../src/core/document";
import {
  layoutDocument,
  measureCards,
  measureHeadings,
} from "../../src/core/layout";
import { svgBlob, pngBlob } from "../../src/lib/export";
import apex from "../../src/core/researched/apex_legends.json";
import rainbow from "../../../examples/rainbow_six_siege.json";
import dice from "../../../examples/dice_throne_digital.json";
import returns from "../fixtures/return-routing.json";

const output = document.getElementById("results")!;
const results: unknown[] = [];
try {
  for (const input of [apex, rainbow, dice, returns]) {
    const d = importDocument(input).document;
    await Promise.all(
      [400, 500, 600].map((weight) =>
        document.fonts.load(`${weight} 14px Inter`),
      ),
    );
    await document.fonts.ready;
    const ctx = document.createElement("canvas").getContext("2d")!;
    const measure = (text: string, size: number, weight: number) => {
      ctx.font = `${weight} ${size}px Inter`;
      return ctx.measureText(text).width;
    };
    const layout = layoutDocument(
      d,
      measureCards(d, measure),
      measureHeadings(d, measure),
    );
    if (!checkReleaseReadiness(d).ready) {
      const attempts = await Promise.allSettled([
        window.renderEconomy(d),
        svgBlob(d, layout),
        pngBlob(d, layout),
      ]);
      if (
        attempts.some((result) => result.status !== "rejected") ||
        layout.issues.length
      )
        throw new Error(
          `${d.name}: legacy draft export gate or geometry regression`,
        );
      results.push({
        name: d.name,
        legacyDraftRejected: true,
        routingIssues: 0,
      });
      continue;
    }
    const rendered = await window.renderEconomy(d);
    const svg = await (await svgBlob(d, layout)).text();
    const png = new Uint8Array(await (await pngBlob(d, layout)).arrayBuffer());
    const expected = Uint8Array.from(atob(rendered.png), (c) =>
      c.charCodeAt(0),
    );
    if (
      svg !== rendered.svg ||
      png.length !== expected.length ||
      !png.every((b, i) => b === expected[i])
    )
      throw new Error(`${d.name}: PNG or SVG mismatch`);
    if (
      rendered.issues.length ||
      svg.includes("Add connected card") ||
      svg.includes("Remove card")
    )
      throw new Error(`${d.name}: routing or control leakage`);
    results.push({
      name: d.name,
      svgIdentical: true,
      pngIdentical: true,
      routingIssues: 0,
      pngBytes: png.length,
    });
    output.textContent = JSON.stringify(results, null, 2);
  }
  const large = blankDocument();
  large.stages = Array.from({ length: 10 }, (_, i) => ({
    id: `s${i}`,
    label: `Stage ${i}`,
  }));
  large.groups = Array.from({ length: 5 }, (_, i) => ({
    id: `g${i}`,
    label: `Group ${i}`,
    color: "#f7f8fa",
  }));
  large.cards = Array.from({ length: 100 }, (_, i) =>
    cardSchema.parse({
      id: `n${i}`,
      label: `Action ${i}`,
      stageId: `s${i % 10}`,
      groupId: `g${Math.floor(i / 20)}`,
      order: Math.floor((i % 20) / 10),
      sources: ["Coins"],
      sinks: ["Time"],
    }),
  );
  for (let i = 0; i < 100 && large.edges.length < 300; i++) {
    if (i % 10 === 9) continue;
    for (let j = 1; j <= 4 && large.edges.length < 300; j++)
      large.edges.push({
        id: `e${String(large.edges.length).padStart(4, "0")}`,
        from: `n${i}`,
        to: `n${Math.floor(i / 10) * 10 + Math.min(9, (i % 10) + j)}`,
        type: "normal",
        feedback: false,
        label: "",
      });
  }
  const worker = new Worker(
    new URL("../../src/core/layout.worker.ts", import.meta.url),
    { type: "module" },
  );
  const metrics = measureCards(large),
    headings = measureHeadings(large);
  const started = performance.now();
  const completed = await new Promise<{
    layout: ReturnType<typeof layoutDocument>;
    error?: string;
  }>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Performance worker timeout")),
      10000,
    );
    worker.onmessage = (event) => {
      clearTimeout(timer);
      resolve(event.data);
    };
    worker.postMessage({ id: 1, document: large, metrics, headings });
  });
  const elapsed = performance.now() - started;
  worker.terminate();
  if (completed.error || completed.layout.issues.length || elapsed >= 1000)
    throw new Error(
      `100-card/300-edge layout failed: ${elapsed.toFixed(1)} ms`,
    );
  results.push({
    cards: 100,
    edges: 300,
    workerRoundTripMs: Math.round(elapsed),
    routingIssues: 0,
  });
  output.textContent = JSON.stringify(results, null, 2);
  output.dataset.status = "passed";
} catch (error) {
  output.textContent = JSON.stringify(
    { results, error: String(error) },
    null,
    2,
  );
  output.dataset.status = "failed";
}
