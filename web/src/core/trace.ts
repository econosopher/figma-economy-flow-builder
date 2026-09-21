import type { EconomyDocument } from "./document";

/** Trace all acquisition paths into the target, stopping at player investments.
 * Feedback is a return trip, not a new upstream source of an investment.
 */
export function traceInvestments(
  document: Pick<EconomyDocument, "cards" | "edges">,
  targets: readonly string[],
) {
  const roots = new Set(
    document.cards
      .filter((c) => c.kind === "initial_sink_node")
      .map((c) => c.id),
  );
  const incoming = new Map<string, typeof document.edges>();
  const outgoing = new Map<string, typeof document.edges>();
  for (const edge of document.edges) {
    if (edge.feedback || roots.has(edge.to)) continue;
    incoming.set(edge.to, [...(incoming.get(edge.to) || []), edge]);
    outgoing.set(edge.from, [...(outgoing.get(edge.from) || []), edge]);
  }
  const ancestors = new Set(targets);
  const pending = [...targets];
  while (pending.length) {
    for (const edge of incoming.get(pending.pop()!) || []) {
      if (!ancestors.has(edge.from)) {
        ancestors.add(edge.from);
        pending.push(edge.from);
      }
    }
  }
  const cards = new Set([...roots].filter((id) => ancestors.has(id)));
  const edges = new Set<string>();
  const forward = [...cards];
  while (forward.length) {
    for (const edge of outgoing.get(forward.pop()!) || []) {
      if (!ancestors.has(edge.to)) continue;
      edges.add(edge.id);
      if (!cards.has(edge.to)) {
        cards.add(edge.to);
        forward.push(edge.to);
      }
    }
  }
  // A disconnected selection is still identifiable, but gains no invented path.
  for (const id of targets) cards.add(id);
  return { cards, edges };
}
