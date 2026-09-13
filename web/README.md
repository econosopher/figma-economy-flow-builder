# Economy Flow Builder

A standalone economy editor alongside the existing FigJam plugin. React, TypeScript, Vite and React Flow run in the browser. A Cloudflare Worker serves the static build and authenticated API; Cloudflare Workflows run research and approved Slack uploads. Supabase supplies Auth, Postgres and private Storage.

## Run and check

Use Node 24. From this directory:

```sh
npm ci
npm run build
npm run dev
```

In another terminal, run `npx wrangler dev --ip 127.0.0.1 --port 8787`. Vite serves port 5173 and proxies `/api` to Wrangler. The guest editor works without external credentials. Copy `.dev.vars.example` to `.dev.vars` only when configuring a dedicated development backend.

```sh
npm test
npm run build
npx wrangler deploy --dry-run --env staging
```

The root plugin retains its build, test and type-check commands. No plugin source was replaced.

## Document and rendering contract

`src/core/document.ts` owns the version 3 schema, semantic validation, v2 adapter and document operations. `src/core/presets.ts` explicitly imports six researched native v3 diagrams from `src/core/researched/`; putting a private fixture in the repository does not add it to the website. Existing provider prompts come from the browser-independent root `src/research-contract.ts`.

Stages and groups are ordered arrays. Cards store stage, group and order, with no persisted pixel coordinates. Edges have independent IDs, a relationship type, and explicit feedback. Import review identifies v2 backward or same-stage connections as return pipes. Final goods remain in the final stage.

`layout.ts` measures and wraps content, sizes groups, reserves port stubs and corridors, separates parallel tracks by at least 12 diagram pixels outside designated terminal approaches, and falls back to distinct outside tracks. Each card has one common input and output anchor centered on its title area. Only pipes sharing an actual endpoint may overlap on their terminal approach; intermediate tracks stay distinct and each target arrowhead is drawn once. It produces deterministic orthogonal geometry. A Web Worker performs routing after actual Inter text measurement. Unresolved routes are reported and PNG export is disabled until fixed. Crossings are painted with bridges after the base pipes. Text, resources, notes, group bounds, legend and bridges use the same geometry and SVG drawing components in the editor and export. Inter's Latin, Cyrillic, Greek and Vietnamese subsets are embedded in SVG/PNG exports.

The canvas edits directly: click titles, resource labels, notes and group/stage headings; Enter saves and Escape cancels. Notes also accept multiple lines. Drag the frame or grip to a measured insertion preview. The accepted worker response replaces cards, groups and routes together, preserving temporary placement until then. Stale responses cannot snap the card back. The viewport stays fixed during ordinary editing, and motion respects reduced-motion preferences.

The right + creates the next connected action in the same group; the left − removes the card and its pipes. Each operation is one undo action. Extending the last stage creates another stage and moves final goods to the terminal stage in that transaction. The bottom + supports clicking or press-drag-release to add a source, sink, store of value or note, with arrow-key/Enter/Escape equivalents. A Resources tab opens an overlay drawer for searching, clicking and dragging resources. Neither selection nor the drawer changes canvas dimensions. Card, pipe and placement options live in small anchored menus; Appearance opens explicitly.

Enter on a focused card opens its title. Left/right arrows change stage; up/down arrows reorder within its slot. Invalid moves retain the original placement. Command/Ctrl-Z, Shift-Z and Delete work outside text fields. Existing v3 resource colors and data are preserved. Appearance offers the original palette, black action headers and yellow final-good bodies (`#F5C95C`); the export legend preference is separate from the resource drawer. Editing controls never appear in PNG/SVG exports.

## Researched public presets

The public library and bundled Community seeds contain the starter plus Gossip Harbor, Royal Match, MONOPOLY GO!, World of Warcraft, Call of Duty: Warzone and Apex Legends. The first three are Mobile; the latter three use the PC / console category. Earlier examples remain in the repository for regression coverage but are not bundled into the public catalog. Saved copies are not deleted.

