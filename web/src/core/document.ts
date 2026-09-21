import { z } from "zod";
const id = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-zA-Z0-9_-]+$/);
const label = z.string().min(1).max(500);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const originalPalette = {
  source: "#4CAF50",
  sink: "#DA5433",
  value: "#EC9F53",
  actionHeader: "#000000",
  finalGood: "#F5C95C",
};
export const settingsSchema = z.object({
  spacing: z.enum(["compact", "comfortable"]).default("comfortable"),
  showLegend: z.boolean().default(true),
  background: z.enum(["white", "transparent"]).default("white"),
  actionHeader: color.default("#000000"),
  finalGood: color.default("#F5C95C"),
  source: color.default("#21865b"),
  sink: color.default("#d15d44"),
  value: color.default("#ba8425"),
});
export const cardSchema = z.object({
  id,
  label,
  stageId: id,
  groupId: id,
  order: z.number().finite(),
  kind: z.enum(["action", "initial_sink_node", "final_good"]).default("action"),
  inputRole: z.enum(["time", "money"]).optional(),
  sources: z.array(label).max(40).default([]),
  sinks: z.array(label).max(40).default([]),
  values: z.array(label).max(40).default([]),
  notes: z.string().max(3000).default(""),
});
export const edgeSchema = z.object({
  id,
  from: id,
  to: id,
  type: z.enum(["normal", "value", "final", "cross-lane"]).default("normal"),
  feedback: z.boolean().default(false),
  label: z.string().max(160).default(""),
});
export const researchSchema = z.object({
  presetId: id,
  revision: z.string().min(1).max(80),
  category: z.enum(["Mobile", "PC / console"]),
  summary: z.string().max(500),
  scope: z.string().max(1000),
  checkedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  limitations: z.array(z.string().max(1000)).max(20),
  sources: z
    .array(
      z.object({
        id,
        title: z.string().min(1).max(300),
        url: z
          .string()
          .url()
          .refine(
            (s) => /^https?:\/\//.test(s),
            "Sources must use HTTP or HTTPS.",
          ),
        publisher: z.string().max(200),
        kind: z.enum([
          "Developer",
          "Platform editorial",
          "Independent analysis",
        ]),
        note: z.string().max(1500),
        cardIds: z.array(id).max(200),
        edgeIds: z.array(id).max(600),
      }),
    )
    .max(40),
  interpretations: z
    .array(
      z.object({
        cardIds: z.array(id).max(200),
        edgeIds: z.array(id).max(600),
        note: z.string().max(1000),
      }),
    )
    .max(30),
});
export type PresetResearch = z.infer<typeof researchSchema>;
const evidenceUrl = z.string().max(3000).url().refine(s => /^https:\/\//.test(s), "Evidence must use HTTPS.");
export const cardDetailSchema = z.object({
  cardId: id,
  explanation: z.string().max(5000).default(""),
  implications: z.string().max(3000).default(""),
  prompt: z.string().max(1000).default(""),
  status: z.enum(["current", "older", "announced", "inference", "unverified"]).default("unverified"),
  uncertainties: z.array(z.string().max(1500)).max(20).default([]),
  reviewFingerprint: z.string().max(30000).optional(),
});
export const evidenceItemSchema = z.object({
  id,
  cardIds: z.array(id).min(1).max(200),
  kind: z.enum(["image", "youtube", "source"]),
  title: z.string().min(1).max(300),
  url: evidenceUrl,
  caption: z.string().max(3000).default(""),
  observedAt: z.string().max(80).optional(),
  build: z.string().max(300).optional(),
  timestampSeconds: z.number().int().min(0).max(604800).optional(),
  endSeconds: z.number().int().min(1).max(604800).optional(),
  videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/).optional(),
  mediaId: z.string().regex(/^media-[a-f0-9]{64}$/).optional(),
}).superRefine((item,ctx) => {
  if(item.kind === "image" && !item.mediaId && !item.url) ctx.addIssue({code:"custom",message:"A screenshot needs a local attachment or public HTTPS image URL."});
  if(item.kind === "youtube") {
    const u = new URL(item.url);
    const linkedId = u.hostname === "youtu.be" ? u.pathname.slice(1) : ["www.youtube.com","youtube.com","m.youtube.com"].includes(u.hostname) ? (u.searchParams.get("v") || u.pathname.match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/)?.[1]) : null;
    if(!item.videoId || linkedId !== item.videoId) ctx.addIssue({code:"custom",message:"Video URL and YouTube ID must refer to the same video."});
  }
  if(item.endSeconds !== undefined && item.endSeconds <= (item.timestampSeconds ?? 0)) ctx.addIssue({code:"custom",message:"Clip end must follow its start."});
});
export type EvidenceItem = z.infer<typeof evidenceItemSchema>;
export type CardDetail = z.infer<typeof cardDetailSchema>;
export const evidenceSchema = z.object({
  details: z.array(cardDetailSchema).max(200).default([]),
  items: z.array(evidenceItemSchema).max(600).default([]),
});
export const documentSchema = z.object({
  schemaVersion: z.literal(3),
  id,
  name: label,
  stages: z.array(z.object({ id, label })).min(1).max(30),
  groups: z
    .array(z.object({ id, label, color: color.default("#f7f8fa") }))
    .min(1)
    .max(30),
  cards: z.array(cardSchema).max(200),
  edges: z.array(edgeSchema).max(600),
  settings: settingsSchema,
  // Absent on legacy documents: retain their explicit snapshot publishing behavior.
  visibility: z.enum(["public", "private"]).optional(),
  // Historical evidence for the original preset, retained even after user edits.
  research: researchSchema.optional(),
  evidence: evidenceSchema.optional(),
});
export type EconomyDocument = z.infer<typeof documentSchema>;
export type Card = z.infer<typeof cardSchema>;
export type Pipe = z.infer<typeof edgeSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export const defaultSettings: Settings = settingsSchema.parse({});
export const uid = () => crypto.randomUUID();
export function validateDocument(input: unknown): EconomyDocument {
  const d = documentSchema.parse(input);
  for (const [name, items] of [
    ["stages", d.stages],
    ["groups", d.groups],
    ["cards", d.cards],
    ["edges", d.edges],
  ] as const) {
    if (new Set(items.map((i) => i.id)).size !== items.length)
      throw new Error(`Duplicate IDs in ${name}.`);
  }
  const stages = new Map(d.stages.map((s, i) => [s.id, i]));
  const groups = new Set(d.groups.map((g) => g.id));
  const cards = new Map(d.cards.map((c) => [c.id, c]));
  for (const c of d.cards) {
    if (!stages.has(c.stageId) || !groups.has(c.groupId))
      throw new Error(`“${c.label}” needs an existing stage and group.`);
  }
  for (const e of d.edges) {
    const a = cards.get(e.from),
      b = cards.get(e.to);
    if (!a || !b) throw new Error("A pipe refers to a missing card.");
  }
  if (d.evidence) {
    if(new Set(d.evidence.details.map(x=>x.cardId)).size !== d.evidence.details.length) throw new Error("Duplicate card details.");
    if(new Set(d.evidence.items.map(x=>x.id)).size !== d.evidence.items.length) throw new Error("Duplicate evidence IDs.");
    for(const detail of d.evidence.details) if(!cards.has(detail.cardId)) throw new Error("Details refer to a missing card.");
    for(const item of d.evidence.items) for(const cardId of item.cardIds) if(!cards.has(cardId)) throw new Error("Evidence refers to a missing card.");
  }
  return d;
}
/** Stored content snapshot: moving a card does not invalidate its evidence. */
export function cardFingerprint(d: EconomyDocument, cardId: string): string {
  const c = d.cards.find(c=>c.id === cardId);
  if(!c) return "";
  const edges = d.edges.filter(e=>e.from === cardId || e.to === cardId).map(({id: _id,...e})=>e).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const {label,kind,inputRole,sources,sinks,values,notes} = c;
  return JSON.stringify({label,kind,inputRole,sources,sinks,values,notes,edges});
}
export function evidenceNeedsReview(d: EconomyDocument,cardId: string): boolean {
  const detail = d.evidence?.details.find(x=>x.cardId === cardId);
  return !!detail && detail.reviewFingerprint !== cardFingerprint(d,cardId);
}
const v2Schema = z.object({
  schemaVersion: z.literal(2),
  name: z.string().optional(),
  stages: z.array(z.object({ id, label })).min(1),
  lanes: z.array(z.object({ id, label, color: color.optional() })).optional(),
  nodes: z.array(
    z.object({
      id,
      label,
      stageId: id,
      laneId: id.optional(),
      kind: z.string().optional(),
      inputRole: z.enum(["time", "money"]).optional(),
      sources: z.array(label).optional(),
      sinks: z.array(label).optional(),
      values: z.array(label).optional(),
      notes: z.string().max(3000).optional(),
    }),
  ),
  edges: z.array(
    z.object({
      from: id,
      to: id,
      type: edgeSchema.shape.type.optional(),
      feedback: z.boolean().optional(),
      label: z.string().max(160).optional(),
    }),
  ),
});
export function importDocument(input: unknown): {
  document: EconomyDocument;
  notices: string[];
} {
  if (
    typeof input === "object" &&
    input !== null &&
    "schemaVersion" in input &&
    input.schemaVersion === 3
  )
    return { document: validateDocument(input), notices: [] };
  const old = v2Schema.parse(input);
  const groups = old.lanes?.length
    ? old.lanes
    : [{ id: "main", label: "Economy" }];
  const stageIndex = new Map(old.stages.map((s, i) => [s.id, i]));
  const nodes = new Map(old.nodes.map((n) => [n.id, n]));
  const notices: string[] = [];
  const document = validateDocument({
    schemaVersion: 3,
    id: uid(),
    name: old.name || "Untitled economy",
    stages: old.stages,
    groups: groups.map((g) => ({ ...g, color: g.color || "#f7f8fa" })),
    cards: old.nodes.map((n, i) => ({
      ...n,
      groupId: n.laneId || groups[0].id,
      order: i,
      kind:
        n.kind === "initial_sink_node" || n.kind === "final_good"
          ? n.kind
          : "action",
      notes: n.notes || "",
    })),
    edges: old.edges.map((e, i) => {
      const a = nodes.get(e.from),
        b = nodes.get(e.to);
      const feedback = e.feedback ?? !!(
        a &&
        b &&
        stageIndex.get(a.stageId)! >= stageIndex.get(b.stageId)!
      );
      if (feedback)
        notices.push(`${a!.label} → ${b!.label} will use a return track.`);
      return { ...e, id: `pipe-${i}`, feedback, label: e.label || "" };
    }),
    settings: defaultSettings,
  });
  return { document, notices };
}
export function blankDocument(): EconomyDocument {
  return validateDocument({
    schemaVersion: 3,
    id: uid(),
    name: "Untitled economy",
    visibility: "private",
    stages: [
      { id: "invest", label: "Investment" },
      { id: "play", label: "Core play" },
      { id: "reward", label: "Rewards" },
      { id: "outcome", label: "Outcomes" },
    ],
    groups: [{ id: "core", label: "Core loop", color: "#f5f8f6" }],
    cards: [
      {
        id: "spend_time",
        label: "Spend Time",
        stageId: "invest",
        groupId: "core",
        order: 0,
        kind: "initial_sink_node",
        inputRole: "time",
      },
      {
        id: "spend_money",
        label: "Spend Money",
        stageId: "invest",
        groupId: "core",
        order: 1,
        kind: "initial_sink_node",
        inputRole: "money",
      },
    ],
    edges: [],
    settings: defaultSettings,
  });
}
export function forkDocument(
  d: EconomyDocument,
  name = d.name,
): EconomyDocument {
  return {
    ...structuredClone(validateDocument(d)),
    id: uid(),
    name,
    visibility: "private",
  };
}
export function deleteCard(d: EconomyDocument, id: string): EconomyDocument {
  return {
    ...d,
    cards: d.cards.filter((c) => c.id !== id),
    ...(d.evidence ? {evidence: {
      details: d.evidence.details.filter(x=>x.cardId !== id),
      items: d.evidence.items.map(x=>({...x,cardIds:x.cardIds.filter(c=>c !== id)})).filter(x=>x.cardIds.length),
    }} : {}),
    edges: d.edges.filter((e) => e.from !== id && e.to !== id),
  };
}
export function addCard(
  d: EconomyDocument,
  stageId = d.stages[0].id,
  groupId = d.groups[0].id,
): EconomyDocument {
  return {
    ...d,
    cards: [
      ...d.cards,
      cardSchema.parse({
        id: uid(),
        label: "New action",
        stageId,
        groupId,
        order: Math.max(0, ...d.cards.map((c) => c.order)) + 1,
      }),
    ],
  };
}

