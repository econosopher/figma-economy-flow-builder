import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import type { AppEnv } from "./env";
import {
  rest,
  encrypt,
  decrypt,
  sha256,
  randomToken,
  json,
  HttpError,
  type Identity,
  limitedExternalJson,
  boundedBytes,
  safeId,
  rateLimit,
} from "./helpers";
interface Installation {
  id: string;
  owner_id: string;
  team_id: string;
  team_name: string;
  bot_name: string;
  credential: string;
  scopes: string;
}
export async function slackCall(
  token: string,
  method: string,
  body: Record<string, unknown> = {},
) {
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const data = await limitedExternalJson(response);
  if (!response.ok || !data.ok)
    throw new HttpError(
      502,
      `Slack could not complete this action (${String(
        data.error || response.status,
      )
        .replace(/[^a-zA-Z0-9_]/g, "")
        .slice(0, 80)}).`,
    );
  return data;
}
export async function installation(env: AppEnv, id: string, owner: string) {
  const rows = await rest<Installation[]>(
    env,
    `slack_installations?id=eq.${safeId(id)}&owner_id=eq.${owner}`,
  );
  if (!rows[0]) throw new HttpError(404, "Slack connection not found.");
  return {
    installation: rows[0],
    token: await decrypt(
      rows[0].credential,
      env,
      `${owner}:${rows[0].team_id}`,
    ),
  };
}
export async function slackOAuthStart(env: AppEnv, user: Identity) {
  if (
    !env.SLACK_CLIENT_ID ||
    !env.SLACK_CLIENT_SECRET ||
    !env.CREDENTIAL_ENCRYPTION_KEY
  )
    throw new HttpError(
      503,
      "Slack connection is not configured yet. You can still copy or download PNG.",
    );
  const state = randomToken();
  await rest(env, "oauth_states", {
    method: "POST",
    body: JSON.stringify({
      token_hash: await sha256(state),
      owner_id: user.id,
      expires_at: new Date(Date.now() + 600000).toISOString(),
    }),
  });
  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.search = new URLSearchParams({
    client_id: String(env.SLACK_CLIENT_ID),
    scope: "files:write,channels:read,groups:read",
    state,
    redirect_uri: `${env.APP_URL}/api/slack/callback`,
  }).toString();
  return json({ url: url.toString() }, 200, {
    "Set-Cookie": `flow_slack_state=${state}; HttpOnly; SameSite=Lax; Path=/api/slack; Max-Age=600${env.ENVIRONMENT === "development" ? "" : "; Secure"}`,
  });
}
export async function slackOAuthCallback(request: Request, env: AppEnv) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state"),
    code = url.searchParams.get("code");
  const cookie = request.headers
    .get("Cookie")
    ?.match(/(?:^|; )flow_slack_state=([a-f0-9]+)/)?.[1];
  if (!state || !code || !cookie || state !== cookie)
    throw new HttpError(400, "Slack authorization expired or was cancelled.");
  const hash = await sha256(state);
  const states = await rest<{ owner_id: string; expires_at: string }[]>(
    env,
    `oauth_states?token_hash=eq.${hash}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}`,
    { method: "DELETE", headers: { Prefer: "return=representation" } },
  );
  if (!states[0]) throw new HttpError(400, "Slack authorization expired.");
  const response = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    body: new URLSearchParams({
      client_id: String(env.SLACK_CLIENT_ID),
      client_secret: env.SLACK_CLIENT_SECRET || "",
      code,
      redirect_uri: `${env.APP_URL}/api/slack/callback`,
    }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await limitedExternalJson(response);
  if (!data.ok || !data.access_token || !data.team?.id)
    throw new HttpError(400, "Slack authorization failed.");
  const owner = states[0].owner_id;
  const credential = await encrypt(
    data.access_token,
    env,
    `${owner}:${data.team.id}`,
  );
  await rest(env, "slack_installations?on_conflict=owner_id,team_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      owner_id: owner,
      team_id: data.team.id,
      team_name: data.team.name || data.team.id,
      bot_name: "Economy Flow Builder",
      scopes: data.scope,
      credential,
    }),
  });
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${env.APP_URL}/?slack=connected`,
      "Set-Cookie":
        "flow_slack_state=; HttpOnly; SameSite=Lax; Path=/api/slack; Max-Age=0",
    },
  });
}
export async function uploadSlack(
  request: Request,
  env: AppEnv,
  user: Identity,
) {
  const bytes = await boundedBytes(request.body, 15_000_000);
  const form = await new Request(request.url, {
    method: "POST",
    headers: { "Content-Type": request.headers.get("Content-Type") || "" },
    body: new Uint8Array(bytes),
  }).formData();
  const file = form.get("image");
  const operationId = String(form.get("operationId") || "");
  const channel = String(form.get("channel") || "");
  const thread = String(form.get("thread") || "");
  const message = String(form.get("message") || "");
  const installId = String(form.get("installationId") || "");
  if (
    !/^[a-f0-9-]{36}$/.test(operationId) ||
    !/^[CG][A-Z0-9]+$/.test(channel) ||
    (thread && !/^\d+\.\d+$/.test(thread)) ||
    message.length > 3000 ||
    !(file instanceof File) ||
    file.type !== "image/png"
  )
    throw new HttpError(400, "Choose a workspace, channel, and PNG preview.");
  const image = new Uint8Array(await file.arrayBuffer());
  if (image[0] !== 137 || image[1] !== 80 || image[2] !== 78 || image[3] !== 71)
    throw new HttpError(400, "Expected a PNG image.");
  const payloadHash = await sha256(
    `${await sha256(image)}:${installId}:${channel}:${thread}:${message}`,
  );
  const existing = await rest<
    { status: string; payload_hash: string; file_id?: string }[]
  >(env, `slack_operations?id=eq.${operationId}&owner_id=eq.${user.id}`);
  if (existing[0]) {
    if (existing[0].payload_hash !== payloadHash)
      throw new HttpError(
        409,
        "This send ID was already used for a different preview.",
      );
    return json(existing[0]);
  }
  await rateLimit(env, user.id, "slack_operations", 30);
  await installation(env, installId, user.id);
  // Unique primary key claims the send before any Slack request.
  await rest(env, "slack_operations", {
    method: "POST",
    body: JSON.stringify({
      id: operationId,
      owner_id: user.id,
      payload_hash: payloadHash,
      status: "queued",
      payload: {
        installationId: installId,
        channel,
        thread,
        message,
        filename: file.name,
      },
    }),
  });
  try {
    const response = await fetch(
      `${env.SUPABASE_URL}/storage/v1/object/slack-previews/${user.id}/${operationId}.png`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "image/png",
        },
        body: image,
        signal: AbortSignal.timeout(15000),
      },
    );
    await response.body?.cancel();
    if (!response.ok) throw new Error("Preview upload failed.");
    await env.SLACK_SEND.create({ id: operationId, params: { operationId } });
    return json({ status: "queued" }, 202);
  } catch {
    await rest(env, `slack_operations?id=eq.${operationId}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "failed",
        error: "Could not queue the Slack send. Nothing was sent.",
      }),
    });
    await removeSlackPreview(env, user.id, operationId);
    throw new HttpError(
      502,
      "Could not queue the Slack send. Nothing was sent.",
    );
  }
}
interface SlackPayload {
  installationId: string;
  channel: string;
  thread: string;
  message: string;
  filename: string;
}
export async function performSlackSend(
  env: AppEnv,
  user: Identity,
  operationId: string,
  token: string,
  image: Uint8Array,
  payload: SlackPayload,
) {
  const path = `slack_operations?id=eq.${operationId}&owner_id=eq.${user.id}`;
  let completing = false;
  try {
    const uploaded = await slackCall(token, "files.getUploadURLExternal", {
      filename: payload.filename,
      length: image.length,
    });
    await rest(env, path, {
      method: "PATCH",
      body: JSON.stringify({ file_id: uploaded.file_id }),
    });
    const upload = await fetch(uploaded.upload_url, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: new Uint8Array(image),
      signal: AbortSignal.timeout(60000),
    });
    await upload.body?.cancel();
    if (!upload.ok) throw new Error("Image upload failed.");
    await rest(env, path, {
      method: "PATCH",
      body: JSON.stringify({ status: "completing" }),
    });
    completing = true;
    await slackCall(token, "files.completeUploadExternal", {
      files: [{ id: uploaded.file_id, title: payload.filename }],
      channel_id: payload.channel,
      ...(payload.thread ? { thread_ts: payload.thread } : {}),
      ...(payload.message ? { initial_comment: payload.message } : {}),
    });
    await rest(env, path, {
      method: "PATCH",
      body: JSON.stringify({ status: "sent" }),
    });
    return json({ status: "sent", file_id: uploaded.file_id });
  } catch {
    const status = completing ? "uncertain" : "failed";
    await rest(env, path, {
      method: "PATCH",
      body: JSON.stringify({
        status,
        error: completing
          ? "Check Slack before attempting a new send. The completion response was not confirmed."
          : "Slack upload failed before sharing.",
      }),
    });
    console.error(
      JSON.stringify({ event: "slack_send_failed", operationId, status }),
    );
    return json({ status }, 502);
  }
}

