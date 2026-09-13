import { z } from "zod";
import type { AppEnv } from "../worker/env";
import {
  HttpError,
  limitedExternalJson,
  rest,
  sha256,
} from "../worker/helpers";
import { importDocument, type EconomyDocument } from "../src/core/document";
import { documentDiff } from "../src/core/edits";
import { requireCapability, type McpIdentity } from "./auth";

export const repository = "econosopher/figma-economy-flow-builder";
const prefix = "web/src/core/";
const manifestPath = `${prefix}presets.manifest.json`;
export const manifestSchema = z
  .array(
    z
      .object({
        id: z.string().regex(/^[a-zA-Z0-9_-]{1,160}$/),
        file: z.string().regex(/^[a-z0-9_-]+\.json$/),
      })
      .strict(),
  )
  .max(500)
  .refine(
    (entries) =>
      new Set(entries.map((e) => e.id)).size === entries.length &&
      new Set(entries.map((e) => e.file)).size === entries.length,
    "Duplicate preset entries.",
  );
export const submissionInput = z
  .object({
    operationId: z.string().uuid(),
    document: z.unknown(),
    file: z.string().regex(/^[a-z0-9_-]+\.json$/),
    title: z.string().trim().min(1).max(150),
    attribution: z.string().trim().min(1).max(100),
  })
  .strict();
