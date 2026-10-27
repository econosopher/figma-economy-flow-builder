/**
 * The GEC economy-flow rules contract, machine-readable.
 *
 * `docs/ECONOMY_FLOW_RULES.md` is the editable human source. This module mirrors its
 * version, framework source and every `## GEC-nnn - Title` section verbatim; the test in
 * `tests/standard.test.ts` fails when the two drift. The Markdown is not imported at
 * build time because the Worker bundle (Wrangler/esbuild) has no `?raw` loader.
 */
export const ECONOMY_FLOW_RULES_VERSION = "2026.10.27";
export const ECONOMY_FLOW_RULES_SOURCE =
  "https://www.gameeconomistconsulting.com/economy-diagramming-using-figma-ai/";

export interface EconomyFlowRule {
  id: string;
  title: string;
  statement: string;
}

export const ECONOMY_FLOW_RULES: readonly EconomyFlowRule[] = [
  {
    id: "GEC-001",
    title: "Anchor the economy in player action",
    statement:
      "Model player actions as the economy's structure. Currencies explain debits and credits within that action flow; they do not replace the actions themselves.",
  },
  {
    id: "GEC-002",
    title: "Begin with Time and Money",
    statement:
      "Every full diagram contains fixed `Time` and `Money` roots. Each root is an `initial_sink_node`, rendered with the red investment treatment and no minus resource row. A connection from either root must be supplied in `rootConnections` and carry a rationale plus its provenance basis.",
  },
  {
    id: "GEC-003",
    title: "Show spendable-resource debits and credits",
    statement:
      "Green plus and red minus resource rows represent supported credits and debits of spendable resources. This includes currencies and quantities of materials or inventory that the activity genuinely creates or consumes. Progression, access, and outcome concepts do not become plus or minus rows unless they also have an independently supported spendable-resource role.",
  },
  {
    id: "GEC-004",
    title: "Reserve orange for nonspendable progression",
    statement:
      "Orange values represent accumulated progression that cannot be spent, such as player XP. Holding a currency, key, material, or inventory item does not make it an orange value. Held resources remain neutral notes.",
  },
  {
    id: "GEC-005",
    title: "Identify the final player benefit",
    statement:
      "A `final_good` is a terminal player benefit: the entertainment benefit, expressive benefit, mastery, status, collection, access, or other bedrock motivation that the production chain ultimately serves. Currency, materials, inventory, a balance change, and generic reward ownership are economic outputs rather than final player benefits. The resource-producing or consuming activity remains a black action card. When the evidence packet supplies a distinct player-benefit interpretation and rationale and the classifier accepts it, the compiler adds a separate terminal yellow benefit card and a traceable analytical benefit edge from the action.",
  },
  {
    id: "GEC-006",
    title: "Do not invent wiring",
    statement:
      "Compile only supplied root connections and accepted candidate relationships. Shared resource names, adjacent ordering, or plausible game-design patterns do not establish a connection. Missing wiring is flagged; it is never silently repaired.",
  },
  {
    id: "GEC-007",
    title: "Make accepted actions reachable",
    statement:
      "Every accepted action should have a directed path from `Time` or `Money` through supplied and accepted relationships. The compiler reports each unreachable action and each unused fixed root. These issues identify evidence or relationship work that remains; they are not permission to synthesize edges.",
  },
  {
    id: "GEC-008",
    title: "Preserve one complete grouped view",
    statement:
      "The full view contains both fixed roots, every accepted action, every accepted relationship, and the background groups that communicate system membership. Focused and aggregated views may still exist, but they are not substitutes for the full connected diagram.",
  },
  {
    id: "GEC-009",
    title: "Expose uncertainty",
    statement:
      "Unknown classifications, low-confidence answers, conflicting or unclear evidence, stale contract states, missing connections, and unsupported final-good candidates remain explicit review or graph issues.",
  },
  {
    id: "GEC-010",
    title: "Make return wiring explicit",
    statement:
      "A directed cycle is valid only when the return relationship is explicitly classified as feedback. A non-feedback cycle is inconsistent with the left-to-right production view and fails compilation.",
  },
  {
    id: "GEC-011",
    title: "Keep roots free of resource rows",
    statement:
      "A root (`Spend Time`, `Spend Money`, or the fixed `Time` and `Money` roots) is an `initial_sink_node` card and carries no source, sink or value rows. The red investment treatment already says that player time or real money goes in; a `- Player time` or `- Real money` row counts it twice. What the investment buys is shown on the first action card the root connects to.",
  },
  {
    id: "GEC-012",
    title: "Trace every spendable resource to both ends",
    statement:
      "Before a resource appears on a card, its ledger is researched: the trigger that creates it, who holds it and for how long, every place it is spent, the rules that bound it (caps, counts, gating, resets) and the effect each spend has. In the diagram that ledger reads as a chain: trigger, green plus row, pipe, red minus row, effect. A resource that appears only as a plus row is produced but never spent; one that appears only as a minus row is spent but never produced. Either is a ledger gap: add the counterpart card, or list the unknown in `research.limitations` instead of drawing a guess. A card that both earns and spends the same resource shows both rows so the balance reads in one place.",
  },
  {
    id: "GEC-013",
    title: "Keep card titles to one line",
    statement:
      "A card title fits on one line at the card width: about 22 characters at comfortable spacing. The connector port sits at the vertical middle of the title bar, so a two-line title moves the port and the arrow between a one-line card and a two-line card gets a jog. `Kit Out` beats `Kit Out in the Planning Room`; the detail belongs in the notes.",
  },
  {
    id: "GEC-014",
    title: "Label return pipes and keep them few",
    statement:
      "Every `feedback: true` pipe carries a label that says what returns (`Next mission`, `Buff carries over`). Keep return pipes to the one or two that matter: each one is drawn through the corridor under its group and back into the target's left port, so a card with a forward inbound arrow plus two return pipes shows a bundle of three lines at one port. Route a return into a card without a forward inbound pipe where possible, or merge two returns into one labelled pipe.",
  },
  {
    id: "GEC-015",
    title: "Size cards in a group row alike",
    statement:
      "Cards in the same group row are top-aligned per stage, so their bottoms align only when their heights match. Give cards that sit in the same row the same number of resource rows and roughly the same note length. A tall note on one card and none on its neighbour reads as misalignment. One card per stage in a group row keeps the row flat; a second card in the same stage and group stacks below and pushes the group taller.",
  },
];

