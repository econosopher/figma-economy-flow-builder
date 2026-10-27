# GEC Economy Flow Rules

Contract version: `2026.10.27`

Machine-readable implementation: [`web/src/core/rules.ts`](../web/src/core/rules.ts). Validator: [`web/src/core/standard.ts`](../web/src/core/standard.ts), shared by the editor and the MCP server.

Framework source: [Economy Diagramming Using Figma & AI](https://www.gameeconomistconsulting.com/economy-diagramming-using-figma-ai/), Game Economist Consulting, 19 May 2025.

This file is the editable human source for the pilot's economy-diagram semantics. Rule IDs are stable. Edit the wording and increment the contract version when behavior changes; do not reuse an ID for a different rule. The browser and Node pilot bundles expose the current version and deterministic contract hash through `getEconomyFlowRulesMetadata()`.

## GEC-001 - Anchor the economy in player action

Model player actions as the economy's structure. Currencies explain debits and credits within that action flow; they do not replace the actions themselves.

## GEC-002 - Begin with Time and Money

Every full diagram contains fixed `Time` and `Money` roots. Each root is an `initial_sink_node`, rendered with the red investment treatment and no minus resource row. A connection from either root must be supplied in `rootConnections` and carry a rationale plus its provenance basis.

`framework_inference` is permitted for a Time investment when the activity itself is supported and the mapping is an explicit application of the framework. A Money connection requires `source_evidence` and cited evidence. The compiler never creates a root connection from an activity name.

## GEC-003 - Show spendable-resource debits and credits

Green plus and red minus resource rows represent supported credits and debits of spendable resources. This includes currencies and quantities of materials or inventory that the activity genuinely creates or consumes. Progression, access, and outcome concepts do not become plus or minus rows unless they also have an independently supported spendable-resource role.

## GEC-004 - Reserve orange for nonspendable progression

Orange values represent accumulated progression that cannot be spent, such as player XP. Holding a currency, key, material, or inventory item does not make it an orange value. Held resources remain neutral notes.

## GEC-005 - Identify the final player benefit

A `final_good` is a terminal player benefit: the entertainment benefit, expressive benefit, mastery, status, collection, access, or other bedrock motivation that the production chain ultimately serves. Currency, materials, inventory, a balance change, and generic reward ownership are economic outputs rather than final player benefits. The resource-producing or consuming activity remains a black action card. When the evidence packet supplies a distinct player-benefit interpretation and rationale and the classifier accepts it, the compiler adds a separate terminal yellow benefit card and a traceable analytical benefit edge from the action.

Jev may accept a supported final-good candidate automatically. It does not require a separate manual approval. The accepted interpretation and rationale remain visible in the compiled card. Unknown or conflicting candidates remain review issues.

## GEC-006 - Do not invent wiring

Compile only supplied root connections and accepted candidate relationships. Shared resource names, adjacent ordering, or plausible game-design patterns do not establish a connection. Missing wiring is flagged; it is never silently repaired.

## GEC-007 - Make accepted actions reachable

Every accepted action should have a directed path from `Time` or `Money` through supplied and accepted relationships. The compiler reports each unreachable action and each unused fixed root. These issues identify evidence or relationship work that remains; they are not permission to synthesize edges.

## GEC-008 - Preserve one complete grouped view

The full view contains both fixed roots, every accepted action, every accepted relationship, and the background groups that communicate system membership. Focused and aggregated views may still exist, but they are not substitutes for the full connected diagram.

## GEC-009 - Expose uncertainty

Unknown classifications, low-confidence answers, conflicting or unclear evidence, stale contract states, missing connections, and unsupported final-good candidates remain explicit review or graph issues.

## GEC-010 - Make return wiring explicit

A directed cycle is valid only when the return relationship is explicitly classified as feedback. A non-feedback cycle is inconsistent with the left-to-right production view and fails compilation.

## GEC-011 - Keep roots free of resource rows

A root (`Spend Time`, `Spend Money`, or the fixed `Time` and `Money` roots) is an `initial_sink_node` card and carries no source, sink or value rows. The red investment treatment already says that player time or real money goes in; a `- Player time` or `- Real money` row counts it twice. What the investment buys is shown on the first action card the root connects to.

## GEC-012 - Trace every spendable resource to both ends

Before a resource appears on a card, its ledger is researched: the trigger that creates it, who holds it and for how long, every place it is spent, the rules that bound it (caps, counts, gating, resets) and the effect each spend has. In the diagram that ledger reads as a chain: trigger, green plus row, pipe, red minus row, effect. A resource that appears only as a plus row is produced but never spent; one that appears only as a minus row is spent but never produced. Either is a ledger gap: add the counterpart card, or list the unknown in `research.limitations` instead of drawing a guess. A card that both earns and spends the same resource shows both rows so the balance reads in one place.

## GEC-013 - Keep card titles to one line

A card title fits on one line at the card width: about 22 characters at comfortable spacing. The connector port sits at the vertical middle of the title bar, so a two-line title moves the port and the arrow between a one-line card and a two-line card gets a jog. `Kit Out` beats `Kit Out in the Planning Room`; the detail belongs in the notes.

## GEC-014 - Label return pipes and keep them few

Every `feedback: true` pipe carries a label that says what returns (`Next mission`, `Buff carries over`). Keep return pipes to the one or two that matter: each one is drawn through the corridor under its group and back into the target's left port, so a card with a forward inbound arrow plus two return pipes shows a bundle of three lines at one port. Route a return into a card without a forward inbound pipe where possible, or merge two returns into one labelled pipe.

## GEC-015 - Size cards in a group row alike

Cards in the same group row are top-aligned per stage, so their bottoms align only when their heights match. Give cards that sit in the same row the same number of resource rows and roughly the same note length. A tall note on one card and none on its neighbour reads as misalignment. One card per stage in a group row keeps the row flat; a second card in the same stage and group stacks below and pushes the group taller.

## Validator coverage

`checkStandard()` in `web/src/core/standard.ts` runs in the editor's JSON import, in the MCP `validate_diagram`, `preview_changes`, `create_diagram`, `edit_diagram` and `render_diagram` results (`standardIssues`), and in the test suite. It never blocks a save: a warning names the card, pipe or resource so the author can fix it or record the unknown. The hard errors below stay in `validateDocument()`, which does block a save.

| Rule | Check | Severity |
| --- | --- | --- |
| GEC-004 | A value (orange) row named like a currency or inventory, or whose resource also appears as a plus or minus row on another card | warning |
| GEC-005 | A `final_good` outside the last stage | error |
| GEC-007 | A card with no directed path from a root | warning |
| GEC-010 | A non-feedback pipe to the same or an earlier stage | error |
| GEC-011 | A root card with a source, sink or value row | warning |
| GEC-012 | A resource that appears only as a plus row or only as a minus row across the diagram, unless `research.limitations` names it | warning |
| GEC-013 | A card title that wraps to a second line at the document's spacing | warning |
| GEC-014 | A feedback pipe with no label; more than two feedback pipes in a diagram; two or more feedback pipes entering one card | warning |
| GEC-015 | A group row whose shortest card is much shorter than its tallest | warning |

Resource names are matched on the part before a colon, dash or bracket, lower-cased; a shorter name matches a longer one when it is a word-prefix of it (`Weapon Parts` matches `Weapon Parts kept`). Ledger facts that are prose (who holds a resource, the exact rules, the effect of a spend, the evidence grade) are not checked; they stay the author's research task and belong in card notes, `research.sources` and `research.limitations`.

## Structured input fields

`rootConnections` is an artifact-level array:

```json
{
  "id": "root_time_play_match",
  "root": "time",
  "toActivityId": "act_play_match",
  "basis": "framework_inference",
  "rationale": "Playing a match is a direct investment of player time.",
  "evidenceIds": ["ev_match"]
}
```

Money connections use `"basis": "source_evidence"` and cite the evidence for the purchase activity.

An activity may expose a player-benefit candidate:

```json
{
  "playerBenefitCandidate": {
    "interpretation": "Collection and self-expression",
    "rationale": "The terminal cosmetic is retained and selected for player expression.",
    "evidenceIds": ["ev_cosmetic"]
  }
}
```

The candidate makes `final_good` available to the classifier. It does not force acceptance.

## Compatibility

Classification states record the contract version and hash. States written before this contract remain readable and are marked `stale`; their answers are not presented as current-rule classifications. The legacy `input` activity role no longer creates an input card, and the legacy `outcome` role compiles as an ordinary action. Fixed roots and accepted player-benefit final goods use the current contract semantics.
