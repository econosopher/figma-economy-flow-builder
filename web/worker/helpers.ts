import type { AppEnv } from "./env";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const json = (data: unknown, status = 200, headers?: HeadersInit) =>
  Response.json(data, { status, headers });
export function cloudReady(env: AppEnv) {
  return !!(
    env.SUPABASE_URL &&
    env.SUPABASE_ANON_KEY &&
    env.SUPABASE_SERVICE_ROLE_KEY
  );
}
export function requireCloud(env: AppEnv) {
  if (!cloudReady(env))
    throw new HttpError(
      503,
      "Cloud accounts are not configured yet. Your diagram can still be saved locally and exported.",
    );
}
export async function boundedBytes(
  body: ReadableStream<Uint8Array> | null,
  max: number,
): Promise<Uint8Array> {
  if (!body) return new Uint8Array();
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > max) {
        await reader.cancel();
        throw new HttpError(413, "The request is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let off = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, off);
    off += chunk.length;
  }
  return bytes;
}
export async function bodyJson(
  request: Request,
  max = 2_000_000,
): Promise<unknown> {
  try {
    return JSON.parse(
      new TextDecoder().decode(await boundedBytes(request.body, max)),
    );
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Invalid JSON.");
  }
}
export async function rest<T>(
  env: AppEnv,
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  requireCloud(env);
  const headers = new Headers(options.headers);
  headers.set("apikey", String(env.SUPABASE_ANON_KEY));
  headers.set(
    "Authorization",
    `Bearer ${token || env.SUPABASE_SERVICE_ROLE_KEY}`,
  );
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers,
    signal: AbortSignal.timeout(15000),
  });
  const bytes = await boundedBytes(response.body, 8_000_000);
  const data = bytes.length
    ? JSON.parse(new TextDecoder().decode(bytes))
    : null;
  if (!response.ok) {
    if (data?.code === "40001" || data?.code === "23505")
      throw new HttpError(
        409,
        "This item changed elsewhere. Reload it or save a copy.",
      );
    if (response.status === 401 || response.status === 403)
      throw new HttpError(response.status, "Access denied.");
    throw new HttpError(502, "Cloud storage could not complete the request.");
  }
  return data as T;
}
export interface Identity {
  id: string;
  token: string;
  email: string;
}
export async function authenticate(
  request: Request,
  env: AppEnv,
): Promise<Identity> {
  requireCloud(env);
  const token = request.headers.get("Authorization")?.replace(/^Bearer /, "");
  if (!token) throw new HttpError(401, "Sign in to continue.");
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: String(env.SUPABASE_ANON_KEY),
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new HttpError(401, "Your session expired. Please sign in again.");
  const user = (await response.json()) as { id?: string; email?: string };
  if (!user.id) throw new HttpError(401, "Invalid session.");
  return { id: user.id, email: user.email || "", token };
}
export async function sha256(value: string | Uint8Array) {
  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)),
    ),
  ]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
function b64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}
async function encryptionKey(env: AppEnv) {
  if (!env.CREDENTIAL_ENCRYPTION_KEY)
    throw new HttpError(503, "Secure credential storage is not configured.");
  const bytes = Uint8Array.from(atob(env.CREDENTIAL_ENCRYPTION_KEY), (c) =>
    c.charCodeAt(0),
  );
  if (bytes.length !== 32)
    throw new HttpError(503, "Secure credential storage is not configured.");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
export async function encrypt(value: string, env: AppEnv, context: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(context) },
    await encryptionKey(env),
    new TextEncoder().encode(value),
  );
  return `${b64(iv)}.${b64(new Uint8Array(cipher))}`;
}
export async function decrypt(value: string, env: AppEnv, context: string) {
  const [iv, data] = value
    .split(".")
    .map((s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));
  return new TextDecoder().decode(
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: new TextEncoder().encode(context),
      },
      await encryptionKey(env),
      data,
    ),
  );
}
export function randomToken() {
  return [...crypto.getRandomValues(new Uint8Array(32))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export function requireSameOrigin(request: Request, env: AppEnv) {
  const origin = request.headers.get("Origin");
  if (
    origin &&
    origin !== new URL(request.url).origin &&
    origin !== env.APP_URL
  )
    throw new HttpError(403, "Origin not allowed.");
}
export async function limitedExternalJson(response: Response, max = 2_000_000) {
  const bytes = await boundedBytes(response.body, max);
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new HttpError(502, "An integration returned an invalid response.");
  }
}
export const safeId = (id: string) => {
  if (!/^[a-zA-Z0-9_-]{1,160}$/.test(id))
    throw new HttpError(400, "Invalid item ID.");
  return encodeURIComponent(id);
};
export async function rateLimit(
  env: AppEnv,
  userId: string,
  table: string,
  limit: number,
) {
  const since = new Date(Date.now() - 3600000).toISOString();
  const rows = await rest<Array<{ id: string }>>(
    env,
    `${table}?owner_id=eq.${userId}&created_at=gte.${encodeURIComponent(since)}&select=id&limit=${limit}`,
  );
  if (rows.length >= limit)
    throw new HttpError(429, "Hourly limit reached. Please try again later.");
}