export function getRule(id: string): EconomyFlowRule {
  const rule = ECONOMY_FLOW_RULES.find((candidate) => candidate.id === id);
  if (!rule) throw new Error(`Unknown economy flow rule ${id}.`);
  return rule;
}

/** One line per rule, for tool descriptions and classifier prompts. */
export function rulesPrompt(ids?: readonly string[]): string {
  const selected = ids ?? ECONOMY_FLOW_RULES.map((rule) => rule.id);
  return selected
    .map((id) => {
      const rule = getRule(id);
      return `[${rule.id}] ${rule.title}. ${rule.statement.split(/\n\n/)[0].replace(/`/g, "")}`;
    })
    .join("\n");
}

/** The contract as Markdown, served to MCP clients as the `economy-flow://rules` resource. */
export function rulesMarkdown(): string {
  return [
    "# GEC Economy Flow Rules",
    "",
    `Contract version: ${ECONOMY_FLOW_RULES_VERSION}`,
    "",
    `Framework source: ${ECONOMY_FLOW_RULES_SOURCE}`,
    "",
    ...ECONOMY_FLOW_RULES.flatMap((rule) => [
      `## ${rule.id} - ${rule.title}`,
      "",
      rule.statement,
      "",
    ]),
  ].join("\n");
}

/**
 * The working standard an author (or an LLM behind an MCP client) follows before drawing.
 * Served as the `economy_flow_standard` MCP prompt and quoted in the tool descriptions.
 * Wording follows the GEC economy-flow guide; the rule IDs refer to the contract above.
 */
export const STANDARD_GUIDE = `# Economy Flow standard (GEC rules ${ECONOMY_FLOW_RULES_VERSION})

An economy flow is a left-to-right production view of one game system: player inputs on the left, final player benefits on the right, and every resource traced from the trigger that creates it to the place it is spent. Research first, draw second.

## 1. The resource ledger (GEC-012)

Before any resource (energy, ammo, parts, coins, cash, keys) or progression value (XP, levels, ratings) appears on a card, write down five facts and label each one playtest, official, press, player report or not found:

1. Origin: what trigger creates it (which kills, which objective, which purchase, a per-mission allotment, a starting grant). "You start with some" is an origin only if the diagram says who grants it and when.
2. Holder and scope: per player or per squad, per mission or persistent, kept or lost on failure.
3. Spend points: every place it is spent and what each spend buys. A resource spent somewhere the diagram does not show is a missing card.
4. Rules: caps, counts, class or level gating, cooldowns, what resets. A revive count or a parts-to-mod cost belongs here.
5. Effect: what the spend changes for the player and where that effect feeds back into play.

If a fact is unknown, say so in the card notes and in research.limitations. Never promote a guess to a row. Typical gaps: where the starting energy comes from, what drops the crafting parts, how many revives there are, what the coins buy.

## 2. Card semantics (GEC-002 to GEC-005, GEC-011)

- Roots: Spend Time and, when real money is involved, Spend Money are initial_sink_node cards with no resource rows. Never add a "- Player time" or "- Real money" row.
- Green + rows (sources): spendable resources the action creates. Name the trigger in the row or the notes ("Energy: kills, objectives").
- Red - rows (sinks): spendable resources the action consumes ("Energy: Supply Cache buys", "Weapon Parts: buy a mod").
- Orange = rows (values): progression the player cannot spend: class XP, account XP, a level, a rating. Nothing else is orange. Ammo granted at mission start, a held currency, a kept item or a buff is a note on the card that uses it, not an orange row.
- A card that both earns and spends the same resource shows both rows so the balance reads in one place.
- final_good cards are terminal player benefits (mastery, status, expression, a stronger build), never a currency or an inventory count. They sit in the last stage.
- Buffs, perks and modifiers are effects: show them in the notes of the card they change, or as an = row only if they persist as progression.

## 3. Chains, not islands (GEC-006, GEC-007, GEC-010, GEC-014)

- Every resource travels a visible chain: trigger, + row, pipe, - row, effect. Pipe labels say what moves.
- Pipes point only to a later stage. A return (next mission, a buff that changes the next fight) is a feedback: true pipe with a label. Keep return pipes to the one or two that matter.
- Do not wire from shared names or plausibility. If the evidence does not say what coins buy, the coins card has no outgoing pipe and the limitation says so.
- Every action card is reachable from Spend Time or Spend Money.

## 4. Layout and alignment (GEC-013, GEC-015)

The site lays cards out from content; there are no coordinates. The connector port is the vertical middle of the title bar, so keep every title on one line (about 22 characters): "Kit Out" beats "Kit Out in the Planning Room". Cards in the same group row are top-aligned, so give them the same number of rows and similar note length. One card per stage per group keeps a row flat. Use six to eight stages named for the step (Inputs, Kit, Mission, Extraction, Settlement, Rewards, Upgrades, Outcomes); a group is a system (mission economy, progression, modding). Set settings.spacing to "comfortable", keep the legend on and the background white.

## 5. Before saving

Call validate_diagram and resolve every routingIssue; read each standardIssue and either fix the card or record the unknown in research.limitations. Every research.sources entry needs an http(s) URL and a kind of Developer, Platform editorial or Independent analysis; playtest notes go in research.scope. Create new work with create_diagram rather than overwriting an existing diagram.
`;
