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
