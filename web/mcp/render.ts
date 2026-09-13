import puppeteer from "@cloudflare/puppeteer";
import type { AppEnv } from "../worker/env";
import { HttpError, rest, boundedBytes } from "../worker/helpers";
import { validateDocument } from "../src/core/document";
import { requireCapability, type McpIdentity } from "./auth";
import type { RenderedDiagram } from "../src/render";

export async function renderDiagram(
  env: AppEnv,
  user: McpIdentity,
  input: unknown,
) {
  await requireCapability(env, user, "read");
  const document = validateDocument(input);
  if (!env.BROWSER)
    throw new HttpError(503, "Diagram rendering is not configured.");
  const allowed = await env.EVENT_LIMIT.limit({ key: `render:${user.id}` });
  if (!allowed.success)
    throw new HttpError(429, "Preview limit reached. Try again shortly.");
  const browser = await puppeteer.launch(env.BROWSER);
  let rendered: RenderedDiagram;
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    await page.setRequestInterception(true);
    page.on("request", async (request) => {
      const url = new URL(request.url());
      if (url.protocol === "data:" || url.protocol === "blob:") {
        await request.continue();
        return;
      }
      if (
        url.origin !== "https://renderer.invalid" ||
        (url.pathname !== "/render.html" &&
          !url.pathname.startsWith("/assets/"))
      ) {
        await request.abort();
        return;
      }
      try {
        const response = await env.ASSETS.fetch(
          new Request(`https://assets.internal${url.pathname}`),
        );
        await request.respond({
          status: response.status,
          contentType:
            response.headers.get("content-type") || "application/octet-stream",
          body: Buffer.from(await boundedBytes(response.body, 5_000_000)),
        });
      } catch {
        await request.abort();
      }
    });
    await page.goto("https://renderer.invalid/render.html", {
      waitUntil: "networkidle0",
      timeout: 30000,
    });
    await page.waitForFunction('typeof window.renderEconomy === "function"');
    rendered = await page.evaluate(
      async (input) => window.renderEconomy(input),
      document,
    );
  } catch {
    console.error(
      JSON.stringify({
        event: "mcp_render_failed",
        cards: document.cards.length,
        edges: document.edges.length,
      }),
    );
    throw new HttpError(
      502,
      "Rendering failed. Retry the preview; your saved diagram is unchanged.",
    );
  } finally {
    await browser.close();
  }
  if (rendered.issues.length)
    return {
      routingIssues: rendered.issues,
      svg: rendered.svg,
      png: "",
      previewId: null,
    };
  const id = crypto.randomUUID();
  const root = `${user.id}/${id}`;
  const png = Uint8Array.from(atob(rendered.png), (c) => c.charCodeAt(0));
  if (png.length > 30_000_000 || rendered.svg.length > 5_000_000)
    throw new HttpError(
      413,
      "This preview is too large. Export a smaller diagram.",
    );
  const expiresAt = new Date(Date.now() + 3600000).toISOString();
  await rest(env, "mcp_previews", {
    method: "POST",
    body: JSON.stringify({
      id,
      owner_id: user.id,
      client_id: user.clientId,
      document,
      svg_path: `${root}.svg`,
      png_path: `${root}.png`,
      expires_at: expiresAt,
    }),
  });
  for (const [ext, body, mime] of [
    ["svg", rendered.svg, "image/svg+xml"],
    ["png", png, "image/png"],
  ] as const) {
    const response = await fetch(
      `${env.SUPABASE_URL}/storage/v1/object/mcp-previews/${root}.${ext}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": mime,
        },
        body,
        signal: AbortSignal.timeout(30000),
      },
    );
    await response.body?.cancel();
    if (!response.ok)
      throw new HttpError(502, "Preview storage failed. Retry rendering.");
  }
  return {
    previewId: id,
    expiresAt,
    width: rendered.width,
    height: rendered.height,
    png: rendered.png,
    svg: rendered.svg,
    routingIssues: [],
    downloads: {
      png: `${env.API_ORIGIN || env.APP_URL}/api/mcp/previews/${id}/png`,
      svg: `${env.API_ORIGIN || env.APP_URL}/api/mcp/previews/${id}/svg`,
    },
  };
}
