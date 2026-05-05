# Publishing to Figma

This guide covers the explicit Figma step after code has been committed and pushed. GitHub does not automatically update the published Figma plugin; Figma has to locate the local `manifest.json` and publish the new version from the desktop app.

## Pre-Publishing Checklist

- [ ] Full test suite passes: `npm test -- --runInBand`
- [ ] Type-check passes: `npm run type-check`
- [ ] Production bundle builds: `npm run build:no-increment` or `npm run build`
- [ ] `code.js` exists locally and was built from the current `src/`
- [ ] Plugin was smoke-tested in Figma desktop / FigJam
- [ ] README, API docs, and QA notes are up to date
- [ ] Bundled examples validate and render correctly
- [ ] Release notes are ready for the Figma publish modal

## File Structure Required for Publishing

```
economy-flow-plugin/
├── manifest.json          # Plugin manifest (required)
├── code.js               # Compiled plugin code (required)
├── ui.html               # Source UI embedded into code.js by build.js
├── README.md             # Documentation (required for community)
├── LICENSE               # MIT License
├── logo.png              # Current local artwork asset
└── examples/             # Example JSON files
```

## Current Plugin Identity

The current manifest already has the Figma plugin id:

```json
{
  "name": "Economy Flow Builder",
  "id": "1529045431118674621",
  "api": "1.0.0",
  "main": "code.js",
  "editorType": ["figjam"],
  "documentAccess": "dynamic-page"
}
```

Keep this id stable. Figma uses it to publish updates to the existing plugin listing.

## Local Build And Smoke Test

```bash
npm test -- --runInBand
npm run type-check
npm run build:no-increment
```

Then in Figma Desktop:

1. Open a FigJam file.
2. Open the Figma menu in the upper-left.
3. Go to **Plugins > Development > Import plugin from manifest...** if this local checkout is not already connected.
4. Select `/Users/phillip/Documents/vibe_coding_projects/economy-flow-plugin/manifest.json`.
5. Run **Plugins > Development > Economy Flow Builder**.
6. Render the heavier QA examples, especially Apex Legends and Rainbow Six Siege.
7. Confirm the UI version and current behavior match the branch you built.

## Publish New Version

Figma updates are published from the desktop app:

1. Open a file in the Figma desktop app.
2. Go to **Plugins > Manage plugins**.
3. Find **Economy Flow Builder**.
4. Open the plugin menu and choose **Publish new version**.
5. If **Publish new version** is missing, choose **Locate local version**, select this repo's `manifest.json`, then publish again.
6. In the publish modal, update release notes and any metadata/artwork that changed.
7. Click **Publish**.

For already-approved plugins, Figma says publishing a new version updates the plugin for all users; users do not pick an older installed version.

## Suggested v2 Release Notes

```text
Major v2 renderer update:
- Adds explicit schemaVersion 2 with stages, lanes, nodes, and typed edges.
- Replaces inferred columns with compact stage/lane layout.
- Keeps connectors behind opaque cards and validates route/card intersections.
- Migrates bundled examples, including Apex Legends and Rainbow Six Siege.
- Adds Gemini/OpenAI/Claude provider selection for the local research API.
- Improves Sync from Canvas for plugin-created v2 diagrams.
```

## Post-Publishing

- Smoke-test the published plugin from a clean FigJam file.
- Confirm Apex Legends and Rainbow Six Siege render without visible connector/card overlap.
- Save the published plugin URL and release timestamp in `tasks/todo.md` if this release is submitted.