/** Add the next step, including its pipe and any terminal-stage extension, atomically. */
export function addConnectedCard(
  d: EconomyDocument,
  fromId?: string,
  groupId = d.groups[0].id,
) {
  const from = d.cards.find((c) => c.id === fromId);
  if (from?.kind === "final_good")
    throw new Error(
      "Final goods end the flow. Add an action before the final good.",
    );
  let next = d;
  let stageId = d.stages[Math.min(1, d.stages.length - 1)].id;
  if (from) {
    const i = d.stages.findIndex((s) => s.id === from.stageId);
    if (i === d.stages.length - 1) {
      const id = uid();
      next = {
        ...d,
        stages: [...d.stages, { id, label: "Next stage" }],
        cards: d.cards.map((c) =>
          c.kind === "final_good" ? { ...c, stageId: id } : c,
        ),
      };
    }
    stageId = next.stages[i + 1].id;
  }
  next = addCard(next, stageId, from?.groupId || groupId);
  const cardId = next.cards.at(-1)!.id;
  if (from)
    next = {
      ...next,
      edges: [
        ...next.edges,
        {
          id: uid(),
          from: from.id,
          to: cardId,
          type: "normal",
          feedback: false,
          label: "",
        },
      ],
    };
  return { document: validateDocument(next), cardId };
}
