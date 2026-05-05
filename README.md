# Economy-Flow Builder (FigJam)

Generate compact economy flow charts in FigJam from a structured JSON spec. The v2 renderer uses explicit left-to-right stages and vertical lanes, keeps connectors behind opaque cards, and validates route geometry so dense game-economy diagrams remain readable.

## Features
*   **v2 JSON Schema:** Define stages, lanes, nodes, and typed edges directly instead of relying on inferred columns.
*   **Two-Way Sync:** Regenerate from JSON, then edit plugin-created cards and sync labels/resources/edges back into the stored v2 schema.
*   **Compact Stage/Lane Layout:** Render only the active lane regions needed for readability, with terminal outcomes kept in the final stage.
*   **Customizable Colors:** Use the UI color pickers to customize the colors for inputs, sinks, sources, and other node types to match your theme.
*   **Pre-built Templates:** Load migrated v2 examples such as Apex Legends, Rainbow Six Siege, Helldivers, and Dice Throne Digital.
*   **In-depth Validation:** Receive clear, specific error messages for invalid JSON structure, ensuring your data is correct before generation.
*   **Routed Connectors:** Typed connector styles, deterministic port slots, and shared junction routes reduce line/card overlap and fan-out clutter.
*   **Provider-Aware Research:** The Research tab can call a local API backed by Gemini, OpenAI, or Claude/Anthropic and request v2 JSON output.
*   **FigJam-Optimized:** Designed and built exclusively for FigJam.

An example `helldivers.json` can be found in the `/examples` directory.

---

## Update Log

### Current - v2 Compact Renderer

#### Breaking Schema
- The primary renderer now expects `schemaVersion: 2`.
- Diagrams are modeled with ordered `stages`, ordered `lanes`, `nodes` assigned to stage/lane cells, and object-form `edges`.
- Old `inputs`/inferred-column diagrams should be migrated to v2 examples rather than adapted at runtime.

#### Compact Rendering
- Cards are smaller, lane bands are subtle active-region guides, and final-good outcomes stay in the terminal stage while aligning near their incoming sources.
- Connectors are built in a dedicated connector layer, then card groups are forced back above connectors so lines run behind opaque cards.
- High fan-out sources can use shared junction routes to keep repeated relationships visually tighter.

#### QA Evidence
- Apex Legends and Rainbow Six Siege were validated in a disposable FigJam file with 0 non-endpoint route/card intersections and connector children behind cards.
- Screenshot evidence is saved at `/tmp/economy-flow-plugin-qa/v2-apex-compact.png` and `/tmp/economy-flow-plugin-qa/v2-rainbow-six-compact.png`.

#### Adjacent Features
- Research generation now passes `provider: "gemini" | "openai" | "claude"` to the local API and can load provider-specific keys from local secret stores at build time.
- GitHub submission opens a draft file page for the configured repository: `https://github.com/econosopher/figma-economy-flow-builder`.
- Sync from Canvas preserves the stored v2 stage/lane schema for plugin-created diagrams; it is not an OCR/import-from-screenshot feature.

### Version 1.2.50 - AI-Powered Economy Generation

#### New Features
- **AI Economy Generation**: Generate complete economy JSONs using Google's Gemini AI
  - Enter any game name and get a full economy structure in 30-60 seconds
  - Three depth levels for different analysis granularity
  - Secure API key storage in Figma
  - Free tier supports 1,500 requests per day
  - See [API_KEY_SETUP.md](./API_KEY_SETUP.md) for setup instructions

### Version 1.2.45 - Research Panel & Simplified JSON

#### New Features
- **Research Panel (Beta)**: New tab interface for deep economy research
  - Dedicated research tab with API key management
  - Game name input for targeted research
  - Secure local storage of API keys
  - Integration with main builder for seamless workflow
  - Foundation for AI-powered economy analysis

#### JSON Improvements  
- **Simplified Node Structure**: `sources`, `sinks`, and `values` arrays are now optional
  - No need to include empty arrays anymore
  - Cleaner, more concise JSON specifications
  - Backward compatible with existing JSON files

### Version 1.2.39 - Post-Publication Updates

Since the initial publication to the Figma Community, we've made several significant improvements:

#### Visual Improvements
- **Automatic Legend Generation**: A new legend section is automatically created showing all currencies organized by type (Sinks, Sources, Stores of Value)
- **Improved Node Spacing**: Reduced vertical padding between nodes by 50% (from 60px to 30px to 21px) for more compact layouts
- **Better Alignment**: Fixed parent-child node alignment to ensure connected nodes are visually aligned
- **Subsection Margins**: Added proper margins around initial sink nodes (Time/Money) so they're not flush against section edges
- **Consistent Node Sizes**: Initial sink nodes now use the same dimensions as action boxes (144x90) for visual consistency

