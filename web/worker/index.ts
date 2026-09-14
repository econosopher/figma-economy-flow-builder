import { browseCatalog, recordView } from "./catalog";
import { saveDocument, saveInput } from "./documents";
import { handleMcp } from "../mcp/server";
import {
  protectedResource,
  mcpUrl,
  requireWebsiteSession,
  requireCapability,
} from "../mcp/auth";
import { mcpAccountRoutes, cleanupMcp } from "../mcp/accounts";
import { z } from "zod";
import { validateDocument, settingsSchema } from "../src/core/document";
import { assertReleaseReady } from "../src/core/conventions";
import type { AppEnv } from "./env";
import {
  authenticate,
  bodyJson,
  boundedBytes,
  cloudReady,
  encrypt,
  HttpError,
  json,
  randomToken,
  rateLimit,
  requireSameOrigin,
  rest,
  safeId,
  sha256,
} from "./helpers";
import {
  installation,
  slackCall,
  slackOAuthStart,
  slackOAuthCallback,
  uploadSlack,
  removeSlackPreview,
} from "./slack";
export { ResearchWorkflow } from "./research";
export { SlackSendWorkflow } from "./slack";
const mutate = { method: "POST", headers: { Prefer: "return=representation" } };
const researchRequest = z.object({
  provider: z.enum(["gemini", "openai", "claude"]),
  gameName: z.string().trim().min(1).max(200),
  depth: z.number().int().min(1).max(3),
  apiKey: z.string().min(20).max(1000),
});
function releaseDocument(input: unknown, status = 400) {
  try {
    return assertReleaseReady(validateDocument(input));
  } catch (error) {
    throw new HttpError(
      status,
      error instanceof Error ? error.message : "Diagram is not release ready.",
    );
  }
}
async function handle(request: Request, env: AppEnv): Promise<Response> {
  const url = new URL(request.url),
    path = url.pathname.slice(4),
    method = request.method;
  if (method !== "GET" && method !== "HEAD") requireSameOrigin(request, env);
  if (path === "/events" && method === "POST") {
    const allowed = await env.EVENT_LIMIT.limit({
      key: request.headers.get("CF-Connecting-IP") || "local",
    });
    if (!allowed.success) return json({ accepted: false }, 429);
    const event = z
      .object({
        kind: z.enum([
          "save_failed",
          "route_failed",
          "export_failed",
          "layout_failed",
        ]),
        cards: z.number().int().min(0).max(200).optional(),
        edges: z.number().int().min(0).max(600).optional(),
      })
      .strict()
      .parse(await bodyJson(request, 1024));
    console.error(
      JSON.stringify({
        event: `client_${event.kind}`,
        cards: event.cards,
        edges: event.edges,
      }),
    );
    return json({ accepted: true }, 202);
  }
  if (path === "/config")
    return json({
      cloud: cloudReady(env),
      apiOrigin: env.API_ORIGIN || "",
      mcp: env.MCP_ENABLED === "true" && cloudReady(env),
      mcpUrl: mcpUrl(env),
      supabaseUrl: env.SUPABASE_URL,
      supabaseAnonKey: env.SUPABASE_ANON_KEY,
      slack:
        cloudReady(env) &&
        !!env.SLACK_CLIENT_ID &&
        !!env.SLACK_CLIENT_SECRET &&
        !!env.CREDENTIAL_ENCRYPTION_KEY,
      research: cloudReady(env) && !!env.CREDENTIAL_ENCRYPTION_KEY,
      environment: env.ENVIRONMENT,
    });
  if (path === "/health")
    return json({
      status: "ok",
      environment: env.ENVIRONMENT,
      cloudConfigured: cloudReady(env),
    });
  if (path === "/catalog" && method === "GET")
    return json(await browseCatalog(env, Object.fromEntries(url.searchParams)));
  if (path === "/catalog/views" && method === "POST")
    return json(await recordView(env, request, await bodyJson(request, 2048)));
  if (path === "/gallery" && method === "GET") {
    if (!cloudReady(env)) return json({ items: [], configured: false });
    const rows = await rest<
      Array<{
        id: string;
        title: string;
        description: string;
        author: string;
        thumbnail_path: string | null;
        created_at: string;
        snapshot: unknown;
      }>
    >(
      env,
      "publications?hidden=eq.false&listed=eq.true&select=id,title,description,author,thumbnail_path,created_at,snapshot&order=created_at.desc&limit=50",
    );
    const items = rows.flatMap(({ snapshot, ...item }) => {
      try {
        releaseDocument(snapshot, 409);
        return [item];
      } catch {
        return [];
      }
    });
    return json({ items });
  }
  const thumbnailMatch = path.match(/^\/gallery\/([a-f0-9-]{36})\/thumbnail$/);
  if (thumbnailMatch && method === "GET") {
    const rows = await rest<{ owner_id: string; snapshot: unknown }[]>(
      env,
      `publications?id=eq.${thumbnailMatch[1]}&hidden=eq.false&listed=eq.true&select=owner_id,snapshot`,
    );
    if (!rows[0]) throw new HttpError(404, "Thumbnail unavailable.");
    try {
      releaseDocument(rows[0].snapshot, 409);
    } catch {
      throw new HttpError(404, "Thumbnail unavailable.");
    }
    const response = await fetch(
      `${env.SUPABASE_URL}/storage/v1/object/gallery-thumbnails/${rows[0].owner_id}/${thumbnailMatch[1]}.png`,
      {
        headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok) {
      await response.body?.cancel();
      throw new HttpError(404, "Thumbnail unavailable.");
    }
    return new Response(response.body, {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    });
  }
  const galleryMatch = path.match(/^\/gallery\/([a-f0-9-]{36})$/);
  if (galleryMatch && method === "GET") {
    const rows = await rest<Array<{ snapshot: unknown } & Record<string, unknown>>>(
      env,
      `publications?id=eq.${galleryMatch[1]}&hidden=eq.false&listed=eq.true`,
    );
    if (!rows[0]) throw new HttpError(404, "This publication is unavailable.");
    releaseDocument(rows[0].snapshot, 409);
    return json(rows[0]);
  }
  const shareMatch = path.match(/^\/shared\/([a-f0-9]{64})$/);
  if (shareMatch && method === "GET") {
    const rows = await rest<{ snapshot: unknown }[]>(
      env,
      `share_links?token_hash=eq.${await sha256(shareMatch[1])}&select=snapshot`,
    );
    if (!rows[0])
      throw new HttpError(404, "This link has expired or been revoked.");
    releaseDocument(rows[0].snapshot, 409);
    return json(rows[0]);
  }
  if (path === "/slack/callback" && method === "GET")
    return slackOAuthCallback(request, env);
  const user = await authenticate(request, env);
  if (path.startsWith("/mcp/"))
    return mcpAccountRoutes(request, env, user, path);
  requireWebsiteSession(user);
  if (path === "/documents" && method === "GET")
    return json(
      await rest(
        env,
        `documents?owner_id=eq.${user.id}&select=id,document,revision,is_preset,updated_at&order=updated_at.desc&limit=100`,
        {},
        user.token,
      ),
    );
  const documentMatch = path.match(/^\/documents\/([^/]+)$/);
  if (documentMatch) {
    const id = safeId(documentMatch[1]);
    if (method === "GET") {
      const rows = await rest<unknown[]>(
        env,
        `documents?id=eq.${id}`,
        {},
        user.token,
      );
      if (!rows[0]) throw new HttpError(404, "Diagram not found.");
      return json(rows[0]);
    }
    if (method === "PUT") {
      const payload = saveInput.parse(await bodyJson(request));
      if (
        typeof payload.document !== "object" ||
        payload.document === null ||
        !("id" in payload.document) ||
        payload.document.id !== documentMatch[1]
      )
        throw new HttpError(400, "Diagram ID mismatch.");
      return json(
        await saveDocument(env, user, { ...payload, operationId: undefined }),
      );
    }

    if (method === "DELETE") {
      await rest(
        env,
        `documents?id=eq.${id}`,
        { method: "DELETE" },
        user.token,
      );
      return json({ deleted: true });
    }
  }
  if (path === "/settings") {
    if (method === "GET") {
      const rows = await rest<{ settings: unknown }[]>(
        env,
        `user_settings?owner_id=eq.${user.id}`,
        {},
        user.token,
      );
      return json(rows[0]?.settings || null);
    }
    if (method === "PUT") {
      const settings = settingsSchema.parse(await bodyJson(request));
      await rest(
        env,
        "user_settings?on_conflict=owner_id",
        {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates" },
          body: JSON.stringify({
            owner_id: user.id,
            settings,
            updated_at: new Date().toISOString(),
          }),
        },
        user.token,
      );
      return json(settings);
    }
  }
  if (path === "/shares") {
    if (method === "GET")
      return json(
        await rest(
          env,
          `share_links?owner_id=eq.${user.id}&select=id,document_id,created_at`,
          {},
          user.token,
        ),
      );
    if (method === "POST") {
      const document = releaseDocument(await bodyJson(request));
      await rateLimit(env, user.id, "share_links", 30);
      const token = randomToken();
      const rows = await rest<{ id: string }[]>(env, "share_links", {
        ...mutate,
        body: JSON.stringify({
          owner_id: user.id,
          document_id: document.id,
          token_hash: await sha256(token),
          snapshot: document,
        }),
      });
      return json(
        { id: rows[0].id, url: `${env.APP_URL}/?share=${token}` },
        201,
      );
    }
  }
  if (path.startsWith("/shares/") && method === "DELETE") {
    await rest(
      env,
      `share_links?id=eq.${safeId(path.split("/")[2])}`,
      { method: "DELETE" },
      user.token,
    );
    return json({ revoked: true });
  }
  if (path === "/publications" && method === "GET")
    return json(
      await rest(
        env,
        `publications?owner_id=eq.${user.id}&select=id,document_id,title,hidden,thumbnail_path,created_at`,
        {},
        user.token,
      ),
    );
  if (path === "/publications" && method === "POST") {
    const payload = z
      .object({
        document: z.unknown(),
        title: z.string().trim().min(1).max(200),
        description: z.string().max(2000),
        author: z.string().trim().min(1).max(100),
      })
      .parse(await bodyJson(request));
    const document = releaseDocument(payload.document);
    if (document.visibility !== undefined)
      throw new HttpError(
        400,
        "Use the diagram lock and account save to change its publication.",
      );
    const existing = await rest<{ id: string; hidden: boolean }[]>(
      env,
      `publications?owner_id=eq.${user.id}&document_id=eq.${safeId(document.id)}&select=id,hidden`,
    );
    if (existing[0]?.hidden)
      throw new HttpError(
        403,
        "This publication has been removed by a moderator.",
      );
    await rateLimit(env, user.id, "publications", 20);
    const rows = await rest<{ id: string }[]>(
      env,
      "publications?on_conflict=owner_id,document_id",
      {
        ...mutate,
        headers: {
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify({
          owner_id: user.id,
          document_id: document.id,
          title: payload.title,
          description: payload.description,
          author: payload.author,
          snapshot: document,
          updated_at: new Date().toISOString(),
        }),
      },
    );
    return json(
      { id: rows[0].id, url: `${env.APP_URL}/?gallery=${rows[0].id}` },
      201,
    );
  }
  const publicationMatch = path.match(
    /^\/publications\/([a-f0-9-]{36})(\/thumbnail)?$/,
  );
  if (publicationMatch) {
    const id = publicationMatch[1];
    const rows = await rest<{ id: string; thumbnail_path?: string }[]>(
      env,
      `publications?id=eq.${id}&owner_id=eq.${user.id}`,
    );
    if (!rows[0]) throw new HttpError(404, "Publication not found.");
    if (method === "PUT" && publicationMatch[2]) {
      const bytes = await boundedBytes(request.body, 2_097_152);
      if (
        bytes[0] !== 137 ||
        bytes[1] !== 80 ||
        bytes[2] !== 78 ||
        bytes[3] !== 71
      )
        throw new HttpError(400, "Expected a PNG thumbnail.");
      const object = `${user.id}/${id}.png`;
      const response = await fetch(
        `${env.SUPABASE_URL}/storage/v1/object/gallery-thumbnails/${object}`,
        {
          method: "POST",
          headers: {
            apikey: String(env.SUPABASE_ANON_KEY),
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "image/png",
            "x-upsert": "true",
          },
          body: new Uint8Array(bytes),
        },
      );
      await response.body?.cancel();
      if (!response.ok)
        throw new HttpError(
          502,
          "Publication saved, but thumbnail upload failed. Retry the thumbnail.",
        );
      const thumbnail = `${env.APP_URL}/api/gallery/${id}/thumbnail`;
      await rest(env, `publications?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({ thumbnail_path: thumbnail }),
      });
      return json({ thumbnail });
    }
    if (method === "DELETE") {
      await rest(env, `publications?id=eq.${id}&owner_id=eq.${user.id}`, {
        method: "DELETE",
      });
      const response = await fetch(
        `${env.SUPABASE_URL}/storage/v1/object/gallery-thumbnails`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ prefixes: [`${user.id}/${id}.png`] }),
        },
      );
      await response.body?.cancel();
      return json({ unpublished: true });
    }
  }
  const reportMatch = path.match(/^\/gallery\/([a-f0-9-]{36})\/report$/);
  if (reportMatch && method === "POST") {
    const data = z
      .object({ reason: z.string().trim().min(1).max(2000) })
      .parse(await bodyJson(request));
    await rest(
      env,
      "reports",
      {
        method: "POST",
        body: JSON.stringify({
          publication_id: reportMatch[1],
          owner_id: user.id,
          reason: data.reason,
        }),
      },
      user.token,
    );
    return json({ reported: true });
  }
  if (path === "/moderation/reports" && method === "GET") {
    if (!env.ADMIN_USER_IDS?.split(",").includes(user.id))
      throw new HttpError(403, "Administrator access required.");
    return json(
      await rest(
        env,
        "reports?select=*,publications(title)&order=created_at.desc&limit=100",
      ),
    );
  }
  const moderateMatch = path.match(/^\/moderation\/([a-f0-9-]{36})$/);
  if (moderateMatch && method === "DELETE") {
    if (!env.ADMIN_USER_IDS?.split(",").includes(user.id))
      throw new HttpError(403, "Administrator access required.");
    await rest(env, `publications?id=eq.${moderateMatch[1]}`, {
      method: "PATCH",
      body: JSON.stringify({ hidden: true }),
    });
    return json({ removed: true });
  }
  if (path === "/slack/installations" && method === "GET")
    return json(
      await rest(
        env,
        `slack_installations?owner_id=eq.${user.id}&select=id,team_id,team_name,bot_name,scopes`,
      ),
    );
  if (path === "/slack/connect" && method === "POST")
    return slackOAuthStart(env, user);
  const installationMatch = path.match(
    /^\/slack\/installations\/([a-f0-9-]{36})(\/channels)?$/,
  );
  if (installationMatch) {
    if (method === "DELETE" && !installationMatch[2]) {
      await rest(
        env,
        `slack_installations?id=eq.${installationMatch[1]}&owner_id=eq.${user.id}`,
        { method: "DELETE" },
      );
      return json({ disconnected: true });
    }
    if (method === "GET" && installationMatch[2]) {
      const { token } = await installation(env, installationMatch[1], user.id);
      const data = await slackCall(token, "conversations.list", {
        types: "public_channel,private_channel",
        exclude_archived: true,
        limit: 200,
        cursor: url.searchParams.get("cursor") || "",
      });
      return json({
        channels: data.channels
          .filter((c: { is_member: boolean }) => c.is_member)
          .map((c: { id: string; name: string }) => ({
            id: c.id,
            name: c.name,
          })),
        cursor: data.response_metadata?.next_cursor || "",
      });
    }
  }
  if (path === "/slack/uploads" && method === "POST")
    return uploadSlack(request, env, user);
  const operationMatch = path.match(/^\/slack\/uploads\/([a-f0-9-]{36})$/);
  if (operationMatch && method === "GET") {
    const rows = await rest<unknown[]>(
      env,
      `slack_operations?id=eq.${operationMatch[1]}&owner_id=eq.${user.id}&select=status,file_id,error`,
    );
    if (!rows[0]) throw new HttpError(404, "Send operation not found.");
    return json(rows[0]);
  }
  if (path === "/research" && method === "POST") {
    if (!env.CREDENTIAL_ENCRYPTION_KEY)
      throw new HttpError(503, "Research is not configured yet.");
    const data = researchRequest.parse(await bodyJson(request, 10000));
    await rateLimit(env, user.id, "research_jobs", 10);
    const id = crypto.randomUUID();
    const credential = await encrypt(data.apiKey, env, id);
    await rest(env, "research_jobs", {
      method: "POST",
      body: JSON.stringify({
        id,
        owner_id: user.id,
        provider: data.provider,
        game_name: data.gameName,
        depth: data.depth,
      }),
    });
    try {
      await rest(env, "job_credentials", {
        method: "POST",
        body: JSON.stringify({ job_id: id, credential }),
      });
      await env.RESEARCH.create({ id, params: { jobId: id } });
    } catch {
      await rest(env, `job_credentials?job_id=eq.${id}`, { method: "DELETE" });
      await rest(env, `research_jobs?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "failed",
          error: "Could not start the research job.",
        }),
      });
      throw new HttpError(502, "Could not start research.");
    }
    return json({ id, status: "queued" }, 202);
  }
  const researchMatch = path.match(/^\/research\/([a-f0-9-]{36})$/);
  if (researchMatch) {
    const id = researchMatch[1];
    const rows = await rest<{ status: string }[]>(
      env,
      `research_jobs?id=eq.${id}&owner_id=eq.${user.id}`,
    );
    if (!rows[0]) throw new HttpError(404, "Research job not found.");
    if (method === "GET") return json(rows[0]);
    if (method === "DELETE") {
      if (!["completed", "failed", "cancelled"].includes(rows[0].status)) {
        await rest(env, `research_jobs?id=eq.${id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "cancelled" }),
        });
        await rest(env, `job_credentials?job_id=eq.${id}`, {
          method: "DELETE",
        });
        await (await env.RESEARCH.get(id)).terminate();
      }
      return json({ cancelled: true });
    }
  }
  throw new HttpError(404, "Not found.");
}
export default {
  async fetch(
    request: Request,
    env: AppEnv,
    ctx?: ExecutionContext,
  ): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    if (
      !pathname.startsWith("/api/") &&
      pathname !== "/mcp" &&
      !pathname.startsWith("/.well-known/")
    )
      return env.ASSETS.fetch(request);
    const cors = (response: Response) => {
      const origin = request.headers.get("Origin");
      if (
        origin &&
        [env.APP_URL, env.API_ORIGIN, new URL(request.url).origin].includes(
          origin,
        )
      ) {
        response.headers.set("Access-Control-Allow-Origin", origin);
        response.headers.set("Vary", "Origin");
        response.headers.set(
          "Access-Control-Allow-Methods",
          "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        );
        response.headers.set(
          "Access-Control-Allow-Headers",
          "Authorization,Content-Type,MCP-Protocol-Version,Mcp-Session-Id",
        );
        response.headers.set(
          "Access-Control-Expose-Headers",
          "WWW-Authenticate,Mcp-Session-Id",
        );
      }
      return response;
    };
    try {
      if (request.method === "OPTIONS") {
        requireSameOrigin(request, env);
        return cors(new Response(null, { status: 204 }));
      }
      let response: Response;
      if (pathname.startsWith("/.well-known/oauth-protected-resource"))
        response = json(protectedResource(env));
      else if (pathname === "/mcp") {
        requireSameOrigin(request, env);
        if (!ctx) throw new HttpError(503, "MCP runtime unavailable.");
        response = await handleMcp(request, env, ctx);
      } else response = await handle(request, env);
      response.headers.set("Cache-Control", "no-store");
      response.headers.set("X-Content-Type-Options", "nosniff");
      return cors(response);
    } catch (error) {
      const status =
        error instanceof HttpError
          ? error.status
          : error instanceof z.ZodError
            ? 400
            : 500;
      const message =
        error instanceof HttpError
          ? error.message
          : error instanceof z.ZodError
            ? error.issues
                .map((i) => `${i.path.join(".")}: ${i.message}`)
                .join("; ")
            : "The request could not be completed.";
      if (status >= 500)
        console.error(
          JSON.stringify({
            event: "api_error",
            path: new URL(request.url).pathname,
            status,
          }),
        );
      return cors(
        json({ error: message }, status, {
          "Cache-Control": "no-store",
          ...(pathname === "/mcp" && status === 401
            ? {
                "WWW-Authenticate": `Bearer resource_metadata="${env.API_ORIGIN || env.APP_URL}/.well-known/oauth-protected-resource"`,
              }
            : {}),
        }),
      );
    }
  },
  async scheduled(_event: ScheduledController, env: AppEnv) {
    if (!cloudReady(env)) return;
    const now = encodeURIComponent(new Date().toISOString());
    await rest(env, `job_credentials?expires_at=lt.${now}`, {
      method: "DELETE",
    });
    await rest(env, `oauth_states?expires_at=lt.${now}`, { method: "DELETE" });
    await rest(
      env,
      `research_jobs?expires_at=lt.${now}&status=in.(queued,researching,building)`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status: "failed",
          error: "Research expired. Start a new job to try again.",
        }),
      },
    );
    const expired = await rest<
      { id: string; owner_id: string; status: string }[]
    >(
      env,
      `slack_operations?preview_removed=eq.false&created_at=lt.${encodeURIComponent(new Date(Date.now() - 3600000).toISOString())}&limit=100`,
    );
    for (const item of expired) {
      await removeSlackPreview(env, item.owner_id, item.id);
      await rest(env, `slack_operations?id=eq.${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          preview_removed: true,
          payload: null,
          ...(["queued", "uploading", "completing"].includes(item.status)
            ? {
                status: item.status === "completing" ? "uncertain" : "failed",
                error: "The send expired. Check Slack before a new send.",
              }
            : {}),
        }),
      });
    }
    try {
      await cleanupMcp(env);
    } catch {
      console.error(JSON.stringify({ event: "mcp_cleanup_failed" }));
    }
    console.log(
      JSON.stringify({
        event: "expired_credentials_removed",
        previews: expired.length,
      }),
    );
  },
} satisfies ExportedHandler<AppEnv>;
