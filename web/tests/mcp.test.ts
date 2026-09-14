import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../worker/index";
import type { AppEnv } from "../worker/env";
import { applyEdits, documentDiff } from "../src/core/edits";
import { starter, presets } from "../src/core/presets";
import manifest from "../src/core/presets.manifest.json";
import { editDiagram, previewChange, validateDraft } from "../mcp/documents";
import { manifestSchema, submissionInput } from "../mcp/github";
import { authenticateMcp, mcpUrl } from "../mcp/auth";
import { browseCatalog, recordView } from "../worker/catalog";
const account = "11111111-1111-4111-8111-111111111111";
function env(): AppEnv {
  return {
    ENVIRONMENT: "development",
    APP_URL: "https://flow.example.com",
    API_ORIGIN: "https://flow.test.workers.dev",
    MCP_ENABLED: "true",
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_ANON_KEY: "public",
    SUPABASE_SERVICE_ROLE_KEY: "private",
    VIEW_HASH_KEY: "test-hmac-key",
    ASSETS: { fetch: vi.fn(), connect: vi.fn() } as Fetcher,
    BROWSER: {} as AppEnv["BROWSER"],
    EVENT_LIMIT: { limit: vi.fn().mockResolvedValue({ success: true }) },
    RESEARCH: {} as AppEnv["RESEARCH"],
    SLACK_SEND: {} as AppEnv["SLACK_SEND"],
    SLACK_CLIENT_ID: "",
    GEMINI_MODEL: "",
    OPENAI_MODEL: "",
    CLAUDE_MODEL: "",
  };
}
const token = (claims: object) =>
  `header.${btoa(JSON.stringify(claims))}.verified-by-supabase`;
