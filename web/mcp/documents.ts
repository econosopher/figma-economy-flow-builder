import { z } from "zod";
import { applyEdits, documentDiff, editSchema } from "../src/core/edits";
import {
  blankDocument,
  importDocument,
  validateDocument,
  type EconomyDocument,
} from "../src/core/document";
import {
  assertReleaseReady,
  checkReleaseReadiness,
} from "../src/core/conventions";
import {
  approximateMeasure,
  layoutDocument,
  measureCards,
  measureHeadings,
} from "../src/core/layout";
import { presets, starter } from "../src/core/presets";
import {
  getDocument,
  saveDocument,
  type DocumentRow,
} from "../worker/documents";
import { HttpError, rest, sha256 } from "../worker/helpers";
import type { AppEnv } from "../worker/env";
import { requireCapability, type McpIdentity } from "./auth";

export const changeInput = z
  .object({
    documentId: z.string().regex(/^[a-zA-Z0-9_-]{1,160}$/),
    expectedRevision: z.number().int().positive(),
    edits: z.array(editSchema).max(1000).optional(),
    replacement: z.unknown().optional(),
  })
  .refine(
    (v) => (v.edits !== undefined) !== (v.replacement !== undefined),
    "Provide edits OR replacement.",
  );
export const createInput = z
  .object({
    operationId: z.string().uuid(),
    document: z.unknown().optional(),
    copyFrom: z.string().max(200).optional(),
    name: z.string().min(1).max(500).optional(),
    visibility: z.enum(["public", "private"]).optional(),
  })
  .refine((v) => !(v.document && v.copyFrom), "Provide document OR copyFrom.");

export async function readDiagram(
  env: AppEnv,
  user: McpIdentity,
  reference: string,
) {
  await requireCapability(env, user, "read");
  if (reference.startsWith("preset:")) {
    const id = reference.slice(7);
    const document =
      id === "starter" ? starter : presets.find((p) => p.id === id)?.document;
    if (!document) throw new HttpError(404, "Preset not found.");
    assertReleaseReady(document);
    return { document, revision: 0, source: "preset" };
  }
  if (reference.startsWith("publication:")) {
    const id = z.string().uuid().parse(reference.slice(12));
    const rows = await rest<{ snapshot: EconomyDocument }[]>(
      env,
      `publications?id=eq.${id}&listed=eq.true&hidden=eq.false&select=snapshot`,
    );
    if (!rows[0]) throw new HttpError(404, "Publication not found.");
    const document = validateDocument(rows[0].snapshot);
    try {
      assertReleaseReady(document);
    } catch (error) {
      throw new HttpError(
        409,
        error instanceof Error ? error.message : "Publication is not release ready.",
      );
    }
    return {
      document,
      revision: 0,
      source: "community",
    };
  }
  return { ...(await getDocument(env, user, reference)), source: "account" };
}
export function validateDraft(input: unknown) {
  const { document, notices } = importDocument(input);
  const layout = layoutDocument(
    document,
    measureCards(document, approximateMeasure),
    measureHeadings(document, approximateMeasure),
  );
  return {
    document,
    notices,
    releaseReadiness: checkReleaseReadiness(document),
    routingIssues: layout.issues,
    measurement: "approximate; render_diagram checks actual font metrics",
  };
}
export async function previewChange(
  env: AppEnv,
  user: McpIdentity,
  input: z.infer<typeof changeInput>,
) {
  await requireCapability(env, user, "read");
  const current = await getDocument(env, user, input.documentId);
  if (current.revision !== input.expectedRevision)
    throw new HttpError(
      409,
      "Revision conflict. Read the latest diagram before editing.",
    );
  let document = input.edits
    ? applyEdits(current.document, input.edits)
    : validateDocument({
        ...validateDocument(input.replacement),
        visibility: current.document.visibility,
      });
  if (document.id !== current.id)
    throw new HttpError(400, "Replacement must preserve the document ID.");
  const becamePrivate =
    document.visibility === "public" &&
    !checkReleaseReadiness(document).ready;
  if (becamePrivate) document = { ...document, visibility: "private" };
  const validated = validateDraft(document);
  return {
    ...validated,
    notices: [
      ...validated.notices,
      ...(becamePrivate
        ? [
            "The edited diagram no longer meets release conventions, so it will be saved as a private draft.",
          ]
        : []),
    ],
    diff: documentDiff(current.document, document),
    isPreset: current.is_preset,
  };
}
function result(env: AppEnv, row: DocumentRow) {
  return {
    ...row,
    visibility: row.document.visibility || "legacy",
    url: `${env.APP_URL}/?document=${encodeURIComponent(row.id)}`,
  };
}
async function receipt(
  env: AppEnv,
  user: McpIdentity,
  operationId: string,
  hash: string,
) {
  return rest<DocumentRow | null>(
    env,
    "rpc/mcp_save_receipt",
    {
      method: "POST",
      body: JSON.stringify({
        p_operation_id: operationId,
        p_request_hash: hash,
      }),
    },
    user.token,
  );
}
export async function editDiagram(
  env: AppEnv,
  user: McpIdentity,
  input: z.infer<typeof changeInput>,
  operationId: string,
) {
  await requireCapability(env, user, "edit");
  const hash = await sha256(JSON.stringify({ kind: "edit", input }));
  const previous = await receipt(env, user, operationId, hash);
  if (previous) return result(env, previous);
  const draft = await previewChange(env, user, input);
  const saved = await saveDocument(
    env,
    user,
    {
      document: draft.document,
      expectedRevision: input.expectedRevision,
      isPreset: draft.isPreset,
      operationId,
    },
    hash,
  );
  return {
    ...result(env, saved),
    diff: draft.diff,
    routingIssues: draft.routingIssues,
    notices: draft.notices,
  };
}
export async function createDiagram(
  env: AppEnv,
  user: McpIdentity,
  input: z.infer<typeof createInput>,
) {
  await requireCapability(env, user, "edit");
  const hash = await sha256(JSON.stringify({ kind: "create", input }));
  const previous = await receipt(env, user, input.operationId, hash);
  if (previous) return result(env, previous);
  const imported = input.copyFrom
    ? {
        document: (await readDiagram(env, user, input.copyFrom)).document,
        notices: [],
      }
    : input.document
      ? importDocument(input.document)
      : { document: blankDocument(), notices: [] };
  const document = validateDocument({
    ...imported.document,
    id: input.operationId,
    name: input.name || imported.document.name,
    visibility: input.visibility || imported.document.visibility || "private",
  });
  return {
    ...result(
      env,
      await saveDocument(
        env,
        user,
        {
          document,
          expectedRevision: 0,
          isPreset: false,
          operationId: input.operationId,
        },
        hash,
      ),
    ),
    notices: imported.notices,
  };
}
