import { describe, it, expect, vi, afterEach } from "vitest";
import worker from "../worker/index";
import { encrypt, decrypt, bodyJson, HttpError } from "../worker/helpers";
import { parseResearch, providerCall } from "../worker/research";
import type { AppEnv } from "../worker/env";
import { blankDocument } from "../src/core/document";
function environment(): AppEnv {
  return {
    BROWSER: {} as AppEnv["BROWSER"],
    EVENT_LIMIT: { limit: vi.fn().mockResolvedValue({ success: true }) },
    ENVIRONMENT: "development",
    APP_URL: "https://flow.example.com",
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_ANON_KEY: "public-key",
    SUPABASE_SERVICE_ROLE_KEY: "server-only",
    CREDENTIAL_ENCRYPTION_KEY: btoa("x".repeat(32)),
    SLACK_CLIENT_ID: "",
    GEMINI_MODEL: "gemini-3.5-flash",
    OPENAI_MODEL: "gpt-5-mini",
    CLAUDE_MODEL: "claude-sonnet-5",
    ASSETS: { fetch: vi.fn(), connect: vi.fn() } as Fetcher,
    SLACK_SEND: {
      create: vi.fn(),
      get: vi.fn(),
      createBatch: vi.fn(),
      deleteBatch: vi.fn(),
    } as AppEnv["SLACK_SEND"],
    RESEARCH: {
      create: vi.fn(),
      get: vi.fn(),
      createBatch: vi.fn(),
      deleteBatch: vi.fn(),
    } as AppEnv["RESEARCH"],
  };
}
const user = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "test@example.com",
};
afterEach(() => vi.unstubAllGlobals());
describe("API boundaries", () => {
  it("removes a cancelled job credential before terminating the workflow", async () => {
    const env = environment();
    const terminate = vi.fn().mockResolvedValue(undefined);
    vi.mocked(env.RESEARCH.get).mockResolvedValue({
      terminate,
      id: "test",
      pause: vi.fn(),
      resume: vi.fn(),
      restart: vi.fn(),
      delete: vi.fn(),
      status: vi.fn(),
      sendEvent: vi.fn(),
    });
    const mock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(user))
      .mockResolvedValueOnce(Response.json([{ status: "researching" }]))
      .mockResolvedValue(Response.json(null));
    vi.stubGlobal("fetch", mock);
    const id = "33333333-3333-4333-8333-333333333333";
    const response = await worker.fetch(
      new Request(`https://flow.example.com/api/research/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: "Bearer session",
          Origin: "https://flow.example.com",
        },
      }),
      env,
    );
    expect(response.status).toBe(200);
    expect(
      mock.mock.calls.some(
        (c) =>
          String(c[0]).includes("job_credentials") && c[1]?.method === "DELETE",
      ),
    ).toBe(true);
    expect(terminate).toHaveBeenCalledOnce();
  });

  it("does not leak server credentials in public configuration", async () => {
    const response = await worker.fetch(
      new Request("https://flow.example.com/api/config"),
      environment(),
    );
    const text = await response.text();
    expect(text).not.toContain("server-only");
    expect(text).not.toContain(btoa("x".repeat(32)));
    expect(JSON.parse(text).cloud).toBe(true);
  });
  it("requires authentication for private documents", async () => {
    const mock = vi.fn();
    vi.stubGlobal("fetch", mock);
    const r = await worker.fetch(
      new Request("https://flow.example.com/api/documents"),
      environment(),
    );
    expect(r.status).toBe(401);
    expect(mock).not.toHaveBeenCalled();
  });
  it("uses the user token and optimistic revision for document saves", async () => {
    const document = blankDocument();
    const mock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(user))
      .mockResolvedValueOnce(Response.json({ document, revision: 3 }));
    vi.stubGlobal("fetch", mock);
    const r = await worker.fetch(
      new Request(`https://flow.example.com/api/documents/${document.id}`, {
        method: "PUT",
        headers: {
          Authorization: "Bearer user-session",
          Origin: "https://flow.example.com",
        },
        body: JSON.stringify({ document, expectedRevision: 2 }),
      }),
      environment(),
    );
    expect(r.status).toBe(200);
    const call = mock.mock.calls[1];
    expect(call[0]).toContain("rpc/save_document");
    expect(call[1].headers.get("Authorization")).toBe("Bearer user-session");
    expect(JSON.parse(call[1].body).p_expected_revision).toBe(2);
  });
  it("rejects foreign-origin mutations before using credentials", async () => {
    const mock = vi.fn();
    vi.stubGlobal("fetch", mock);
    const r = await worker.fetch(
      new Request("https://flow.example.com/api/shares", {
        method: "POST",
        headers: { Origin: "https://attacker.example" },
      }),
      environment(),
    );
    expect(r.status).toBe(403);
    expect(mock).not.toHaveBeenCalled();
  });
  it("maps stale revisions to a conflict instead of overwriting", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json(user))
        .mockResolvedValueOnce(
          Response.json({ code: "40001" }, { status: 400 }),
        ),
    );
    const d = blankDocument();
    const r = await worker.fetch(
      new Request(`https://flow.example.com/api/documents/${d.id}`, {
        method: "PUT",
        headers: { Authorization: "Bearer user-session" },
        body: JSON.stringify({ document: d, expectedRevision: 2 }),
      }),
      environment(),
    );
    expect(r.status).toBe(409);
  });
  it("returns not found for a revoked snapshot, with no fallback content", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([])));
    const r = await worker.fetch(
      new Request(`https://flow.example.com/api/shared/${"a".repeat(64)}`),
      environment(),
    );
    expect(r.status).toBe(404);
  });
  it("encrypts credentials with job-specific authenticated context", async () => {
    const env = environment();
    const ciphertext = await encrypt("provider-secret", env, "job-a");
    expect(ciphertext).not.toContain("provider-secret");
    expect(await decrypt(ciphertext, env, "job-a")).toBe("provider-secret");
    await expect(decrypt(ciphertext, env, "job-b")).rejects.toThrow();
  });
  it("rejects oversized bodies before JSON parsing", async () => {
    await expect(
      bodyJson(
        new Request("https://test", { method: "POST", body: "x".repeat(100) }),
        10,
      ),
    ).rejects.toBeInstanceOf(HttpError);
  });
  it("rejects malformed or invented research graphs", () => {
    expect(() => parseResearch("not json")).toThrow();
    expect(() => parseResearch('{"schemaVersion":3}')).toThrow();
  });
  it("sends the supplied provider key and never falls back to a GEC key", async () => {
    const mock = vi.fn().mockResolvedValue(new Response("", { status: 401 }));
    vi.stubGlobal("fetch", mock);
    const job = {
      id: "job",
      owner_id: user.id,
      provider: "openai" as const,
      game_name: "Test",
      depth: 1,
      status: "researching",
      progress: 1,
      expires_at: "",
    };
    await expect(
      providerCall(environment(), job, "user-key", "research", true),
    ).rejects.toThrow("rejected");
    expect(mock.mock.calls[0][1].headers.Authorization).toBe("Bearer user-key");
    expect(mock).toHaveBeenCalledTimes(1);
  });
});