Each game includes scope, a research date, source links, source-to-card/pipe mappings and stated interpretations. Sources opens from its library tile or a copied diagram. Optional `research` metadata stays within the v3 document through copying, JSON round trips and saves. It documents the original preset, not subsequent edits; original mappings can reference removed cards. Research controls and reference lists do not appear in SVG/PNG. These are qualitative diagrams based on cited desk research, not live playtesting or balance simulations.

## Saves and privacy

Guest diagrams, recovery copies and settings stay in local storage. Web Locks serialize cooperating tab writes; optimistic local revisions detect stale updates. Signed-in saves additionally use `save_document` with an expected Postgres revision. Queued saves check their account identity. Local recovery copies remain available during failed or offline cloud saves. Conflicts offer reload or a new private copy.

Read-only links store a fixed snapshot and a hash of a random token. Publishing is a separate explicit action. Publication updates replace only that snapshot. Unpublish and moderation hide both the public document and its thumbnail; thumbnails pass through a no-cache API check instead of a permanently public Storage URL. Community items can be copied into a new private document. Bundled public presets seed the gallery interface. New documents have `visibility: "public"` and their successful authenticated saves update a gallery snapshot atomically. The header lock changes this to `private` and removes gallery visibility in the same save transaction. Guest documents stay local until signed in. Legacy documents without visibility retain explicit snapshot publishing; they are not bulk-published. Administrator removal remains effective after subsequent saves. Separate snapshot links remain explicitly shared and revocable.

Slack requires OAuth, membership in the destination channel, an exact PNG preview, destination, message and sending identity, then an explicit Send. The approved PNG is stored temporarily in private Storage and queued as a Workflow. The workflow payload contains only the operation ID. A unique operation/payload hash prevents duplicate retries. A lost completion acknowledgement becomes `uncertain`; the app never automatically creates a replacement send. Temporary PNGs and message payloads are erased after completion, with scheduled cleanup for abandoned jobs.

Research uses only the user's supplied Gemini, OpenAI or Claude API key. The encrypted key stays in `job_credentials` and is read inside the provider step, never placed in a Workflow payload or log. Completion and cancellation delete it. Expiry prevents use after one hour; the scheduled cleanup removes expired rows. Results are validated and opened as a new draft, preserving the current diagram. Provider model IDs are deployment configuration, not funded fallback credentials.

## MCP and popular diagrams

The hosted MCP reads and edits account diagrams, validates JSON, renders private previews and submits preset pull requests. Both public browse tabs default to Most viewed, with the starter pinned. See [MCP.md](MCP.md) for tools, connection settings, OAuth activation, view-count semantics and operational checks.

Authenticated browser API requests go directly to `API_ORIGIN`, bypassing the Netlify gateway. The backend remains disabled until its service configuration and live acceptance checks are complete.

## Deployments

- Production: https://flow.gameeconomistconsulting.com
- Staging: https://economy-flow-staging.twig-transcripts-mcp.workers.dev
- Production Worker origin: https://economy-flow.twig-transcripts-mcp.workers.dev

The existing domain is managed by Netlify DNS, not the connected Cloudflare account. A separate Netlify site, `gec-economy-flow` (`f9397128-3bf4-4b53-bf0c-abc37de38e28`), attaches only the `flow` subdomain. `gateway/public/_redirects` forwards requests to the Cloudflare origin. The main company website is a different site and is not part of this deployment. Research and Slack sends return job IDs promptly and continue in Workflows, avoiding the gateway's request timeout.

```sh
npm run deploy:staging
npm run deploy:production
```

Only when the gateway configuration changes, from `gateway/`:

```sh
netlify deploy --prod --no-build --dir public --site f9397128-3bf4-4b53-bf0c-abc37de38e28
```

