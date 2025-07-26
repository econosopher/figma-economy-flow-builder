# LLM Instructions for Economy Flow JSON Generation

## AI Prompt for JSON Generation

To quickly generate a new flowchart, you can use the following prompt with a capable AI assistant (like Google's Gemini or OpenAI's GPT-4). This prompt instructs the AI to research a game's economy and format the findings into the specific JSON structure required by the Economy-Flow plugin.

```text
You are an expert video game economist and analyst. Your task is to research the economy and player progression systems of the game "[Specify Game Title Here]". Based on your research, generate a JSON object that models the core gameplay loops, resource flows, and progression paths.

The output MUST be a single, complete JSON object with EXACTLY these three top-level keys: `inputs`, `nodes`, and `edges`. Optional fourth key: `subsections`.

### Critical JSON Structure Rules:

1. **NO MARKDOWN FORMATTING**: Output ONLY the raw JSON object. No \`\`\`json tags, no explanations before or after.
2. **NO TRAILING COMMAS**: Never put a comma after the last item in any array or object.
3. **NEVER LEAVE EMPTY VALUES**: Every property MUST have a value. Common mistakes to avoid:
   - WRONG: `"sources":,` or `"sinks":,` or `"values":,`
   - CORRECT: `"sources": [],` or `"sinks": [],` or `"values": []`
   - If a node has no sources/sinks/values, use an empty array `[]`, never leave it blank
4. **ALL ARRAYS MUST BE PROPERLY INITIALIZED**: Properties like `sources`, `sinks`, and `values` must ALWAYS be followed by either:
   - An array with items: `"sources": ["Gold", "XP"]`
   - An empty array: `"sources": []`
   - NEVER just a comma or nothing: `"sources":,` ← THIS WILL CAUSE ERRORS
5. **CONSISTENT ID FORMAT**: All `id` values must be lowercase with underscores (snake_case). Example: `daily_quest`, not `dailyQuest` or `DailyQuest`.
6. **VALID EDGES**: Every edge must connect existing nodes. Each edge is a two-element array: `["from_id", "to_id"]`.

### JSON Structure Specification:

1. **`inputs`** (required array): Primary resources players invest (time, money). These are economy sources.
   - `id` (string): Unique snake_case identifier
   - `label` (string): Display name (e.g., "Time", "Money")
   - `kind` (string): MUST be exactly `"initial_sink_node"`

2. **`nodes`** (required array): Game activities, systems, or milestones.
   - `id` (string): Unique snake_case identifier
   - `label` (string): Descriptive name (e.g., "Complete Daily Quest")
   - `sources` (array of strings): Resources GAINED that can be spent elsewhere (e.g., ["Gold", "Crafting Materials"])
   - `sinks` (array of strings): Resources CONSUMED from elsewhere (e.g., ["Energy", "Gold"])
   - `values` (array of strings): Stores of value that accumulate but CANNOT be spent (e.g., ["Player XP", "Achievement Points", "Account Level"])
   - `kind` (string, optional): Set to `"final_good"` for ultimate goals/win conditions

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
5. Identify ultimate goals as final_good nodes

Generate the complete JSON for "[Specify Game Title Here]" following these exact specifications.
```