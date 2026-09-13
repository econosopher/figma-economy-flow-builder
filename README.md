# Economy Flow

[Open the editor](https://flow.gameeconomistconsulting.com/) · [Contribute](CONTRIBUTING.md) · [Web setup and hosting](web/README.md) · [MCP tools](web/MCP.md) · [FigJam plugin](docs/FIGJAM.md)

An open-source editor for game economy diagrams. Arrange actions, resources and final goods; the application handles spacing and orthogonal pipes. The website uses React, TypeScript, Vite and React Flow, with a Cloudflare Worker for hosting and APIs. The original FigJam plugin remains in this repository.

## Run the website

Use Node 24:

```sh
git clone https://github.com/econosopher/figma-economy-flow-builder.git
cd figma-economy-flow-builder/web
npm ci
npm run dev
```

Open the local URL printed by Vite. The guest editor, presets, browser saves and PNG/JSON exports work without accounts or API keys. The optional local API is described in [web/README.md](web/README.md).

```sh
npm test
npm run build
```

## Edit and contribute diagrams

The six public game presets are ordinary [JSON files](web/src/core/researched/). Use **Edit JSON** in the website to open a JSON file or paste JSON copied from GitHub. Both the web v3 format and the plugin's v2 format are accepted. Review the import before opening a new editable copy.

You can also export your own JSON, fork this repository and submit a pull request. [CONTRIBUTING.md](CONTRIBUTING.md) explains how to add a preset, cite its sources and run the geometry checks. The public catalog uses an explicit JSON manifest to generate imports, so adding a private file to a checkout does not publish it.

## Browse and edit with an AI client

Public browsing defaults to **Most viewed**, with the starter pinned and private diagrams kept in your recent-edit library. Counts become available when the Supabase backend is activated; offline browsing retains the bundled presets.

The included hosted MCP can read, create, edit and validate JSON diagrams, render private SVG/PNG previews, and submit public preset pull requests. It uses account consent and the same revision and ownership checks as the website. See [MCP setup and tools](web/MCP.md).

## Saving and visibility

All diagrams autosave. Guests save in their browser. New diagrams are unlocked by default: after cloud accounts are configured and the visitor signs in, each successful account save updates the public gallery. Click the lock beside the title to keep a diagram private. A guest's **Public · local only** label records that preference; it does not mean the diagram has been uploaded. Existing diagrams retain their previous snapshot-sharing behavior until their visibility is changed.

Private diagrams remain owner-only in account storage and are excluded from the gallery. Separately created read-only snapshot links retain their explicit sharing and revocation controls. Public copies and downloaded exports cannot be recalled.

## Source and deployment

The application code is released under the [MIT license](LICENSE). Anyone can fork, modify and self-host it or propose changes through pull requests; production deployment remains with the maintainers. Game names and trademarks belong to their owners. Contribution of a diagram requires permission to share its contents.

GitHub Actions installs dependencies, tests and builds the website without deployment secrets. Netlify currently forwards the public subdomain to the Cloudflare Worker; no GitHub, Cloudflare, Supabase, Slack or AI-provider service credentials are configured in Netlify. Service credentials belong in Cloudflare Worker secrets, never in browser bundles, JSON diagrams or the repository. See [SECURITY.md](SECURITY.md).

Accounts, cloud publishing, Slack and AI research require separate service configuration. Their source is included, but these integrations are not active on the hosted guest release.