async function github<T>(
  path: string,
  token?: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`https://api.github.com/${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "Economy-Flow-MCP",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  const data = await limitedExternalJson(response, 3_000_000);
  if (!response.ok)
    throw new HttpError(
      response.status === 404 ? 404 : 502,
      `GitHub request failed (${response.status}). Retry using the same operation ID.`,
    );
  return data as T;
}
function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
async function installationToken(env: AppEnv) {
  if (
    !env.GITHUB_APP_ID ||
    !env.GITHUB_INSTALLATION_ID ||
    !env.GITHUB_APP_PRIVATE_KEY
  )
    throw new HttpError(503, "The repository GitHub App is not configured.");
  const encode = (v: unknown) =>
    base64url(new TextEncoder().encode(JSON.stringify(v)));
  const now = Math.floor(Date.now() / 1000);
  const message = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iat: now - 60, exp: now + 540, iss: env.GITHUB_APP_ID })}`;
  const pem = env.GITHUB_APP_PRIVATE_KEY.replace(/-----[^-]+-----|\s/g, "");
  const key = await crypto.subtle.importKey(
    "pkcs8",
    Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(message),
  );
  const jwt = `${message}.${base64url(new Uint8Array(signature))}`;
  return (
    await github<{ token: string }>(
      `app/installations/${z.string().regex(/^\d+$/).parse(env.GITHUB_INSTALLATION_ID)}/access_tokens`,
      jwt,
      {
        method: "POST",
        body: JSON.stringify({
          repositories: ["figma-economy-flow-builder"],
          permissions: { contents: "write", pull_requests: "write" },
        }),
      },
    )
  ).token;
}
async function fileAt(path: string, sha: string, token?: string) {
  const file = await github<{
    type: string;
    encoding: string;
    content: string;
  }>(`repos/${repository}/contents/${path}?ref=${sha}`, token);
  if (file.type !== "file" || file.encoding !== "base64")
    throw new HttpError(400, "Repository entry must be a regular JSON file.");
  return JSON.parse(
    new TextDecoder().decode(
      Uint8Array.from(atob(file.content.replace(/\s/g, "")), (c) =>
        c.charCodeAt(0),
      ),
    ),
  );
}
export async function repositoryPresets(id?: string) {
  const {
    object: { sha },
  } = await github<{ object: { sha: string } }>(
    `repos/${repository}/git/ref/heads/main`,
  );
  const manifest = manifestSchema.parse(await fileAt(manifestPath, sha));
  if (!id) return { repository, baseSha: sha, presets: manifest };
  const entry = manifest.find((e) => e.id === id);
  if (!entry) throw new HttpError(404, "Preset not in the public manifest.");
  return {
    repository,
    baseSha: sha,
    file: entry.file,
    document: importDocument(
      await fileAt(`${prefix}researched/${entry.file}`, sha),
    ).document,
  };
}
interface Submission {
  id: string;
  owner_id: string;
  client_id: string;
  request_hash: string;
  base_sha: string;
  payload: {
    document: EconomyDocument;
    file: string;
    title: string;
    attribution: string;
    manifest: z.infer<typeof manifestSchema>;
    diff: ReturnType<typeof documentDiff>;
  };
  status: string;
  pr_url: string | null;
}
async function ownedSubmission(env: AppEnv, user: McpIdentity, id: string) {
  const rows = await rest<Submission[]>(
    env,
    `preset_submissions?id=eq.${z.string().uuid().parse(id)}&owner_id=eq.${user.id}&client_id=eq.${encodeURIComponent(user.clientId)}`,
  );
  return rows[0];
}
export async function previewSubmission(
  env: AppEnv,
  user: McpIdentity,
  input: z.infer<typeof submissionInput>,
) {
  await requireCapability(env, user, "submit");
  const hash = await sha256(JSON.stringify(input));
  const existing = await ownedSubmission(env, user, input.operationId);
  if (existing) {
    if (existing.request_hash !== hash)
      throw new HttpError(409, "Use a new operation ID for changed content.");
    return submissionPreview(existing);
  }
  const document = importDocument(input.document).document;
  if (document.visibility === "private")
    throw new HttpError(
      400,
      "This document is private. Provide a public copy for a repository contribution.",
    );
  document.visibility = "public";
  const ref = await github<{ object: { sha: string } }>(
    `repos/${repository}/git/ref/heads/main`,
  );
  const manifest = manifestSchema.parse(
    await fileAt(manifestPath, ref.object.sha),
  );
  const entry = manifest.find(
    (e) => e.id === document.id || e.file === input.file,
  );
  if (entry && (entry.id !== document.id || entry.file !== input.file))
    throw new HttpError(
      409,
      "An existing preset ID and filename must stay paired.",
    );
  const before = entry
    ? importDocument(
        await fileAt(`${prefix}researched/${entry.file}`, ref.object.sha),
      ).document
    : null;
  if (!entry) manifest.push({ id: document.id, file: input.file });
  const record = {
    id: input.operationId,
    owner_id: user.id,
    client_id: user.clientId,
    request_hash: hash,
    base_sha: ref.object.sha,
    payload: {
      document,
      file: input.file,
      title: input.title,
      attribution: input.attribution,
      manifest,
      diff: documentDiff(before, document),
    },
    status: "preview",
    pr_url: null,
  };
  await rest(env, "preset_submissions", {
    method: "POST",
    body: JSON.stringify(record),
  });
  return submissionPreview(record);
}
function submissionPreview(record: Submission) {
  return {
    operationId: record.id,
    destination: `https://github.com/${repository}`,
    visibility: "public",
    baseSha: record.base_sha,
    files: [
      {
        path: `${prefix}researched/${record.payload.file}`,
        content: record.payload.document,
      },
      { path: manifestPath, content: record.payload.manifest },
    ],
    diff: record.payload.diff,
    status: record.status,
    pullRequest: record.pr_url,
  };
}
export async function submitPreset(
  env: AppEnv,
  user: McpIdentity,
  operationId: string,
) {
  await requireCapability(env, user, "submit");
  const item = await ownedSubmission(env, user, operationId);
  if (!item)
    throw new HttpError(404, "Preview the contribution before submitting it.");
  if (item.pr_url) return { pullRequest: item.pr_url, status: item.status };
  const token = await installationToken(env);
  const branch = `mcp/preset-${item.id}`;
  const findPr = () =>
    github<{ html_url: string }[]>(
      `repos/${repository}/pulls?head=econosopher:${branch}&state=all`,
      token,
    );
  let pr = (await findPr())[0];
  if (!pr) {
    const main = await github<{ object: { sha: string } }>(
      `repos/${repository}/git/ref/heads/main`,
      token,
    );
    if (main.object.sha !== item.base_sha)
      throw new HttpError(
        409,
        "The repository changed. Preview again with a new operation ID before submitting.",
      );
    const base = await github<{ tree: { sha: string } }>(
      `repos/${repository}/git/commits/${item.base_sha}`,
      token,
    );
    const tree = await github<{ sha: string }>(
      `repos/${repository}/git/trees`,
      token,
      {
        method: "POST",
        body: JSON.stringify({
          base_tree: base.tree.sha,
          tree: [
            {
              path: `${prefix}researched/${item.payload.file}`,
              mode: "100644",
              type: "blob",
              content: JSON.stringify(item.payload.document, null, 2) + "\n",
            },
            {
              path: manifestPath,
              mode: "100644",
              type: "blob",
              content: JSON.stringify(item.payload.manifest, null, 2) + "\n",
            },
          ],
        }),
      },
    );
    const commit = await github<{ sha: string }>(
      `repos/${repository}/git/commits`,
      token,
      {
        method: "POST",
        body: JSON.stringify({
          message: item.payload.title,
          tree: tree.sha,
          parents: [item.base_sha],
        }),
      },
    );
    try {
      await github(`repos/${repository}/git/refs`, token, {
        method: "POST",
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha }),
      });
    } catch (error) {
      const existing = await github<{ object: { sha: string } }>(
        `repos/${repository}/git/ref/heads/${branch}`,
        token,
      );
      const saved = await github<{ tree: { sha: string } }>(
        `repos/${repository}/git/commits/${existing.object.sha}`,
        token,
      );
      if (saved.tree.sha !== tree.sha) throw error;
    }
    try {
      pr = await github<{ html_url: string }>(
        `repos/${repository}/pulls`,
        token,
        {
          method: "POST",
          body: JSON.stringify({
            title: item.payload.title,
            head: branch,
            base: "main",
            body: `Adds or updates a public Economy Flow JSON preset.\n\nContributor: ${item.payload.attribution.replace(/[@<>]/g, "")}\n\nValidated with the shared document schema. Review the research sources and diagram before merging.\n\nSubmission: ${item.id}`,
          }),
        },
      );
    } catch (error) {
      pr = (await findPr())[0];
      if (!pr) throw error;
    }
  }
  await rest(
    env,
    `preset_submissions?id=eq.${item.id}&owner_id=eq.${user.id}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status: "submitted", pr_url: pr.html_url }),
    },
  );
  return { pullRequest: pr.html_url, status: "submitted" };
}
