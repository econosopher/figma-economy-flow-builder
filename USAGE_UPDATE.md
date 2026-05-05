## 3  Usage

### Quick Start with AI (New!)
1. **Open the plugin:** In any FigJam file, run **Plugins → Development → Economy‑Flow Builder**
2. **Switch to Research tab:** Click the "Research (Beta)" tab at the top
3. **Add API Key:** Select Gemini, OpenAI, or Claude / Anthropic, then paste the matching key (saved securely in Figma client storage)
4. **Generate:** Enter any game name, select depth level, click "Generate Economy JSON" 
5. **Use:** Click "Use in Builder" to visualize the generated `schemaVersion: 2` economy

### Traditional Manual Workflow
1.  **Open the plugin:** In any FigJam file, run **Plugins → Development → Economy‑Flow Builder**.
2.  **Choose a Template (Optional):** Select a migrated v2 example from the template dropdown to pre-fill the JSON. A confirmation will appear if you have existing JSON.
3.  **Customize Colors (Optional):** Use the color pickers to change the default colors for different node types.
4.  **Provide JSON:** Write or paste your flowchart definition into the main text area.
5.  **Validate JSON (Optional):** Click "Validate JSON" to check formatting and references without drawing.
6.  **Generate from JSON:** Click the "Generate from JSON" button. The plugin will validate your JSON and render the diagram on the canvas.
7.  **Sync from Canvas:** Modify plugin-created cards/connectors, then click "Sync from Canvas" to update labels, resources, and edges while preserving the stored v2 stages/lanes.
8.  **Copy JSON:** Click "Copy JSON" to copy the current JSON to your clipboard.
9.  **Clear:** Click "Clear Canvas" to remove all elements created by the plugin.
