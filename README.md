# Economy-Flow Builder (FigJam)

Generate economy flow-charts in FigJam from a simple JSON spec. This plugin intelligently lays out nodes and their connections, creating clear and readable diagrams. It offers features like two-way JSON syncing, customizable colors, pre-built templates, and detailed validation to streamline your workflow.

## Features
*   **JSON-Powered:** Define your entire flowchart structure using a simple and editable JSON format.
*   **Two-Way Sync:** Modify the diagram on the canvas and sync it back to JSON, or generate the diagram from your JSON spec.
*   **Subsections:** Organize complex flows by grouping related nodes into visual sections with custom colors.
*   **Customizable Colors:** Use the UI color pickers to customize the colors for inputs, sinks, sources, and other node types to match your theme.
*   **Pre-built Templates:** Get started instantly with "basic" and "complex" example templates.
*   **In-depth Validation:** Receive clear, specific error messages for invalid JSON structure, ensuring your data is correct before generation.
*   **Auto-Layout:** Automatically arranges nodes and connections for a clean and readable layout.
*   **FigJam-Optimized:** Designed and built exclusively for FigJam.

An example `helldivers.json` can be found in the `/examples` directory.

---

## Update Log

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
2.  **Choose a Template (Optional):** Select a "Basic" or "Complex" example from the "Start with a template" dropdown to pre-fill the JSON. A confirmation will appear if you have existing JSON.
3.  **Customize Colors (Optional):** Use the color pickers to change the default colors for different node types.
4.  **Provide JSON:** Write or paste your flowchart definition into the main text area.
5.  **Validate JSON (Optional):** Click "Validate JSON" to check formatting and references without drawing.
6.  **Generate from JSON:** Click the "Generate from JSON" button. The plugin will validate your JSON and render the diagram on the canvas.
7.  **Sync from Canvas:** Modify the diagram, then click "Sync from Canvas" to update the JSON spec.
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

The plugin uses a JSON object to define the flowchart. This object has the following properties:

### `name` (optional)
A string that names the economy or game. If provided, the plugin titles the main section as `<name> Economy` (so use just the game name — don’t include the word “Economy”). If not provided, defaults to `"EconomyFlowChart Section"`.

**Example:**
```json
"name": "Apex Legends"
```

### `inputs`
An array of objects representing the starting points of your economy, like "Time" or "Money". These are typically rendered as red boxes on the far left.

*   `id` (string, required): A unique identifier for this input.
*   `label` (string, required): The text displayed inside the box.
*   `kind` (string, required): Must be set to `"initial_sink_node"`.

**Example:**
```json
"inputs": [
  { "id": "time", "label": "Time", "kind": "initial_sink_node" },
  { "id": "money", "label": "Money", "kind": "initial_sink_node" }
]
```

### `nodes`
An array of objects representing the actions, activities, or states in your flow.

*   `id` (string, required): A unique identifier for this node.
*   `label` (string, required): The text for the node's main box.
*   `kind` (string, optional): Set to `"final_good"` to render a special "Final Good" box. Otherwise, it's a standard white action box.
*   `sources` (array of strings, optional): Resources *gained* that can be spent elsewhere (e.g., Gold, Gems). Rendered as green attribute boxes. **Can be omitted if empty.**
*   `sinks` (array of strings, optional): Resources *consumed* from elsewhere (e.g., Energy, Gold). Rendered as red attribute boxes. **Can be omitted if empty.**
*   `values` (array of strings, optional): **Stores of Value** - Resources that accumulate but CANNOT be spent directly (e.g., XP, Level, Achievement Points). Rendered as orange attribute boxes. **Can be omitted if empty.**

**Examples:**
```json
// With resources
"nodes": [
  {
    "id": "complete_mission",
    "label": "To Complete Mission Objectives",
    "sources": ["Player XP", "Stratagem Slips", "Warbond Credits"]
  }
]

// Without resources - much cleaner!
"nodes": [
  {
    "id": "unlock_feature",
    "label": "To Unlock Feature"
  }
]
```

### `edges`
An array that defines the connections between your `inputs` and `nodes`. Each edge is a pair `[from_id, to_id]` (exactly two strings). The graph must be acyclic (no cycles).

*   `from_id` (string): The `id` of the starting node for the connection.
*   `to_id` (string): The `id` of the ending node for the connection.

**Example:**
```json
"edges": [
  ["time", "start_missions"],
  ["start_missions", "complete_mission"]
]
```

### `subsections` (optional)
An array of objects that group related nodes into visual sections within the diagram. This helps organize complex flows into logical areas.

*   `id` (string, required): A unique identifier for this subsection.
*   `label` (string, required): The name displayed for the subsection.
*   `nodeIds` (array of strings, required): IDs of nodes that belong in this subsection.
*   `color` (string, optional): Hex color for the subsection background (e.g., "#E3F2FD").

