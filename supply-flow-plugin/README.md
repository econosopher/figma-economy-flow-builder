# Supply-Flow Builder (Figma & FigJam)

Generate supply‑chain flow‑charts from a simple JSON spec:

```json
{
  "inputs":[{ "id":"time","label":"spend time","kind":"inputTime" }],
  "nodes":[{ "id":"play","label":"to play","sources":["+Gold"],"sinks":[],"values":[]}],
  "edges":[ ["time","play"] ]
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
