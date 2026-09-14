# LLM Instructions for Economy Flow v2 JSON Generation

Use this prompt with Gemini, OpenAI, Claude, or as the conversion step after a Deep Research report. The research step should gather evidence first; this step should emit the plugin payload.

```text
You are an expert video game economist and analyst. Research the economy and player progression systems of "[Specify Game Title Here]" and generate a compact Economy Flow v2 JSON object.

Return one raw JSON object only. Do not include markdown fences, comments, or prose.

Required top-level keys:
- "schemaVersion": always 2
- "stages": ordered left-to-right stage columns
- "nodes": player inputs, activities, systems, and final goals
- "edges": directed object-form connections

Optional top-level keys:
- "name"
- "lanes"

Release rules:
1. Use snake_case ids only.
2. Use short semantic stage labels such as "Inputs", "Play", "Earn", "Spend", "Collection", and "Outcomes"; never use generic labels like "Stage 2".
3. The first stage contains exactly two nodes and no activities:
   - `{ "label": "Spend Time", "kind": "initial_sink_node", "inputRole": "time" }`
   - `{ "label": "Spend Money", "kind": "initial_sink_node", "inputRole": "money" }`
4. Spend Money means real-world spending, never earned currency or an opening balance. If the game has no real-money spending, keep the input disconnected and add a `notes` explanation beginning `Not applicable:`; never invent a paid mechanic.
5. Assign every node to an existing stageId and, when lanes are present, an existing laneId.
6. Every non-input node must be reachable from an applicable input using only non-feedback edges.
7. Every non-feedback edge must move to a strictly later stage. A same-stage or backward edge must set `"feedback": true` and include a short, visible, non-empty `"label"` explaining the return.
8. Final goals use kind = "final_good" and must be assigned to the last stage.
9. Every node includes "sources", "sinks", and "values" arrays, even if empty.
10. Every edge is an object with "from" and "to" ids. Optional type may be "normal", "value", "final", or "cross-lane".
11. Prefer compact, high-signal diagrams over exhaustive detail. Connect pathways supported by the research; never attach an input to unrelated cards merely to satisfy reachability.

Schema validation is necessary but does not make a graph release-ready. Run the shared `checkEconomyConventions` checker after import or generation and repair every violation before release, sharing, export, or Figma rendering.

Definitions:
- sources: spendable resources produced by a system.
- sinks: spendable resources consumed by a system.
- values: progress metrics that accumulate but are not directly spent.
- final_good: the terminal player-facing outcome, such as mastery, collection completion, rank, expression, or dominance.

Research focus:
1. Identify primary player inputs.
2. Map core gameplay, progression, monetization, events, and collection loops.
3. For each activity, determine resources produced, resources consumed, and persistent progress granted.
4. Trace relationships between systems with edges.
5. Keep names consistent across the graph.

Generate the complete JSON for "[Specify Game Title Here]" following these exact requirements.
```
