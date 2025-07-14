# Economy-Flow Builder (FigJam)

Generate economy flow-charts in FigJam from a simple JSON spec. This plugin intelligently lays out nodes and their connections, creating clear and readable diagrams. It offers features like two-way JSON syncing, customizable colors, pre-built templates, and detailed validation to streamline your workflow.

## Features
*   **JSON-Powered:** Define your entire flowchart structure using a simple and editable JSON format.
*   **Two-Way Sync:** Modify the diagram on the canvas and sync it back to JSON, or generate the diagram from your JSON spec.
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
*   `sources` (array of strings, optional): Resources *gained* from this node. Rendered as green attribute boxes.
*   `sinks` (array of strings, optional): Resources *spent* at this node. Rendered as red attribute boxes.
*   `values` (array of strings, optional): Key metrics or value stores that are tracked, like Experience Points. Rendered as orange attribute boxes.

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

---

### AI Prompt for JSON Generation

To quickly generate a new flowchart, you can use the following prompt with a capable AI assistant (like Google's Gemini or OpenAI's GPT-4). This prompt instructs the AI to research a game's economy and format the findings into the specific JSON structure required by this plugin.

```text
You are an expert video game economist and analyst. Your task is to research the economy and player progression systems of the game "[Specify Game Title Here]". Based on your research, generate a JSON object that models the core gameplay loops, resource flows, and progression paths.

The output MUST be a single, complete JSON object with three top-level keys: `inputs`, `nodes`, and `edges`.

### JSON Structure Specification:

**Crucial Formatting Rule:** Your output must be a single, raw JSON object without any surrounding text, explanations, or markdown formatting like \`\`\`json. Pay strict attention to syntax. There must be **no trailing commas**. Every property that expects an array (like `inputs`, `nodes`, `edges`, `sources`, and `sinks`) **must have a value**, even if it's just an empty array `[]`. A property with a missing value (e.g., `"sources":,`) is invalid.

1.  **`inputs`**: An array of objects representing the primary resources a player invests, such as time or real money. These are the ultimate sources of the economy.
    *   `id` (string): A unique, lowercase, snake_case identifier.
    *   `label` (string): A short, descriptive name for the input (e.g., "Player's Time").
    *   `kind` (string): Must be set to the value `"SINK_RED"`.

2.  **`nodes`**: An array of objects representing the core activities or state changes in the game.
    *   `id` (string): A unique, lowercase, snake_case identifier.
    *   `label` (string): A descriptive label for the activity (e.g., "Complete a Daily Quest").
    *   `sources` (array of strings): Resources *gained* from this activity (e.g., "Player XP", "Gold Coins"). The plugin will render these as green boxes.
    *   `sinks` (array of strings): Resources *spent* or required for this activity (e.g., "Iron Ore", "Crafting Fee"). The plugin will render these as red boxes.
    *   `kind` (string, optional): If this node represents an ultimate goal, set this to `"finalGood"`. Otherwise, omit this key.

3.  **`edges`**: An array of tuples, where each tuple is `[from_id, to_id]`, representing a directional link. This shows how one activity or input enables another.
    *   The `from_id` must be an `id` from `inputs` or `nodes`.
    *   The `to_id` must be an `id` from `nodes`.

### Research Focus:
- Identify the main player inputs (e.g., time, money).
- Map out the core gameplay activities (e.g., questing, crafting, PvP).
- For each activity, identify the resources it costs (`sinks`) and the rewards it provides (`sources`).
- Trace the progression flow. How does completing one activity unlock or lead to another? This will define the `edges`.
- Identify the ultimate goals or "final goods" in the game's economy (e.g., "Achieve Max Level", "Collect All Mounts").

Please generate the complete JSON for the game "[Specify Game Title Here]".
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
