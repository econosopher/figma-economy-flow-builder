import type { AppEnv } from "../worker/env";
import {
  authenticate,
  HttpError,
  rest,
  type Identity,
} from "../worker/helpers";
import { tokenClaims } from "../worker/catalog";

export interface McpIdentity extends Identity {
  clientId: string;
}
export type Capability = "read" | "edit" | "submit";
export const mcpUrl = (env: AppEnv) => `${env.API_ORIGIN || env.APP_URL}/mcp`;
export function protectedResource(env: AppEnv) {
  return {
    resource: mcpUrl(env),
    authorization_servers: [`${env.SUPABASE_URL}/auth/v1`],
    bearer_methods_supported: ["header"],
    scopes_supported: ["openid"],
  };
}
export async function authenticateMcp(
  request: Request,
  env: AppEnv,
): Promise<McpIdentity> {
  if (env.MCP_ENABLED !== "true")
    throw new HttpError(503, "MCP account access is not activated yet.");
  const user = await authenticate(request, env);
  const claims = tokenClaims(user.token);
  if (!claims.client_id || ![claims.aud].flat().includes(mcpUrl(env)))
    throw new HttpError(401, "Use OAuth to connect this MCP client.");
  await requireCapability(env, user, "read");
  return { ...user, clientId: claims.client_id };
}
export async function requireCapability(
  env: AppEnv,
  user: Identity,
  capability: Capability,
) {
  const allowed = await rest<boolean>(
    env,
    "rpc/mcp_allowed",
    { method: "POST", body: JSON.stringify({ capability }) },
    user.token,
  );
  if (!allowed)
    throw new HttpError(
      403,
      `This connection does not have ${capability} permission, or its access was revoked.`,
    );
}
export function requireWebsiteSession(user: Identity) {
  if (tokenClaims(user.token).client_id)
    throw new HttpError(403, "Use the MCP tools for this connection.");
}
