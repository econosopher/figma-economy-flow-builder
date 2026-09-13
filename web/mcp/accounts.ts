import { z } from "zod";
import type { AppEnv } from "../worker/env";
import {
  bodyJson,
  HttpError,
  json,
  limitedExternalJson,
  rest,
  type Identity,
} from "../worker/helpers";
import { requireCapability, requireWebsiteSession } from "./auth";
import { tokenClaims } from "../worker/catalog";

export async function mcpAccountRoutes(
  request: Request,
  env: AppEnv,
  user: Identity,
  path: string,
): Promise<Response> {
  const artifact = path.match(/^\/mcp\/previews\/([a-f0-9-]{36})\/(svg|png)$/);
  if (artifact && request.method === "GET") {
    await requireCapability(env, user, "read");
    const rows = await rest<
      { svg_path: string; png_path: string; client_id: string }[]
    >(
      env,
      `mcp_previews?id=eq.${artifact[1]}&owner_id=eq.${user.id}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}`,
    );
    if (
      !rows[0] ||
      (tokenClaims(user.token).client_id &&
        rows[0].client_id !== tokenClaims(user.token).client_id)
    )
      throw new HttpError(404, "Preview expired or unavailable.");
    const key = artifact[2] === "png" ? rows[0].png_path : rows[0].svg_path;
    const response = await fetch(
      `${env.SUPABASE_URL}/storage/v1/object/mcp-previews/${key}`,
      {
        headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok) {
      await response.body?.cancel();
      throw new HttpError(404, "Preview unavailable.");
    }
    return new Response(response.body, {
      headers: {
        "Content-Type": artifact[2] === "png" ? "image/png" : "image/svg+xml",
        "Content-Disposition": `attachment; filename="economy.${artifact[2]}"`,
        "Cache-Control": "no-store",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; font-src data:",
      },
    });
  }
  requireWebsiteSession(user);
  if (path === "/mcp/connections" && request.method === "GET")
    return json(
      await rest(env, `mcp_grants?owner_id=eq.${user.id}`, {}, user.token),
    );
  if (path === "/mcp/connections" && request.method === "PUT") {
    const input = z
      .object({
        authorizationId: z.string().uuid(),
        canRead: z.literal(true),
        canEdit: z.boolean(),
        canSubmit: z.boolean(),
      })
      .strict()
      .parse(await bodyJson(request));
    const response = await fetch(
      `${env.SUPABASE_URL}/auth/v1/oauth/authorizations/${input.authorizationId}`,
      {
        headers: {
          apikey: String(env.SUPABASE_ANON_KEY),
          Authorization: `Bearer ${user.token}`,
        },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok)
      throw new HttpError(
        400,
        "Authorization request expired. Reconnect your MCP client.",
      );
    const details = z
      .object({ client: z.object({ id: z.string() }) })
      .parse(await limitedExternalJson(response));
    await rest(
      env,
      "mcp_grants?on_conflict=owner_id,client_id",
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({
          owner_id: user.id,
          client_id: details.client.id,
          can_read: true,
          can_edit: input.canEdit,
          can_submit: input.canSubmit,
          revoked_at: null,
        }),
      },
      user.token,
    );
    return json({ saved: true });
  }
  if (path === "/mcp/connections" && request.method === "DELETE") {
    const { clientId } = z
      .object({ clientId: z.string().max(200) })
      .parse(await bodyJson(request));
    await rest(
      env,
      `mcp_grants?owner_id=eq.${user.id}&client_id=eq.${encodeURIComponent(clientId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ revoked_at: new Date().toISOString() }),
      },
      user.token,
    );
    return json({ revoked: true });
  }
  throw new HttpError(404, "Not found.");
}
export async function cleanupMcp(env: AppEnv) {
  const now = encodeURIComponent(new Date().toISOString());
  const expired = await rest<
    { id: string; svg_path: string; png_path: string }[]
  >(env, `mcp_previews?expires_at=lte.${now}&limit=100`);
  for (const item of expired) {
    const response = await fetch(
      `${env.SUPABASE_URL}/storage/v1/object/mcp-previews`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prefixes: [item.svg_path, item.png_path].filter(Boolean),
        }),
        signal: AbortSignal.timeout(15000),
      },
    );
    await response.body?.cancel();
    if (response.ok)
      await rest(env, `mcp_previews?id=eq.${item.id}`, { method: "DELETE" });
  }
  await rest(
    env,
    `catalog_views?day=lt.${new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10)}`,
    { method: "DELETE" },
  );
}