Wrangler has separate Worker names, Workflow names, rate-limiter namespaces, secrets and configuration for staging and production. Use different Supabase projects and Slack apps for each environment. `npm run types` regenerates Worker binding types after configuration changes. Roll back code with `wrangler rollback --env production`; review database compatibility before changing schema.

## Activate accounts and integrations

The guest release does not require these services. The account UI reads `/api/config` and clearly disables unconfigured integrations.

1. Sign into Supabase and create dedicated staging and production projects. Apply all `supabase/migrations/*.sql` in filename order once in each project, using its migration tooling or SQL editor. Do not apply it to a client database.
2. Configure the matching `SUPABASE_URL` and `SUPABASE_ANON_KEY` in Wrangler for each environment. Configure the Supabase Auth site URL and allowed callback URL to match that environment. Enable email sign-in, configure production SMTP and verify a real sign-in round trip.
3. Install `SUPABASE_SERVICE_ROLE_KEY` with `wrangler secret put --env staging SUPABASE_SERVICE_ROLE_KEY`, then separately for production. Never put service credentials in Vite variables or a committed file.
4. Install a separately generated base64-encoded 32-byte `CREDENTIAL_ENCRYPTION_KEY` in each environment with `wrangler secret put`. Keep a protected recovery copy for decrypting Slack installations. Rotating it requires reconnecting Slack unless old credentials are re-encrypted.
5. Create a Slack app from `ops/slack-manifest.json`; use the staging callback in the staging app. Enable distribution if arbitrary workspaces will install it. Configure `SLACK_CLIENT_ID` and the `SLACK_CLIENT_SECRET` secret. Test OAuth and an explicitly approved send in a test workspace.
6. Set the `ADMIN_USER_IDS` secret to the comma-separated Supabase user UUIDs permitted to moderate. The account menu opens the moderation queue; the API independently verifies administrator identity.
7. Redeploy and verify `/api/config`, `/api/health`, two-account isolation, cloud conflicts, snapshot revocation, publishing/unpublishing, moderation, BYOK research cancellation and invalid-output recovery. Live integration acceptance is pending until these services are configured.

## Operations and acceptance evidence

Worker request logging and structured categorical failure events are enabled. Client save, routing, layout and export failures are reported without diagram content, API keys or provider output. An edge rate limiter and per-browser event throttling bound event traffic. Inspect `client_save_failed`, `client_route_failed`, `client_export_failed`, `client_layout_failed`, `api_error`, `research_failed` and `slack_send_failed` in Cloudflare observability. `npx wrangler tail --env production` provides an interactive stream. Configure the operator's notification destination separately; no Slack alerts are sent automatically.

`ops/monitor.sql` checks integration states, expired credentials, abandoned previews and moderation reports. The hourly cleanup runs independently in each environment. Health checks verify the Worker and report whether cloud configuration is present; they do not assert database or Slack health.

Automated tests cover public and anonymized private routing fixtures, long text/headings, fan-in/fan-out, parallel relationships, feedback, independent tracks, group bounds, deterministic output, semantic import, atomic deletion, stale revisions, RLS isolation, immutable snapshots, revocation, moderation, invalid provider output, credential encryption/cancellation, and duplicate/uncertain Slack sends. A 100-card/300-edge fixture enforces a one-second layout budget locally. PGlite executes the migration and exercises database roles in an isolated Postgres runtime.

Local database backup/restore behavior is exercised with fixture data. A live Supabase backup restoration has not been verified. Before account release, enable the chosen backup policy, restore a backup to a dedicated isolated project, run `ops/restore-check.sql` and the two-account isolation checks, compare row counts and sample document hashes, and record the restore time. Database backups do not contain Storage object bytes; back up or regenerate published thumbnails separately. Keep integration jobs disabled in the restore target.

See `DELIVERY.md` for the current live checks and remaining activation gates. The browser regression runners in `tests/browser/direct-canvas.js`, `tests/browser/public-catalog.js`, and `tests/browser/researched-presets.js` run inside the approved Aside session and never send Slack messages or consumes provider keys.
