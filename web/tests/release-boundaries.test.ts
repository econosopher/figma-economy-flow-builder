import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../worker/index";
import { saveDocument } from "../worker/documents";
import { blankDocument } from "../src/core/document";
import type { AppEnv } from "../worker/env";
import { parseResearch } from "../worker/research";
import { previewChange } from "../mcp/documents";

const user = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "owner@example.com",
  token: "session",
};

function environment(): AppEnv {
  return {
    ENVIRONMENT: "development",
    APP_URL: "https://flow.example.com",
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_ANON_KEY: "public",
    SUPABASE_SERVICE_ROLE_KEY: "private",
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

afterEach(() => vi.unstubAllGlobals());

describe("release boundaries", () => {
  it("returns provider-built research as a private draft", () => {
    const result = parseResearch(JSON.stringify({
      schemaVersion: 2,
      name: "Researched game",
      stages: [
        { id: "inputs", label: "Inputs" },
        { id: "play", label: "Play" },
      ],
      nodes: [
        {
          id: "time",
          label: "Spend Time",
          stageId: "inputs",
          kind: "initial_sink_node",
        },
        {
          id: "money",
          label: "Spend Money",
          stageId: "inputs",
          kind: "initial_sink_node",
        },
      ],
      edges: [],
    }));
    expect(result.document.visibility).toBe("private");
  });

  it("allows an incomplete private save and blocks the same public save", async () => {
    const privateDraft = blankDocument();
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        id: privateDraft.id,
        document: privateDraft,
        revision: 1,
        is_preset: false,
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    await expect(
      saveDocument(environment(), user, {
        document: privateDraft,
        expectedRevision: 0,
        isPreset: false,
      }),
    ).resolves.toMatchObject({ id: privateDraft.id });

    fetcher.mockClear();
    await expect(
      saveDocument(environment(), user, {
        document: { ...privateDraft, visibility: "public" },
        expectedRevision: 1,
        isPreset: false,
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("blocks creating a public share from an incomplete draft", async () => {
    const draft = blankDocument();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(user)));
    const response = await worker.fetch(
      new Request("https://flow.example.com/api/shares", {
        method: "POST",
        headers: {
          Authorization: "Bearer session",
          Origin: "https://flow.example.com",
        },
        body: JSON.stringify(draft),
      }),
      environment(),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("not ready to release"),
    });
  });

  it("withholds a legacy shared snapshot that fails current conventions", async () => {
    const draft = blankDocument();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json([{ snapshot: draft }])),
    );
    const response = await worker.fetch(
      new Request(`https://flow.example.com/api/shared/${"a".repeat(64)}`),
      environment(),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("time_input_disconnected"),
    });
  });

  it("recovers an invalid edit to a public diagram as a private MCP draft", async () => {
    const document = blankDocument();
    document.visibility = "public";
    document.cards[1].notes =
      "Not applicable: this game has no real-money spending.";
    document.cards.push({
      id: "goal",
      label: "Mastery",
      stageId: "outcome",
      groupId: "core",
      order: 2,
      kind: "final_good",
      sources: [],
      sinks: [],
      values: [],
      notes: "",
    });
    document.edges.push({
      id: "time-goal",
      from: "spend_time",
      to: "goal",
      type: "final",
      feedback: false,
      label: "",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        Response.json(
          url.includes("mcp_allowed")
            ? true
            : [{ id: document.id, document, revision: 1, is_preset: false }],
        ),
      ),
    );
    const preview = await previewChange(
      environment(),
      { ...user, clientId: "client" },
      {
        documentId: document.id,
        expectedRevision: 1,
        edits: [{ op: "remove", entity: "cards", id: "goal" }],
      },
    );
    expect(preview.document.visibility).toBe("private");
    expect(preview.notices).toContain(
      "The edited diagram no longer meets release conventions, so it will be saved as a private draft.",
    );
  });
});