const principal = {
  id: account,
  clientId: "test-client",
  email: "test@example.com",
  token: token({
    client_id: "test-client",
    aud: ["authenticated", "https://flow.test.workers.dev/mcp"],
  }),
};
async function rpcBody(response: Response) {
  const text = await response.text();
  return JSON.parse(
    text.startsWith("event:")
      ? text
          .split("\n")
          .find((line) => line.startsWith("data:"))!
          .slice(5)
      : text,
  );
}
afterEach(() => vi.unstubAllGlobals());
describe("stable-ID editing", () => {
  it("deletes a card and all its pipes atomically without mutating the input", () => {
    const changed = applyEdits(starter, [
      { op: "remove", entity: "cards", id: "play" },
    ]);
    expect(changed.cards.some((c) => c.id === "play")).toBe(false);
    expect(
      changed.edges.some((e) => e.from === "play" || e.to === "play"),
    ).toBe(false);
    expect(starter.cards.some((c) => c.id === "play")).toBe(true);
    expect(documentDiff(starter, changed).entities.cards.removed).toEqual([
      "play",
    ]);
  });
  it("validates the whole batch after stage moves and rejects unresolved references", () => {
    const next = applyEdits(starter, [
      {
        op: "put",
        entity: "stages",
        value: { id: "terminal", label: "Terminal" },
      },
      {
        op: "put",
        entity: "cards",
        value: { id: "mastery", stageId: "terminal" },
      },
    ]);
    expect(next.cards.find((c) => c.id === "mastery")?.stageId).toBe(
      "terminal",
    );
    expect(() =>
      applyEdits(starter, [{ op: "remove", entity: "stages", id: "play" }]),
    ).toThrow();
  });
  it("preserves explicit private visibility on replacement and returns a conflict on stale edits", async () => {
    const current = {
      id: starter.id,
      document: { ...starter, visibility: "private" },
      revision: 5,
      is_preset: false,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        Response.json(url.includes("mcp_allowed") ? true : [current]),
      ),
    );
    const draft = await previewChange(env(), principal, {
      documentId: starter.id,
      expectedRevision: 5,
      replacement: { ...starter, visibility: "public" },
    });
    expect(draft.document.visibility).toBe("private");
    await expect(
      previewChange(env(), principal, {
        documentId: starter.id,
        expectedRevision: 4,
        edits: [],
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("returns a matching receipt before recomputing edits against a newer document", async () => {
    const fetcher = vi.fn(async (url: string) =>
      Response.json(
        url.includes("mcp_allowed")
          ? true
          : { id: starter.id, document: starter, revision: 5 },
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    const saved = await editDiagram(
      env(),
      principal,
      { documentId: starter.id, expectedRevision: 4, edits: [] },
      "33333333-3333-4333-8333-333333333333",
    );
    expect(saved.revision).toBe(5);
    expect(fetcher.mock.calls.some(([url]) => url.includes("documents?"))).toBe(
      false,
    );
  });
  it("uses the shared semantic and routing validators for supplied JSON", () => {
    expect(validateDraft(starter).routingIssues).toEqual([]);
    expect(() =>
      validateDraft({
        ...starter,
        edges: [{ ...starter.edges[0], to: "missing" }],
      }),
    ).toThrow();
  });
});
describe("MCP transport and OAuth", () => {
  it("rejects a verified session with the wrong resource audience", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ id: account })),
    );
    await expect(
      authenticateMcp(
        new Request("https://flow.test.workers.dev/mcp", {
          headers: {
            Authorization: `Bearer ${token({ client_id: "x", aud: "other" })}`,
          },
        }),
        env(),
      ),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("exposes protected-resource metadata and a useful OAuth challenge", async () => {
    const environment = env();
    const metadata = await worker.fetch(
      new Request(
        "https://flow.test.workers.dev/.well-known/oauth-protected-resource",
      ),
      environment,
    );
    expect(await metadata.json()).toMatchObject({
      resource: mcpUrl(environment),
    });
    const response = await worker.fetch(
      new Request(mcpUrl(environment), { method: "POST" }),
      environment,
      {} as ExecutionContext,
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain(
      "oauth-protected-resource",
    );
  });
  it("serves a real MCP initialize and tools/list request over Streamable HTTP", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        Response.json(url.includes("/auth/v1/user") ? { id: account } : true),
      ),
    );
    const request = (body: object) =>
      new Request(mcpUrl(env()), {
        method: "POST",
        headers: {
          Host: new URL(mcpUrl(env())).host,
          Authorization: `Bearer ${principal.token}`,
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify(body),
      });
    const initialize = await worker.fetch(
      request({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "test", version: "1" },
        },
      }),
      env(),
      {} as ExecutionContext,
    );
    expect(initialize.status).toBe(200);
    expect(await rpcBody(initialize)).toMatchObject({
      result: { serverInfo: { name: "economy-flow" } },
    });
    const listed = await worker.fetch(
      request({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
      env(),
      {} as ExecutionContext,
    );
    const body = (await rpcBody(listed)) as {
      result: { tools: { name: string }[] };
    };
    expect(body.result.tools.map((t) => t.name)).toEqual(
      expect.arrayContaining([
        "read_diagram",
        "create_diagram",
        "edit_diagram",
        "render_diagram",
        "submit_preset",
      ]),
    );
  });
  it("allows browser preflight only from approved origins, including error responses", async () => {
    const yes = await worker.fetch(
      new Request("https://flow.test.workers.dev/api/config", {
        method: "OPTIONS",
        headers: { Origin: "https://flow.example.com" },
      }),
      env(),
    );
    expect(yes.headers.get("access-control-allow-origin")).toBe(
      "https://flow.example.com",
    );
    const no = await worker.fetch(
      new Request("https://flow.test.workers.dev/api/config", {
        method: "OPTIONS",
        headers: { Origin: "https://attacker.example" },
      }),
      env(),
    );
    expect(no.status).toBe(403);
    expect(no.headers.has("access-control-allow-origin")).toBe(false);
  });
});
describe("catalog and repository boundaries", () => {
  it("bundles exactly the manifest and rejects path traversal and duplicate entries", () => {
    expect(presets.map((p) => p.id)).toEqual(manifest.map((p) => p.id));
    expect(() =>
      manifestSchema.parse([{ id: "evil", file: "../secret.json" }]),
    ).toThrow();
    expect(() => manifestSchema.parse([manifest[0], manifest[0]])).toThrow();
    expect(() =>
      submissionInput.parse({
        operationId: crypto.randomUUID(),
        document: starter,
        file: "../../worker/index.ts",
        title: "x",
        attribution: "x",
      }),
    ).toThrow();
  });
  it("falls back to alphabetic bundled diagrams without fabricated counts", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const catalog = await browseCatalog(env(), {});
    expect(catalog.analyticsAvailable).toBe(false);
    expect(catalog.items.every((item) => item.views === null)).toBe(true);
    expect(catalog.items[0].title).toBe("Apex Legends");
  });
  it("hashes visitors before storage and does not count MCP reads", async () => {
    const fetcher = vi.fn(async (_url: string, _options?: RequestInit) =>
      Response.json(true),
    );
    vi.stubGlobal("fetch", fetcher);
    const visitorId = crypto.randomUUID();
    await recordView(
      env(),
      new Request("https://flow.test.workers.dev/api/catalog/views"),
      { itemId: `preset:${presets[0].id}`, visitorId },
    );
    const options = fetcher.mock.calls[0][1] as RequestInit;
    expect(options.body).not.toContain(visitorId);
    expect(JSON.parse(String(options.body)).p_visitor_hash).toMatch(
      /^[a-f0-9]{64}$/,
    );
    fetcher.mockImplementation(async () => Response.json({ id: account }));
    await expect(
      recordView(
        env(),
        new Request("https://flow.test.workers.dev/api/catalog/views", {
          headers: { Authorization: `Bearer ${principal.token}` },
        }),
        { itemId: `preset:${presets[0].id}`, visitorId },
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
});

it("accepts opaque Supabase authorization IDs and verifies their client before granting access", async () => {
  const { mcpAccountRoutes } = await import("../mcp/accounts");
  const authorizationId = "opaque_supabase-request-identifier";
  const fetcher = vi.fn(async (url: string) => {
    if (url.includes(`/oauth/authorizations/${authorizationId}`))
      return Response.json({ client: { id: "verified-client" } });
    return Response.json({});
  });
  vi.stubGlobal("fetch", fetcher);
  const response = await mcpAccountRoutes(
    new Request("https://flow.test.workers.dev/api/mcp/connections", {
      method: "PUT",
      body: JSON.stringify({
        authorizationId,
        canRead: true,
        canEdit: true,
        canSubmit: false,
      }),
    }),
    env(),
    { ...principal, token: token({ aud: "authenticated" }) },
    "/mcp/connections",
  );
  expect(response.status).toBe(200);
  const grant = fetcher.mock.calls.find(([url]) => url.includes("mcp_grants"));
  expect(grant).toBeDefined();
  const calls = fetcher.mock.calls as unknown as [string, RequestInit][];
  expect(
    JSON.parse(
      calls.find(([url]) => url.includes("mcp_grants"))![1].body as string,
    ).client_id,
  ).toBe("verified-client");
});
