# LLM Instructions for Economy Flow JSON Generation

Use this prompt with Gemini, OpenAI, Claude, or as the conversion step after a Deep Research report. The research step gathers the evidence and the resource ledger first; this step emits the diagram JSON. The same standard is served to MCP clients as the `economy_flow_standard` prompt and the `economy-flow://rules` resource (see `web/MCP.md`), and the editor and the MCP `validate_diagram` tool report departures from it as `standardIssues`. The rule IDs refer to `docs/ECONOMY_FLOW_RULES.md`.

```text
You are an expert video game economist and analyst. Research the economy of "[Specify Game Title Here]" and generate a compact Economy Flow v2 JSON object.

Return one raw JSON object only. Do not include markdown fences, comments, or prose.

Research first, draw second. For every spendable resource (energy, ammo, parts, coins, cash, keys) and every progression value (XP, levels, ratings), record five facts before it appears in the JSON:
1. Origin: the trigger that creates it (which kills, which objective, which purchase, a starting grant).
2. Holder and scope: per player or per squad, per session or persistent, kept or lost on failure.
3. Spend points: every place it is spent and what each spend buys.
4. Rules: caps, counts, gating, cooldowns, what resets.
5. Effect: what the spend changes for the player.
If a fact is unknown, say so in the "notes" of the node that uses the resource, and in "notes" of the node where it would be produced or spent if that node is missing. Never promote a guess to a row. Do not wire from shared names or plausibility: if the evidence does not say what coins buy, the coins node has no outgoing edge and the limitation says so.

Required top-level keys:
- "schemaVersion": always 2
- "stages": ordered left-to-right columns, six to eight, named for the step ("Inputs", "Kit", "Mission", "Settlement", "Rewards", "Upgrades", "Outcomes"); never generic labels like "Stage 2"
- "nodes": player inputs, actions and final goals
- "edges": directed object-form connections

Optional top-level keys:
- "name"
- "lanes": one lane per system (the core loop, progression, monetization, modding); lanes stack top to bottom

Node rules:
1. Use snake_case ids only.
2. Player inputs are nodes with kind = "initial_sink_node", labelled "Spend Time" and, when real money is involved, "Spend Money". They carry no resource rows: "sources", "sinks" and "values" are all empty. Never add "Player time" or "Real money" as a sink.
3. Every other node is an action the player takes, or a final goal with kind = "final_good" placed in the last stage. A final goal is a terminal player benefit (mastery, status, expression, a stronger build), never a currency or an inventory count.
4. Assign every node to an existing stageId and, when lanes are present, an existing laneId. Keep one node per stage per lane where possible so each lane reads as one flat row.
5. Labels fit one line on the card: about 22 characters. "Kit Out" beats "Kit Out in the Planning Room"; put the detail in "notes".
6. Every node includes "sources", "sinks", "values" arrays (even if empty) and may include a "notes" string.
7. "sources": spendable resources the action creates, with the trigger named ("Energy: kills, objectives").
8. "sinks": spendable resources the action consumes ("Energy: Supply Cache buys").
9. "values": progression the player cannot spend (class XP, account level, a rating). Nothing else goes here: a held currency, starting ammo, a kept item or a buff is a note on the node that uses it.
10. A node that both earns and spends the same resource shows both rows so the balance reads in one place.
11. Every resource that appears as a source somewhere must appear as a sink somewhere, and the reverse; otherwise add the missing node or record the gap in the node's "notes".

Edge rules:
1. Every edge is an object: { "from": "source_id", "to": "target_id", "label": "what moves" }.
2. Edges point only to a later stage. A return (next mission, a buff that changes the next fight) goes to an earlier stage and must carry a label; keep returns to the one or two that matter and avoid sending two returns into the same node.
3. Optional edge type may be "normal", "value", "final", or "cross-lane".
4. Every action node must be reachable from "Spend Time" or "Spend Money".
5. Chains read left to right as trigger, source row, edge, sink row, effect: "Objectives give energy, energy buys perks, perks give squad buffs" must be visible as nodes and edges.

Prefer compact, high-signal diagrams over exhaustive detail.

Generate the complete JSON for "[Specify Game Title Here]" following these exact requirements.
```

After generation, run the JSON through the site's `Edit JSON` import or the MCP `validate_diagram` tool. Fix every routing issue, and act on each standard warning: shorten a title, remove a root's rows, move a currency out of the orange values, add the missing trigger or spend node, label a return edge, or record the unknown in the notes (v2) or in research.limitations (v3).