**Important**: Do NOT create a subsection for "Final Goods". Nodes with `kind: "final_good"` should remain at their natural positions as terminal nodes in their respective flows.

**Example:**
```json
"subsections": [
  {
    "id": "onboarding",
    "label": "New Player Experience",
    "nodeIds": ["tutorial", "first_match"],
    "color": "#E3F2FD"
  },
  {
    "id": "core_loop",
    "label": "Core Gameplay",
    "nodeIds": ["daily_quest", "pvp_match"]
  }
]
```

---

### AI Prompt for JSON Generation

To quickly generate a new flowchart, you can use the following prompt with a capable AI assistant (like Google's Gemini or OpenAI's GPT-4). This prompt instructs the AI to research a game's economy and format the findings into the specific JSON structure required by this plugin.

```text
You are an expert video game economist and analyst. Your task is to research the economy and player progression systems of the game "[Specify Game Title Here]". Based on your research, generate a JSON object that models the core gameplay loops, resource flows, and progression paths.

The most valuable economy diagram anchors in player action, where currencies play a secondary role. All diagrams start with either spending time or money (**`inputs`**), the two raw ingredients that all output derives from in games. Each further step is an action-driven refinement of the last stage (**`nodes`**). Along the way, usually deriving from the final production step, is a “final” good (`kind`=`"final_good"`). This is ultimately what entertainment produces, or the “bedrock”, akin to appealing to a Bartle-type or higher emotional need, for example, the need to collect, win, or dominate others.

Goods with Green + (`sources`) or Red - (`sources`) are currencies that maintain debits and credits, while player XP (`values`) is orange, a store of value, since players can’t “spend” XP. There are other systems in games that are "tallies", and that's what we're tracking here. Eventually, this will lead to a node that triggers a level-up (usually) or a collection event (such as a milestone or quest system) that sources rewards.

The output MUST be a single, complete JSON object. Required top-level keys: `inputs`, `nodes`, and `edges`. Optional keys: `name`, `subsections`.

### Critical JSON Structure Rules:

1. **PREFER RAW JSON**: Output ONLY the JSON object (no explanations before/after). Avoid wrapping in markdown fences if possible (the plugin will attempt to extract JSON if it happens).
2. **NO TRAILING COMMAS**: Never put a comma after the last item in any array or object.
3. **SIMPLIFIED NODE ARRAYS**: The `sources`, `sinks`, and `values` properties are now OPTIONAL:
```
   ```json
   // Preferred - omit empty arrays
   {
     "id": "example_node",
     "label": "Example Node"
   }
   
   // Also valid - explicit empty arrays
   {
     "id": "example_node",
     "label": "Example Node",
     "sources": [],
     "sinks": [],
     "values": []
   }
   ```
4. **NEVER LEAVE EMPTY VALUES**: If you DO include a property, it MUST have a value:
   - WRONG: `"sources":,` or `"sinks":,` or `"values":,`
   - CORRECT: Omit the property entirely OR use `"sources": []`
5. **PROPERTY INITIALIZATION**: When including `sources`, `sinks`, or `values`:
   - With items: `"sources": ["Gold", "XP"]`
   - Empty array: `"sources": []`
   - Omitted entirely: (no property at all)
   - NEVER just a comma: `"sources":,` ← THIS WILL CAUSE JSON PARSING ERRORS
6. **CONSISTENT ID FORMAT**: All `id` values must be lowercase with underscores (snake_case). Example: `daily_quest`, not `dailyQuest` or `DailyQuest`.
7. **VALID EDGES**: Every edge must connect existing nodes. Each edge is a two-element array: `["from_id", "to_id"]`.

### JSON Structure Specification:

1. **`inputs`** (required array): These are how every game economy starts, players invest time and/or money.
   - `id` (string): Unique snake_case identifier
   - `label` (string): Display name (e.g., "Time", "Money")
   - `kind` (string): MUST be exactly `"initial_sink_node"`

2. **`nodes`** (required array): These are the actions that derive from the last box. For example, a series of connected strings might have this sequence (Spend Time -> To Play Matches (Player XP) -> To Level Up (+Currency) -> To Spend on Cosmetics (-Currency) -> Final Good: "To Peacock in Front of Other Players")
   - `id` (string): Unique snake_case identifier
   - `label` (string): Descriptive name that starts with "To" (e.g., "To Complete Daily Quests")
   - `sources` (array of strings, optional): Resources GAINED that can be spent elsewhere (e.g., ["Gold", "Crafting Materials"]) - OMIT IF NONE
   - `sinks` (array of strings, optional): Resources CONSUMED from elsewhere (e.g., ["Energy", "Gold"]) - OMIT IF NONE
   - `values` (array of strings, optional): Stores of value that accumulate but CANNOT be spent (e.g., ["Player XP", "Achievement Points"]) - OMIT IF NONE
   - `kind` (string, optional): Set to `"final_good"` for ultimate goals/win conditions