#### Technical Improvements
- **Advanced Collision Detection**: New collision detection system prevents nodes from overlapping, especially in complex diagrams
- **Smarter Layout Engine**: Improved topological sorting and column-based placement for better automatic layouts
- **Edge Routing**: Enhanced connector routing to prevent edge crossings and overlaps
- **Performance**: More efficient node positioning algorithm that handles large diagrams better

#### JSON Structure Changes
- **IMPORTANT**: Changed `"kind": "finalGood"` to `"kind": "final_good"` for consistency with snake_case naming convention
- All other JSON structure remains backward compatible

#### Bug Fixes
- Fixed issue where some nodes (like "Spend Money") could be hidden behind others
- Resolved sync issues when importing diagrams created outside the plugin
- Fixed legend section height calculation to contain all items
- Corrected spacing values to use whole integers for better alignment

#### Documentation
- Added comprehensive LLM prompt instructions for generating economy JSONs
- Created separate `LLM_INSTRUCTIONS.md` file for easy reference
- Updated all examples to use the new `final_good` naming convention

---

## 1  Prerequisites

| Tool | Install |
|------|---------|
| **Node ≥ 18 LTS** | `brew install node` |
| **TypeScript** | `npm i -g typescript` |
| **Figma typings** | `npm i -D @figma/plugin-typings` |

*(If you prefer local deps, run `npm init -y && npm i -D typescript @figma/plugin-typings` and commit `package.json`.)*

---

## 2  Build

```bash
cd economy_flow_plugin
npm install
npm run build
```

This installs dependencies and runs the build script, which compiles TypeScript in `src/` to `dist/` and bundles with `ui.html` into the final `code.js`.
Note: Source of truth is `src/` TypeScript; `code.js` is the build output.

---

## 3  Usage

1.  **Open the plugin:** In any FigJam file, run **Plugins → Development → Economy‑Flow Builder**.
2.  **Choose a Template (Optional):** Select a migrated v2 example from the template dropdown to pre-fill the JSON. A confirmation will appear if you have existing JSON.
3.  **Customize Colors (Optional):** Use the color pickers to change the default colors for different node types.
4.  **Provide JSON:** Write or paste your flowchart definition into the main text area.
5.  **Validate JSON (Optional):** Click "Validate JSON" to check formatting and references without drawing.
6.  **Generate from JSON:** Click the "Generate from JSON" button. The plugin will validate your JSON and render the diagram on the canvas.
7.  **Sync from Canvas:** Modify plugin-created cards/connectors, then click "Sync from Canvas" to update labels, resources, and edges while preserving the stored v2 stages/lanes.
8.  **Copy JSON:** Click "Copy JSON" to copy the current JSON to your clipboard.
9.  **Clear:** Click "Clear Canvas" to remove all elements created by the plugin.

---

## Economic Concepts in Game Design

When modeling game economies, it's important to distinguish between different types of resources:

### Sources (Green)
Resources that players **gain** and can **spend** elsewhere in the game economy. These are tradeable/spendable currencies.
- Examples: Gold, Gems, Coins, Premium Currency

### Sinks (Red)  
Resources that are **consumed** or **required** by an action. These create demand in the economy.
- Examples: Energy, Stamina, Currency costs, Time

### Stores of Value (Orange)
Resources that players **accumulate** but **cannot spend directly**. These represent progress, achievement, or unlock thresholds. They often gate content or provide passive benefits when reaching milestones.

**Key characteristics:**
- Cannot be traded or spent
- Typically only increase (rarely decrease)
- Often unlock content, abilities, or rewards at certain thresholds
- Represent player investment and progression

**Examples:**
- **Player XP**: Accumulates to increase player level, unlocking new content
- **Achievement Points**: Track overall game completion
- **Mastery Points**: Show expertise with specific characters/weapons
- **Battle Pass XP**: Progress through seasonal reward tracks
- **Reputation**: Standing with factions that unlocks rewards

**Economic Purpose:** Stores of Value create long-term engagement goals and provide a sense of progression without inflating the spendable currency economy. They reward time investment and skill development.

---

## JSON Data Structure

The primary renderer uses a breaking v2 schema. The required top-level keys are `schemaVersion`, `stages`, `lanes`, `nodes`, and `edges`.

### `schemaVersion`

Must be exactly `2`.

### `stages`

Ordered left-to-right columns. Use semantic labels rather than generic names such as "Stage 2".

```json
"stages": [
  { "id": "entry", "label": "Player Investment" },
  { "id": "play", "label": "Core Play" },
  { "id": "terminal", "label": "Final Goods", "terminal": true }
]
```

### `lanes`

Ordered vertical swimlanes. Lanes organize related loops without forcing every stage/lane cell to render as a large box.

```json
"lanes": [
  { "id": "free_play", "label": "Free Play" },
  { "id": "monetization", "label": "Monetization" },
  { "id": "identity", "label": "Identity" }
]
```

### `nodes`

Nodes must reference an existing `stageId`. Non-terminal nodes normally reference a `laneId`; terminal final-good nodes can omit `laneId` and the compact renderer will align them near their incoming sources inside the terminal stage.