export async function removeSlackPreview(
  env: AppEnv,
  owner: string,
  operationId: string,
) {
  const response = await fetch(
    `${env.SUPABASE_URL}/storage/v1/object/slack-previews`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefixes: [`${owner}/${operationId}.png`] }),
      signal: AbortSignal.timeout(15000),
    },
  );
  await response.body?.cancel();
  if (!response.ok) throw new Error("Temporary preview cleanup failed.");
}
export class SlackSendWorkflow extends WorkflowEntrypoint<
  AppEnv,
  { operationId: string }
> {
  async run(event: WorkflowEvent<{ operationId: string }>, step: WorkflowStep) {
    const id = event.payload.operationId;
    const operation = await step.do("load send", async () => {
      const rows = await rest<{ owner_id: string; payload: SlackPayload }[]>(
        this.env,
        `slack_operations?id=eq.${id}`,
      );
      if (!rows[0]) throw new Error("Send not found.");
      return rows[0];
    });
    try {
      await step.do(
        "upload approved preview",
        { retries: { limit: 0, delay: "1 second" }, timeout: "5 minutes" },
        async () => {
          const rows = await rest<{ status: string }[]>(
            this.env,
            `slack_operations?id=eq.${id}`,
          );
          const status = rows[0]?.status;
          if (
            status === "sent" ||
            status === "uncertain" ||
            status === "failed"
          )
            return status;
          // A restarted execution must never repeat a completion call that may have succeeded.
          if (status === "completing") {
            await rest(this.env, `slack_operations?id=eq.${id}`, {
              method: "PATCH",
              body: JSON.stringify({
                status: "uncertain",
                error:
                  "The previous completion response was not confirmed. Check Slack before a new send.",
              }),
            });
            return "uncertain";
          }
          const { token } = await installation(
            this.env,
            operation.payload.installationId,
            operation.owner_id,
          );
          const response = await fetch(
            `${this.env.SUPABASE_URL}/storage/v1/object/slack-previews/${operation.owner_id}/${id}.png`,
            {
              headers: {
                Authorization: `Bearer ${this.env.SUPABASE_SERVICE_ROLE_KEY}`,
              },
              signal: AbortSignal.timeout(30000),
            },
          );
          if (!response.ok) {
            await response.body?.cancel();
            throw new Error("Preview unavailable.");
          }
          const bytes = await boundedBytes(response.body, 15_000_000);
          await rest(this.env, `slack_operations?id=eq.${id}`, {
            method: "PATCH",
            body: JSON.stringify({ status: "uploading" }),
          });
          const result = await performSlackSend(
            this.env,
            { id: operation.owner_id, token: "", email: "" },
            id,
            token,
            new Uint8Array(bytes),
            operation.payload,
          );
          return ((await result.json()) as { status: string }).status;
        },
      );
    } catch {
      await step.do("record send failure", () =>
        rest<null>(
          this.env,
          `slack_operations?id=eq.${id}&status=in.(queued,uploading)`,
          {
            method: "PATCH",
            body: JSON.stringify({
              status: "failed",
              error: "Slack upload could not complete before sharing.",
            }),
          },
        ),
      );
    } finally {
      await step.do("erase preview", async () => {
        await removeSlackPreview(this.env, operation.owner_id, id);
        await rest(this.env, `slack_operations?id=eq.${id}`, {
          method: "PATCH",
          body: JSON.stringify({ payload: null, preview_removed: true }),
        });
        return null;
      });
    }
  }
}
