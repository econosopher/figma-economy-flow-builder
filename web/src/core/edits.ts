import { z } from "zod";
import {
  documentSchema,
  validateDocument,
  type EconomyDocument,
} from "./document";

const entity = z.enum(["cards", "edges", "stages", "groups"]);
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,160}$/);
export const editSchema = z.discriminatedUnion("op", [
  z
    .object({
      op: z.literal("put"),
      entity,
      value: z.record(z.string(), z.unknown()),
    })
    .strict(),
  z.object({ op: z.literal("remove"), entity, id }).strict(),
  z
    .object({ op: z.literal("rename"), name: documentSchema.shape.name })
    .strict(),
  z
    .object({
      op: z.literal("settings"),
      value: documentSchema.shape.settings.partial(),
    })
    .strict(),
  z
    .object({
      op: z.literal("visibility"),
      value: z.enum(["public", "private"]),
    })
    .strict(),
]);
export type Edit = z.infer<typeof editSchema>;

/** The final batch is validated once: moves and stage changes can be atomic. */
export function applyEdits(
  document: EconomyDocument,
  edits: Edit[],
): EconomyDocument {
  const next = structuredClone(document);
  for (const edit of z.array(editSchema).max(1000).parse(edits)) {
    if (edit.op === "rename") next.name = edit.name;
    else if (edit.op === "settings")
      next.settings = { ...next.settings, ...edit.value };
    else if (edit.op === "visibility") next.visibility = edit.value;
    else {
      const items = next[edit.entity] as { id: string }[];
      if (edit.op === "put") {
        const key = id.parse(edit.value.id);
        const index = items.findIndex((item) => item.id === key);
        const value = { ...edit.value, id: key };
        if (index < 0) items.push(value);
        else items[index] = { ...items[index], ...value };
      } else {
        const index = items.findIndex((item) => item.id === edit.id);
        if (index < 0)
          throw new Error(`Missing ${edit.entity} item: ${edit.id}`);
        items.splice(index, 1);
        if (edit.entity === "cards")
          next.edges = next.edges.filter(
            (edge) => edge.from !== edit.id && edge.to !== edit.id,
          );
      }
    }
  }
  return validateDocument(next);
}

export function documentDiff(
  before: EconomyDocument | null,
  after: EconomyDocument,
) {
  return {
    fields: (["name", "settings", "visibility", "research"] as const).filter(
      (key) => JSON.stringify(before?.[key]) !== JSON.stringify(after[key]),
    ),
    entities: Object.fromEntries(
      (["cards", "edges", "stages", "groups"] as const).map((key) => {
        const previous = new Map(
          (before?.[key] || []).map((item) => [item.id, item]),
        );
        const next = new Map(after[key].map((item) => [item.id, item]));
        return [
          key,
          {
            added: [...next.keys()].filter((id) => !previous.has(id)),
            removed: [...previous.keys()].filter((id) => !next.has(id)),
            changed: [...next.keys()].filter(
              (id) =>
                previous.has(id) &&
                JSON.stringify(previous.get(id)) !==
                  JSON.stringify(next.get(id)),
            ),
            orderChanged:
              JSON.stringify([...previous.keys()]) !==
              JSON.stringify([...next.keys()]),
          },
        ];
      }),
    ),
  };
}