```json
{
  "id": "play_ranked_matches",
  "label": "To Play Ranked Matches",
  "stageId": "play",
  "laneId": "free_play",
  "values": ["Ranked XP"],
  "sources": ["Match Rewards"]
}
```

Supported node fields:
- `id`: unique snake_case id.
- `label`: card label, usually an action phrase beginning with "To".
- `stageId`: required stage id.
- `laneId`: optional lane id.
- `kind`: set to `"final_good"` for terminal outcomes.
- `sources`: optional spendable resources gained, rendered as green chips.
- `sinks`: optional resources consumed, rendered as red chips.
- `values`: optional stores of value/progress, rendered as orange chips.

### `edges`

Edges are objects with `from`, `to`, and optional `type`.

```json
"edges": [
  { "from": "spend_time", "to": "play_ranked_matches", "type": "normal" },
  { "from": "play_ranked_matches", "to": "increase_rank", "type": "value" },
  { "from": "increase_rank", "to": "prove_skill", "type": "final" }
]
```

Supported edge types:
- `normal`: default flow.
- `value`: progress/store-of-value flow.
- `final`: route into a final-good outcome.
- `cross-lane`: route between lanes.

### Minimal Example

```json
{
  "schemaVersion": 2,
  "name": "Example Game",
  "stages": [
    { "id": "entry", "label": "Player Investment" },
    { "id": "play", "label": "Core Play" },
    { "id": "terminal", "label": "Final Goods", "terminal": true }
  ],
  "lanes": [
    { "id": "core", "label": "Core Loop" },
    { "id": "monetization", "label": "Monetization" }
  ],
  "nodes": [
    { "id": "spend_time", "label": "Spend Time", "stageId": "entry", "laneId": "core", "kind": "initial_sink_node" },
    { "id": "spend_money", "label": "Spend Money", "stageId": "entry", "laneId": "monetization", "kind": "initial_sink_node" },
    { "id": "play_matches", "label": "To Play Matches", "stageId": "play", "laneId": "core", "sources": ["Soft Currency"], "values": ["Account XP"] },
    { "id": "buy_cosmetics", "label": "To Buy Cosmetics", "stageId": "play", "laneId": "monetization", "sinks": ["Premium Currency"] },
    { "id": "show_identity", "label": "To Show Identity", "stageId": "terminal", "kind": "final_good" }
  ],
  "edges": [
    { "from": "spend_time", "to": "play_matches" },
    { "from": "spend_money", "to": "buy_cosmetics" },
    { "from": "play_matches", "to": "show_identity", "type": "final" },
    { "from": "buy_cosmetics", "to": "show_identity", "type": "final" }
  ]
}
```

### AI Prompt for JSON Generation

Use `LLM_INSTRUCTIONS.md` or the Research tab for the current v2 prompt. The important constraints are:
- Output a single raw JSON object with `schemaVersion: 2`.
- Preserve explicit `stages` and `lanes`; do not use legacy `inputs` or `subsections`.
- Assign every node to a real `stageId`, and use semantic stage/lane labels.
- Keep final-good nodes in a terminal stage.
- Use object-form edges and choose `normal`, `value`, `final`, or `cross-lane` when the relationship is clear.
- Keep currency names consistent across `sources`, `sinks`, and `values`.

### Persistence

The plugin stores the most recent rendered v2 JSON and chosen colors in Figma client storage. Sync from Canvas uses that stored graph to preserve stages and lanes while reading edited plugin-created cards/connectors back from FigJam.

## 4  Files

| File | Purpose |
|------|---------|
| `manifest.json` | Minimal manifest (`main: "code.js"`) |
| `src/` | Main plugin logic (TypeScript source) |
| `build.js` | Bundles `src/main.ts` → `code.js` with esbuild |
| `ui.html` | UI layout, styling, and client-side script |
| `tsconfig.json` | Compiler config with Figma typings |
| `.gitignore` | Ignores `node_modules/` and `code.js` |
| `/examples` | Example preset JSON files (include `name`). |

---

## 5  CLI quick‑start from ~ (macOS)

```bash
# clone repo (or move unzipped folder)
cd ~/economy_flow_plugin
npm install
npm run build         # compile and bundle
open -a Figma .       # open Figma and import the manifest
```

Happy diagramming!

---

## 6  Testing

- Requirements: Node >= 18
- Commands:
  - `npm run test`: Runs Jest unit tests (ts-jest)
  - `npm run test:watch`: Watch mode

### Covered Areas
- Validation: v2 stages/lanes/nodes/edges, snake_case IDs, references, terminal final-good placement, cycle detection
- Layout: compact stage/lane placement, final-stage alignment, high fan-out junctions, route/card intersection avoidance
- Rendering: connector layer ordering, opaque cards above lines, edge-type styling
- Sync: plugin-created FigJam cards/connectors back into the stored v2 schema using Figma API mocks
- Legend: currency extraction and section building

If you see failures due to environment (older Node), upgrade Node to 18 LTS.
