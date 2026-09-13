import { describe, it, expect, vi, afterEach } from "vitest";
import { uploadSlack, performSlackSend } from "../worker/slack";
import { encrypt, sha256 } from "../worker/helpers";
import type { AppEnv } from "../worker/env";
const env = {
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  CREDENTIAL_ENCRYPTION_KEY: btoa("x".repeat(32)),
} as AppEnv;
const user = {
  id: "11111111-1111-4111-8111-111111111111",
  token: "session",
  email: "test@example.com",
};
const operation = "33333333-3333-4333-8333-333333333333",
  installation = "44444444-4444-4444-8444-444444444444";
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
function request() {
  const form = new FormData();
  form.set("image", new Blob([png], { type: "image/png" }), "diagram.png");
  form.set("operationId", operation);
  form.set("installationId", installation);
  form.set("channel", "C1234");
  form.set("message", "Review this diagram.");
  return new Request("https://flow.example.com/api/slack/uploads", {
    method: "POST",
    body: form,
  });
}
async function hash() {
  return sha256(
    `${await sha256(png)}:${installation}:C1234::Review this diagram.`,
  );
}
afterEach(() => vi.unstubAllGlobals());
describe("Slack send state", () => {
  it("queues exactly one durable send with only an operation ID in its payload", async () => {
    const credential = await encrypt("bot-token", env, `${user.id}:T123`);
    const create = vi.fn().mockResolvedValue({ id: operation });
    const jobEnv = {
      ...env,
      SLACK_SEND: {
        create,
        get: vi.fn(),
        createBatch: vi.fn(),
        deleteBatch: vi.fn(),
      },
    } as AppEnv;
    const mock = vi.fn(async (url: string, options: RequestInit = {}) => {
      if (url.includes("slack_installations"))
        return Response.json([
          { id: installation, team_id: "T123", credential },
        ]);
      if (url.includes("slack_operations"))
        return Response.json(options.method ? null : []);
      if (url.includes("/storage/v1/object/slack-previews/"))
        return Response.json({ ok: true });
      throw new Error("Unexpected external request");
    });
    vi.stubGlobal("fetch", mock);
    const response = await uploadSlack(request(), jobEnv, user);
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ status: "queued" });
    expect(create).toHaveBeenCalledExactlyOnceWith({
      id: operation,
      params: { operationId: operation },
    });
    expect(
      mock.mock.calls.every((c) => !String(c[0]).includes("slack.com")),
    ).toBe(true);
  });

  it("returns an existing confirmed send without uploading again", async () => {
    const mock = vi
      .fn()
      .mockResolvedValue(
        Response.json([
          { status: "sent", payload_hash: await hash(), file_id: "F123" },
        ]),
      );
    vi.stubGlobal("fetch", mock);
    const response = await uploadSlack(request(), env, user);
    expect(await response.json()).toMatchObject({ status: "sent" });
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock.mock.calls[0][0]).toContain(
      "supabase.co/rest/v1/slack_operations",
    );
  });
  it("does not retry a send whose completion is uncertain", async () => {
    const mock = vi
      .fn()
      .mockResolvedValue(
        Response.json([
          { status: "uncertain", payload_hash: await hash(), file_id: "F123" },
        ]),
      );
    vi.stubGlobal("fetch", mock);
    const response = await uploadSlack(request(), env, user);
    expect(await response.json()).toMatchObject({ status: "uncertain" });
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it("records uncertainty when the final Slack acknowledgement is lost", async () => {
    const credential = await encrypt("bot-token", env, `${user.id}:T123`);
    const mock = vi.fn(async (url: string, options: RequestInit = {}) => {
      if (url.includes("slack_installations"))
        return Response.json([
          { id: installation, team_id: "T123", credential },
        ]);
      if (url.includes("slack_operations"))
        return Response.json(options.method ? null : []);
      if (url.includes("files.getUploadURLExternal"))
        return Response.json({
          ok: true,
          file_id: "F123",
          upload_url: "https://files.slack.test/upload",
        });
      if (url === "https://files.slack.test/upload") return new Response("ok");
      if (url.includes("files.completeUploadExternal"))
        throw new Error("Network disconnected after Slack accepted request");
      throw new Error("Unexpected request");
    });
    vi.stubGlobal("fetch", mock);
    const response = await performSlackSend(
      env,
      user,
      operation,
      "bot-token",
      png,
      {
        installationId: installation,
        channel: "C1234",
        thread: "",
        message: "Review this diagram.",
        filename: "diagram.png",
      },
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ status: "uncertain" });
    const completionCalls = mock.mock.calls.filter((c) =>
      String(c[0]).includes("completeUploadExternal"),
    );
    expect(completionCalls).toHaveLength(1);
    expect(
      mock.mock.calls.some((c) =>
        String(c[1]?.body).includes('"status":"uncertain"'),
      ),
    ).toBe(true);
  });
});
