import { z } from "zod";
import { presets } from "../src/core/presets";
import type { AppEnv } from "./env";
import { authenticate, cloudReady, HttpError, rest } from "./helpers";
import { checkReleaseReadiness } from "../src/core/conventions";
import { validateDocument } from "../src/core/document";

export const catalogQuery = z.object({
  search: z.string().max(200).default(""),
  source: z.enum(["all", "preset", "community"]).default("all"),
  sort: z.enum(["most_viewed", "newest", "name"]).default("most_viewed"),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(24),
});
export interface CatalogItem {
  id: string;
  source: "preset" | "community";
  source_id: string;
  title: string;
  description: string;
  author: string;
  category?: string;
  thumbnail_path: string | null;
  created_at: string;
  views: number | null;
}
export interface CatalogPage {
  items: CatalogItem[];
  total: number;
  analyticsAvailable: boolean;
}
const seedItems: CatalogItem[] = presets.map(({ id, document }) => ({
  id: `preset:${id}`,
  source: "preset",
  source_id: id,
  title: document.name,
  description: document.research?.summary || "",
  category: document.research?.category || "",
  author: "Game Economist Consulting",
  thumbnail_path: null,
  created_at: document.research?.checkedAt || "2026-09-13",
  views: null,
}));
export async function browseCatalog(
  env: AppEnv,
  input: unknown,
): Promise<CatalogPage> {
  const query = catalogQuery.parse(input);
  if (cloudReady(env)) {
    try {
      const page = await rest<CatalogPage>(env, "rpc/browse_catalog", {
        method: "POST",
        body: JSON.stringify({
          p_presets: seedItems.map((item) => ({ ...item, id: item.source_id })),
          p_search: query.search,
          p_source: query.source,
          p_sort: query.sort,
          p_offset: query.offset,
          p_limit: query.limit,
        }),
      });
      const communityIds = page.items
        .filter((item) => item.source === "community")
        .map((item) => item.source_id);
      if (!communityIds.length) return page;
      const snapshots = await rest<{ id: string; snapshot: unknown }[]>(
        env,
        `publications?id=in.(${communityIds.join(",")})&listed=eq.true&hidden=eq.false&select=id,snapshot`,
      );
      const ready = new Set(
        snapshots.flatMap((row) => {
          try {
            return checkReleaseReadiness(validateDocument(row.snapshot)).ready
              ? [row.id]
              : [];
          } catch {
            return [];
          }
        }),
      );
      const items = page.items.filter(
        (item) => item.source !== "community" || ready.has(item.source_id),
      );
      return {
        ...page,
        items,
        total: Math.max(0, page.total - (page.items.length - items.length)),
      };
    } catch {
      console.error(JSON.stringify({ event: "catalog_unavailable" }));
      // Fall through to bundled diagrams; no invented counts or partial popularity ranking.
    }
  }
  const items = seedItems
    .filter(
      (item) =>
        query.source !== "community" &&
        `${item.title} ${item.description} ${item.category || ""}`
          .toLowerCase()
          .includes(query.search.toLowerCase()),
    )
    .sort(
      (a, b) =>
        a.title.toLowerCase().localeCompare(b.title.toLowerCase(), "en") ||
        a.id.localeCompare(b.id),
    );
  return {
    items: items.slice(query.offset, query.offset + query.limit),
    total: items.length,
    analyticsAvailable: false,
  };
}

export const viewRequest = z
  .object({
    itemId: z
      .string()
      .regex(/^(preset:[a-zA-Z0-9_-]{1,160}|publication:[a-f0-9-]{36})$/),
    visitorId: z.string().uuid(),
  })
  .strict();
export async function recordView(
  env: AppEnv,
  request: Request,
  input: unknown,
) {
  const { itemId, visitorId } = viewRequest.parse(input);
  if (!cloudReady(env) || !env.VIEW_HASH_KEY)
    return { accepted: false, analyticsAvailable: false };
  if (
    itemId.startsWith("preset:") &&
    !presets.some((p) => `preset:${p.id}` === itemId)
  )
    throw new HttpError(404, "Preset not found.");
  const user = request.headers.has("Authorization")
    ? await authenticate(request, env)
    : null;
  const claims = user ? tokenClaims(user.token) : null;
  if (claims?.client_id)
    throw new HttpError(403, "MCP reads do not count as views.");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.VIEW_HASH_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(
      `${new Date().toISOString().slice(0, 10)}:${visitorId}`,
    ),
  );
  const hash = Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  const allowed = await env.EVENT_LIMIT.limit({
    key: `view:${request.headers.get("CF-Connecting-IP") || hash}`,
  });
  if (!allowed.success) throw new HttpError(429, "View limit reached.");
  const accepted = await rest<boolean>(env, "rpc/record_catalog_view", {
    method: "POST",
    body: JSON.stringify({
      p_item_id: itemId,
      p_visitor_hash: hash,
      p_owner_id: user?.id || null,
    }),
  });
  return { accepted, analyticsAvailable: true };
}
// Only call after authenticate() has verified this bearer token with Supabase.
export function tokenClaims(token: string): {
  client_id?: string;
  aud?: string | string[];
} {
  if (token.split(".").length !== 3) return {};
  try {
    return JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
  } catch {
    throw new HttpError(401, "Invalid access token.");
  }
}