3. **`edges`** (required array): Connections showing flow between nodes.
   - Each edge is an array: `["from_id", "to_id"]`
   - `from_id` and `to_id` must match existing node/input ids

4. **`subsections`** (optional array): Visual groupings of related nodes.
   - `id` (string): Unique identifier for the subsection
   - `label` (string): Display name for the group
   - `nodeIds` (array): List of node ids to include in this subsection
   - `color` (string, optional): Hex color like "#FF5733"
   - **IMPORTANT**: Do NOT create a subsection for final goods. Final goods (`kind: "final_good"`) are terminal nodes that should be distributed throughout the diagram where they naturally conclude their respective flows

### Key Distinctions:

**Sources vs Sinks vs Values:**
- **Sources**: Resources gained that CAN be spent elsewhere (currencies, materials)
- **Sinks**: Resources consumed that come from elsewhere (but NOT Time/Money if they come directly from initial inputs via edges)
- **Values**: Metrics that accumulate but CANNOT be spent (player XP, achievement scores)

**Currency Type Consistency:**
- Once you define a currency as a source, sink, or value, it MUST remain that type throughout the entire economy
- A currency cannot be both a source in one node and a value in another
- Choose the type based on the currency's primary function in the game economy

**Examples:**
- Completing a quest might have:
  - sources: ["100 Gold", "5 Gems"] (can spend these elsewhere)
  - sinks: ["10 Energy"] (consumed from your energy pool)
  - values: ["500 XP", "1 Achievement Point"] (accumulate but can't spend)
- WRONG: "To Purchase Premium Currency" with edge from "Spend Money" and sinks: ["Money"]
- CORRECT: "To Purchase Premium Currency" with edge from "Spend Money" and sinks: []
- WRONG: Using "Free Cosmetics" and "Premium Cosmetics" as different currencies
- CORRECT: Using "Cosmetics" in both free and premium paths
- WRONG: "Victory Points" as a source in one node and a value in another
- CORRECT: "Victory Points" consistently as either a source OR a value throughout

### Example of a Properly Formatted Node

```json
{
  "id": "play_matches",
  "label": "To Play Matches",
  "sources": ["Gold", "XP"],    // Has sources
  "sinks": ["Energy"],          // Has sinks
  "values": ["Battle Pass XP"]  // Has values
}
```

### Example of a Node with No Resources (SIMPLIFIED)

```json
{
  "id": "unlock_feature",
  "label": "To Unlock Feature"
  // No sources, sinks, or values - much cleaner!
}
```

### Research Focus

1. Start with primary player  **`inputs`** (time and/or money)
2. Map out how **`nodes`** lead to additional "To" actions leading to more "To" **`nodes`**, all the way to a final good you define (`kind`=`"final_good"`)
3. For each **`node`** that is NOT `kind`=`"final_good"`, determine:
   * What it consumes (sinks) - use empty array `[]` if nothing
   * What spendable resources it produces (sources) - use empty array `[]` if nothing
   * What progress it accumulates (values) - use empty array `[]` if nothing
   * **CRITICAL RULE**: If a node receives Time or Money directly via an edge from the initial inputs, do NOT list "Time" or "Money" as a sink. The edge connection already represents this consumption. Only list resources as sinks if they come from other nodes' sources
4. Trace flow connections between activities
5. REMEMBER: The `sources`, `sinks`, and `values` properties are OPTIONAL - omit them if empty
6. **Currency Consistency Rules**:
   * Each currency/resource must be ONE type only throughout the entire economy: either a source (green), sink (red), or value (orange)
   * NEVER use the same currency as different types in different nodes
   * Standardize currency names - avoid prefixes like "Free", "Premium", "Basic" in currency names. The path/node already indicates if it's free or paid
   * Example: Use "Cosmetics" not "Free Cosmetics" or "Premium Cosmetics"
   * Example: If "XP" is a value (orange) in one node, it must be a value in ALL nodes
7. **Final Goods Placement**: Final goods should be the terminal nodes in their respective flows. Do NOT group them into a separate "Final Goods" subsection. They should naturally conclude different paths throughout the economy (e.g., "To Dominate PvP" at the end of competitive flow, "To Show Off Rare Skins" at the end of cosmetic flow)

### Persistence
The plugin remembers your most recent JSON and chosen colors between runs on the same file using Figma client storage.

Generate the complete JSON for "[Specify Game Title Here]" following these exact specifications.

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
- Validation: structure, snake_case IDs, currency type consistency, cycle detection
- Layout basics: heights/columns, conflict-free Y
- Collision: rectangle/line intersection fundamentals, edge avoidance behavior
- Sync: canvas → JSON reconstruction using Figma API mocks
- Legend: currency extraction and section building

If you see failures due to environment (older Node), upgrade Node to 18 LTS.
