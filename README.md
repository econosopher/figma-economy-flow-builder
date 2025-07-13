# Supply-Flow Builder (Figma & FigJam)

Generate supply-chain flow-charts from a simple JSON spec. This plugin intelligently lays out nodes and their connections, creating clear and readable diagrams in both Figma and FigJam.

## Example

```json
{
  "inputs": [
    { "id": "time", "label": "Time", "kind": "SINK_RED" },
    { "id": "money", "label": "Money", "kind": "SINK_RED" }
  ],
  "nodes": [
    { "id": "start_missions", "label": "To Start Missions", "sources": [], "sinks": [], "values": [] },
    { "id": "mission_objectives", "label": "To Complete Mission Objectives", "sources": ["+ Player XP", "+ Stratagem Slips", "+ Warbond Credits"], "sinks": [], "values": [] },
    { "id": "increase_level", "label": "To Increase Player Level", "sources": ["+ Weapons", "+ Armor"], "sinks": [], "values": [] },
    { "id": "higher_difficulty", "label": "To Defeat Higher Difficulty Missions", "sources": ["+ Stratagems"], "sinks": [], "values": [] },
    { "id": "major_orders", "label": "To Complete Major Orders", "sources": ["+ Metals"], "sinks": [], "values": [] },
    { "id": "liberate_planets", "label": "To Liberate Planets", "sources": [], "sinks": [], "values": [] },
    { "id": "galactic_power", "label": "To Increase Galactic Power", "sources": [], "sinks": [], "values": [] },
    { "id": "super_win", "label": "To Achieve a Super Win", "sources": ["+ Metals"], "sinks": [], "values": [] },
    { "id": "warbond_tiers", "label": "To Unlock Warbond Tiers", "sources": ["+ Metals", "+ Stratagems", "+ Weapons", "+ Armor"], "sinks": [], "values": [] },
    { "id": "premium_lane", "label": "To Unlock Warbond Premium Lane", "sources": ["+ Super Credits"], "sinks": ["- Super Credits"], "values": [] },
    { "id": "final_good_1", "label": "Experience More Role Playing Moment", "sources": [], "sinks": [], "values": [], "kind": "finalGood" },
    { "id": "final_good_2", "label": "To earn Unlock New Narrative", "sources": [], "sinks": [], "values": [], "kind": "finalGood" }
  ],
  "edges": [
    ["time", "start_missions"],
    ["start_missions", "mission_objectives"],
    ["start_missions", "major_orders"],
    ["mission_objectives", "increase_level"],
    ["increase_level", "higher_difficulty"],
    ["higher_difficulty", "final_good_1"],
    ["higher_difficulty"],
    ["major_orders", "liberate_planets"],
    ["major_orders", "warbond_tiers"],
    ["liberate_planets", "galactic_power"],
    ["galactic_power", "super_win"],
    ["super_win", "final_good_2"],
    ["money", "premium_lane"],
    ["premium_lane", "warbond_tiers"]
  ]
}
```

The plug‑in draws red **inputs**, black **activities**, and coloured **source / sink / value** tiles, then pans the viewport so everything is in view.

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
cd supply-flow-plugin
npx tsc
```

`tsc` compiles `code.ts` → `code.js` next to the manifest.

---

## 3  Load in Figma (local)

1. **Figma desktop → Plugins → Development → Import plugin from manifest…**  
2. In any **FigJam** (or Design) file run **Plugins → Development → Supply‑Flow Builder**.  
3. Paste JSON → **Generate** → chart appears; **Clear Canvas** wipes it.

_No Community publishing needed._

---

## 4  Files

| File | Purpose |
|------|---------|
| `manifest.json` | Minimal manifest (`main: "code.js"`) |
| `code.ts` | Source (works in Jam & Design) |
| `tsconfig.json` | Compiler config with Figma typings |
| `.gitignore` | Ignores `node_modules/` and `code.js` |

---

## 5  CLI quick‑start from ~ (macOS)

```bash
# clone repo (or move unzipped folder)
cd ~/supply-flow-plugin
npm install           # installs dev deps if you added package.json
npx tsc               # compile
open -a Figma .       # open Figma and import the manifest
```

Happy diagramming!
