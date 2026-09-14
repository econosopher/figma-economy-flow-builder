import { z } from "zod";
import { validateDocument, type EconomyDocument } from "../src/core/document";
import { assertReleaseReady } from "../src/core/conventions";
import { HttpError, rest, safeId, type Identity } from "./helpers";
import type { AppEnv } from "./env";
export interface DocumentRow {
  id: string;
  document: EconomyDocument;
  revision: number;
  is_preset: boolean;
  updated_at: string;
}
export const saveInput = z.object({
  document: z.unknown(),
  expectedRevision: z.number().int().nonnegative(),
  isPreset: z.boolean().default(false),
  operationId: z.string().uuid().optional(),
});
export async function getDocument(env: AppEnv, user: Identity, id: string) {
  const rows = await rest<DocumentRow[]>(
    env,
    `documents?id=eq.${safeId(id)}&owner_id=eq.${user.id}`,
    {},
    user.token,
  );
  if (!rows[0]) throw new HttpError(404, "Diagram not found.");
  return rows[0];
}
export async function saveDocument(
  env: AppEnv,
  user: Identity,
  input: z.infer<typeof saveInput>,
  requestHash?: string,
) {
  let document: EconomyDocument;
  try {
    document = validateDocument(input.document);
    if (document.visibility === "public") assertReleaseReady(document);
  } catch (error) {
    throw new HttpError(
      400,
      error instanceof Error ? error.message : "Invalid diagram.",
    );
  }
  const body = {
    p_id: document.id,
    p_document: document,
    p_expected_revision: input.expectedRevision,
    p_is_preset: input.isPreset,
    ...(input.operationId
      ? { p_operation_id: input.operationId, p_request_hash: requestHash }
      : {}),
  };
  return rest<DocumentRow>(
    env,
    `rpc/${input.operationId ? "save_document_once" : "save_document"}`,
    { method: "POST", body: JSON.stringify(body) },
    user.token,
  );
}
