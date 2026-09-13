import { afterEach, describe, it, expect, vi } from "vitest";
import { previewSubmission, submitPreset } from "../mcp/github";
import { starter } from "../src/core/presets";
import { documentDiff } from "../src/core/edits";
import type { AppEnv } from "../worker/env";
const user = {
  id: "11111111-1111-4111-8111-111111111111",
  clientId: "client",
  token: "verified",
  email: "user@example.com",
};
const id = "22222222-2222-4222-8222-222222222222";
const environment = {
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_ANON_KEY: "public",
  SUPABASE_SERVICE_ROLE_KEY: "server",
  GITHUB_APP_ID: "1",
  GITHUB_INSTALLATION_ID: "2",
};
afterEach(() => vi.unstubAllGlobals());
describe("GitHub preset submissions", () => {
  it("refuses private submissions before reading GitHub", async () => {
    const fetcher = vi.fn(async (url: string) =>
      Response.json(url.includes("mcp_allowed") ? true : []),
    );
    vi.stubGlobal("fetch", fetcher);
    await expect(
      previewSubmission(environment as AppEnv, user, {
        operationId: id,
        document: { ...starter, visibility: "private" },
        file: "new.json",
        title: "New preset",
        attribution: "Example",
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(
      fetcher.mock.calls.every(([url]) =>
        url.startsWith(environment.SUPABASE_URL),
      ),
    ).toBe(true);
  });
  it("creates only JSON and manifest changes on a new branch and reconciles an uncertain PR response", async () => {
    const pair = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"],
    );
    const key = btoa(
      String.fromCharCode(
        ...new Uint8Array(
          await crypto.subtle.exportKey("pkcs8", pair.privateKey),
        ),
      ),
    );
    const env = {
      ...environment,
      GITHUB_APP_PRIVATE_KEY: `-----BEGIN PRIVATE KEY-----\n${key}\n-----END PRIVATE KEY-----`,
    } as AppEnv;
    let prCreated = false,
      receipt: string | null = null;
    const payload = {
      document: { ...starter, visibility: "public" },
      file: "new.json",
      title: "Add preset",
      attribution: "Example",
      manifest: [{ id: starter.id, file: "new.json" }],
      diff: documentDiff(null, starter),
    };
    const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.includes("mcp_allowed")) return Response.json(true);
      if (url.includes("preset_submissions") && options?.method === "PATCH") {
        receipt = JSON.parse(String(options.body)).pr_url;
        return Response.json(null);
      }
      if (url.includes("preset_submissions"))
        return Response.json([
          {
            id,
            owner_id: user.id,
            client_id: user.clientId,
            request_hash: "hash",
            base_sha: "base",
            payload,
            status: receipt ? "submitted" : "preview",
            pr_url: receipt,
          },
        ]);
      if (url.includes("/access_tokens"))
        return Response.json({ token: "ephemeral-test-installation-token" });
      if (url.includes("/pulls?"))
        return Response.json(
          prCreated ? [{ html_url: "https://github.com/example/pull/1" }] : [],
        );
      if (url.endsWith("/git/ref/heads/main"))
        return Response.json({ object: { sha: "base" } });
      if (url.endsWith("/git/commits/base"))
        return Response.json({ tree: { sha: "base-tree" } });
      if (url.endsWith("/git/trees")) return Response.json({ sha: "new-tree" });
      if (url.endsWith("/git/commits"))
        return Response.json({ sha: "new-commit" });
      if (url.endsWith("/git/refs")) return Response.json({});
      if (url.endsWith("/pulls")) {
        prCreated = true;
        return Response.json({ error: "lost response" }, { status: 502 });
      }
      throw new Error("Unexpected request");
    });
    vi.stubGlobal("fetch", fetcher);
    expect(await submitPreset(env, user, id)).toEqual({
      status: "submitted",
      pullRequest: "https://github.com/example/pull/1",
    });
    const tree = JSON.parse(
      String(
        fetcher.mock.calls.find(([url]) => url.endsWith("/git/trees"))![1]!
          .body,
      ),
    );
    expect(tree.tree.map((file: { path: string }) => file.path)).toEqual([
      "web/src/core/researched/new.json",
      "web/src/core/presets.manifest.json",
    ]);
    const branch = JSON.parse(
      String(
        fetcher.mock.calls.find(([url]) => url.endsWith("/git/refs"))![1]!.body,
      ),
    );
    expect(branch.ref).toBe(`refs/heads/mcp/preset-${id}`);
    const before = fetcher.mock.calls.filter(([url]) =>
      url.startsWith("https://api.github.com"),
    ).length;
    await submitPreset(env, user, id);
    expect(
      fetcher.mock.calls.filter(([url]) =>
        url.startsWith("https://api.github.com"),
      ),
    ).toHaveLength(before);
    expect(fetcher.mock.calls.some(([url]) => url.includes("/merge"))).toBe(
      false,
    );
  });
});
