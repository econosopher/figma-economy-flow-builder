import { type SupabaseClient } from "@supabase/supabase-js";
export interface AppConfig {
  cloud: boolean;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  slack: boolean;
  research: boolean;
  environment: string;
}
let client: SupabaseClient | null = null;
export function authClient() {
  return client;
}
export async function initializeApi(): Promise<AppConfig> {
  try {
    const response = await fetch("/api/config");
    if (!response.ok) throw new Error();
    const config: AppConfig = await response.json();
    if (config.cloud && config.supabaseUrl && config.supabaseAnonKey) {
      const { createClient } = await import("@supabase/supabase-js");
      client = createClient(config.supabaseUrl, config.supabaseAnonKey);
    }
    return config;
  } catch {
    return {
      cloud: false,
      slack: false,
      research: false,
      environment: "local",
    };
  }
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T = Record<string, unknown>>(
  path: string,
  options: RequestInit = {},
  expectedOwner?: string,
): Promise<T> {
  const session = client ? (await client.auth.getSession()).data.session : null;
  if (expectedOwner && session?.user.id !== expectedOwner)
    throw new ApiError(
      "Account changed before saving. Your local recovery copy is retained.",
      401,
    );
  const headers = new Headers(options.headers);
  if (session) headers.set("Authorization", `Bearer ${session.access_token}`);
  if (
    options.body &&
    !(options.body instanceof Blob) &&
    !(options.body instanceof FormData)
  )
    headers.set("Content-Type", "application/json");
  const response = await fetch(`/api${path}`, { ...options, headers });
  const data = await response
    .json()
    .catch(() => ({ error: "The server did not return a valid response." }));
  if (!response.ok)
    throw new ApiError(
      typeof data === "object" && data !== null && "error" in data
        ? String(data.error)
        : "Request failed.",
      response.status,
    );
  return data as T;
}

const reportedEvents = new Map<string, number>();
export function reportEvent(
  kind: "save_failed" | "route_failed" | "export_failed" | "layout_failed",
  counts?: { cards: number; edges: number },
) {
  const last = reportedEvents.get(kind) || 0;
  if (Date.now() - last < 60000) return;
  reportedEvents.set(kind, Date.now());
  // Only categorical events and counts leave the browser. Never diagram text, keys, or provider output.
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, ...counts }),
    keepalive: true,
  }).catch(() => {});
}
