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
cd economy-flow-plugin
npm install
npm run build
```

This will install the necessary dependencies and run the build script, which compiles `code.ts` and bundles `ui.html` into the final `code.js`.

---

## 3  Usage

1.  **Open the plugin:** In any FigJam file, run **Plugins → Development → Economy‑Flow Builder**.
2.  **Choose a Template (Optional):** Select a "Basic" or "Complex" example from the "Start with a template" dropdown to pre-fill the JSON. A confirmation will appear if you have existing JSON.
3.  **Customize Colors (Optional):** Use the color pickers to change the default colors for different node types.
4.  **Provide JSON:** Write or paste your flowchart definition into the main text area.
5.  **Generate from JSON:** Click the "Generate from JSON" button. The plugin will validate your JSON and render the diagram on the canvas.
6.  **Sync from Canvas:** Modify the diagram, then click "Sync from Canvas" to update the JSON spec.
7.  **Clear:** Click "Clear Canvas" to remove all elements created by the plugin.

---

## JSON Data Structure

The plugin uses a JSON object to define the flowchart. This object has three main properties: `inputs`, `nodes`, and `edges`.

### `inputs`
An array of objects representing the starting points of your economy, like "Time" or "Money". These are typically rendered as red boxes on the far left.

*   `id` (string, required): A unique identifier for this input.
*   `label` (string, required): The text displayed inside the box.
*   `kind` (string, required): Must be set to `"SINK_RED"`.

**Example:**
```json
"inputs": [
  { "id": "time", "label": "Time", "kind": "SINK_RED" },
  { "id": "money", "label": "Money", "kind": "SINK_RED" }
]
```

### `nodes`
An array of objects representing the actions, activities, or states in your flow.

*   `id` (string, required): A unique identifier for this node.
*   `label` (string, required): The text for the node's main box.
*   `kind` (string, optional): Set to `"finalGood"` to render a special "Final Good" box. Otherwise, it's a standard white action box.
*   `sources` (array of strings, optional): Resources *gained* that can be spent elsewhere (e.g., Gold, Gems). Rendered as green attribute boxes.
*   `sinks` (array of strings, optional): Resources *consumed* from elsewhere (e.g., Energy, Gold). Rendered as red attribute boxes.
*   `values` (array of strings, optional): Stores of value that accumulate but CANNOT be spent (e.g., XP, Level, Achievement Points). Rendered as orange attribute boxes.

**Example:**
```json
"nodes": [
  {
    "id": "complete_mission",
    "label": "To Complete Mission Objectives",
    "sources": ["Player XP", "Stratagem Slips", "Warbond Credits"],
    "sinks": []
  }
]
```

### `edges`
An array that defines the connections between your `inputs` and `nodes`. Each edge is an array tuple `[from_id, to_id]`.

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

The output MUST be a single, complete JSON object with EXACTLY these three top-level keys: `inputs`, `nodes`, and `edges`. Optional fourth key: `subsections`.

### Critical JSON Structure Rules:

1. **NO MARKDOWN FORMATTING**: Output ONLY the raw JSON object. No \`\`\`json tags, no explanations before or after.
2. **NO TRAILING COMMAS**: Never put a comma after the last item in any array or object.
3. **ALL ARRAYS MUST HAVE VALUES**: If a property expects an array (like `sources`, `sinks`, `values`), it must be present with at least an empty array `[]`. Never leave a property without a value.
4. **CONSISTENT ID FORMAT**: All `id` values must be lowercase with underscores (snake_case). Example: `daily_quest`, not `dailyQuest` or `DailyQuest`.
5. **VALID EDGES**: Every edge must connect existing nodes. Each edge is a two-element array: `["from_id", "to_id"]`.

### JSON Structure Specification:

1. **`inputs`** (required array): Primary resources players invest (time, money). These are economy sources.
   - `id` (string): Unique snake_case identifier
   - `label` (string): Display name (e.g., "Time", "Money")
   - `kind` (string): MUST be exactly `"SINK_RED"` (all caps with underscore)

2. **`nodes`** (required array): Game activities, systems, or milestones.
   - `id` (string): Unique snake_case identifier
   - `label` (string): Descriptive name (e.g., "Complete Daily Quest")
   - `sources` (array of strings): Resources GAINED that can be spent elsewhere (e.g., ["Gold", "Crafting Materials"])
   - `sinks` (array of strings): Resources CONSUMED from elsewhere (e.g., ["Energy", "Gold"])
   - `values` (array of strings): Stores of value that accumulate but CANNOT be spent (e.g., ["Player XP", "Achievement Points", "Account Level"])
   - `kind` (string, optional): Set to `"finalGood"` for ultimate goals/win conditions

3. **`edges`** (required array): Connections showing flow between nodes.
   - Each edge is an array: `["from_id", "to_id"]`
   - `from_id` and `to_id` must match existing node/input ids

4. **`subsections`** (optional array): Visual groupings of related nodes.
   - `id` (string): Unique identifier for the subsection
   - `label` (string): Display name for the group
   - `nodeIds` (array): List of node ids to include in this subsection
   - `color` (string, optional): Hex color like "#FF5733"

### Key Distinctions:

**Sources vs Sinks vs Values:**
- **Sources**: Resources gained that CAN be spent elsewhere (currencies, materials)
- **Sinks**: Resources consumed that come from elsewhere  
- **Values**: Metrics that accumulate but CANNOT be spent (XP, levels, achievement scores, collection progress)

**Examples:**
- Completing a quest might have:
  - sources: ["100 Gold", "5 Gems"] (can spend these elsewhere)
  - sinks: ["10 Energy"] (consumed from your energy pool)
  - values: ["500 XP", "1 Achievement Point"] (accumulate but can't spend)

### Research Focus:
1. Identify primary player inputs (time, money)
2. Map core gameplay loops and progression systems
3. For each activity, determine:
   - What it consumes (sinks)
   - What spendable resources it produces (sources)
   - What permanent progress it grants (values)
4. Trace flow connections between activities
5. Identify ultimate goals as finalGood nodes

Generate the complete JSON for "[Specify Game Title Here]" following these exact specifications.
```

## 4  Files

| File | Purpose |
|------|---------|
| `manifest.json` | Minimal manifest (`main: "code.js"`) |
| `code.ts` | Main plugin logic (TypeScript source) |
| `ui.html` | UI layout, styling, and client-side script |
| `tsconfig.json` | Compiler config with Figma typings |
| `.gitignore` | Ignores `node_modules/` and `code.js` |
| `/examples` | Contains example JSON files. |

---

## 5  CLI quick‑start from ~ (macOS)

```bash
# clone repo (or move unzipped folder)
cd ~/economy-flow-plugin
npm install
npm run build         # compile and bundle
open -a Figma .       # open Figma and import the manifest
```

Happy diagramming!
