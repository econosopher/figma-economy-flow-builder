# Time and money release gate: 14 September 2026

Deployed the shared convention checker across web v3 and Figma v2. Spend Time and Spend Money are required first-stage inputs; normal pipes advance stages, all mechanics require forward reachability, returns require visible explanations, and final goods occupy the last stage. Structural validity remains separate: old diagrams open and save as drafts, with marked JSON/package backups, while final export, publication, sharing, server and MCP release routes reject violations.

All eight researched presets and the web/Figma starters pass. Both Wardogs maps were rebuilt (overview 16 cards/24 pipes; mechanics 30/49), preserving evidence and uncertainty. The original private 26-card map was reopened unchanged as a draft; the revised private package restored 11 screenshots and reopened on production at local ID `d0aca9a6-d01b-4cd4-be9a-24afa9ce7bc6`. This production copy is saved locally, not an account-cloud-save claim. The overview package restores seven screenshots. Native package roundtrips preserve the documents exactly. Corrected report figures, report PDF, shared diagram PDF and portable backup replace their prior versions at the existing links.

Verification: 163 plugin tests and 132 web tests passed, along with typechecks and builds. Both Wardogs layouts report zero routing issues. Staging verified draft export blocking, clickable violations, edit/undo readiness, signed-in explicit preset selection, account save/reload and package screenshot restoration. Production verified preserved legacy drafts, corrected preset selection, private package import/reload and a loaded local screenshot blob. The detailed canvas needs zooming for individual cards; the overview remains the discussion entry point.

Migration `202609140003_release_gate.sql` was applied manually through the authenticated Supabase SQL editor in staging and production, with success receipts. Anonymous direct publication reads now fail with 401/42501; Worker health, catalog and gallery remain 200. Public reads use the server-side checker. Storage preview buckets remain private. Do not roll back to an older Worker that depends on anonymous publication reads; retain the policy and fix forward.

- Production Worker: `8b6b9d98-96cc-4fed-8b9d-0e050930de9a`
- Staging Worker: `5ee56f23-9998-48bb-9db3-987e763e896b`
- Live overview: https://flow.gameeconomistconsulting.com/?preset=wardogs
- Detailed reference: https://flow.gameeconomistconsulting.com/?preset=wardogs_mechanics
- Report: https://flow.gameeconomistconsulting.com/research/wardogs/
- Shared portable backup: https://drive.google.com/file/d/1Hg-Yrj4PIBGx-3WMWfT0jwrv336j92Uc/view

Prior release records follow; version IDs and readiness counts below are historical.

---

# Account and MCP activation: 14 September 2026

Production is active at https://flow.gameeconomistconsulting.com. Codex completed OAuth sign-in to the direct production MCP, and the staging MCP has its own verified connection. Separate Supabase projects run the three migrations, the asymmetric OAuth token hook and scoped consent. The production editor uses the same static build previously verified on staging.

## Live verification

- Real staging OAuth registration, PKCE, resource audience, read/edit grants and immediate revocation passed. Two accounts were isolated; read-only clients were denied by both the Worker and direct database writes. Revision conflicts and idempotent saves passed.
- Production MCP read the starter, created a private document, previewed and saved a rename to revision 2, rendered it with zero routing issues, and downloaded a valid 277,884-byte PNG. The verification client was revoked afterward; the Codex connection remains active. The private test diagram is named `MCP connection verified`.
- Staging catalog tests passed for daily deduplication, owner and MCP exclusions, ranking before pagination and immediate removal after a private visibility change. Production catalog readback returned six game presets with analytics available and zero initial counts. The starter remains separately pinned. No historical views were invented.
- The repository-scoped GitHub App created [verification PR #1](https://github.com/econosopher/figma-economy-flow-builder/pull/1). A retry returned the same PR. The bot changed only a new preset JSON and its manifest entry; main remained at `0897a8a` during this test. The PR is unmerged.
- Real email sign-in succeeded in both environments through separately stored Resend SMTP credentials. The verified sender domain is `mail.flow.gameeconomistconsulting.com`; only its dedicated DNS records were added. The GEC account has moderation access in both environments.
- All 96 local automated tests, TypeScript checking and the production build passed. Existing browser/PNG/performance verification for this unchanged frontend is recorded below. The OAuth activation exposed an opaque authorization-ID format; the validator and a regression test now accept it without treating it as a UUID.
- A live staging public-schema/data dump restored into isolated local PostgreSQL 17. Both document hashes and revisions matched for the two documents captured at backup time; owner filtering and denial of an unapproved OAuth client survived. Auth credentials were excluded. This verifies application-data restoration, not full Supabase Auth or Storage disaster recovery.
- Production observability received the health request and a deliberately generated zero-card `client_export_failed` verification event. Structured save, routing, render, MCP and GitHub failures are enabled; hourly cleanup and database operational queries are configured. No outbound alert subscription was created.

Production Worker after moderator-secret activation: `b7282612-b9bc-4c2a-a633-1771db9c105d`. Staging: `8393fe15-06f8-4af9-8eeb-224fcd9e27ea`. Both use app `main-slMr4qmE.js`. Credentials are in 1Password and Worker/Supabase secrets; none were supplied to Netlify or committed to GitHub.

## Remaining operations

GitHub Actions is still blocked by the account billing restriction; the local checks above are separate evidence. Recurring protected backups and full Auth/Storage recovery need an operational policy beyond the verified application restore. Operator alert delivery has not been activated. Slack and provider-backed research remain separate and disabled.

The entries below are historical release records; their earlier account-activation gates are superseded by this entry.

---

# Hosted MCP implementation before activation: 14 September 2026

The source adds the Cloudflare Streamable HTTP MCP endpoint, stable-ID atomic edits, revision and retry protection, shared previews, scoped account consent, repository-only GitHub App contribution flow, and a manifest-driven preset bundle. The public browsing UI defaults to Most viewed, pins the starter, and supports server search, pagination and sorting. Personal diagrams keep their recent-edit order.

Staging and production serve the verified build. Account services are not activated: MCP returns 503, view counts display as unavailable, and public browsing falls back to deterministic title/ID ordering. No historical counts were invented. No credentials were supplied to Netlify.

## Verified

- 95 automated tests passed, including actual PGlite RLS isolation, scoped OAuth policy enforcement and revocation, atomic edits, revisions, idempotency, analytics deduplication, privacy, moderation, and ranking before pagination. Type checking and the production build passed.
- GitHub App contribution tests verify exact JSON/manifest changes, restricted paths, unchanged main, and recovery from duplicate or uncertain submissions against a mocked GitHub API. MCP initialization and tools/list use the actual SDK with mocked authentication.
- Final staging passed 12 public-catalog browser checks and all 22 direct-canvas checks, including keyboard access, recovery and rapid dragging without old-position frames. The updated research browser runner also passed all 37 checks against the local production build.
- The shared browser renderer produced identical SVG and PNG output to the editor pipeline for Apex, Rainbow Six Siege, Dice Throne Digital and the anonymized routing fixture, with no routing errors. These local-browser parity tests do not establish live Cloudflare rendering-service access.
- The 100-card/300-edge browser Worker fixture completed in 729 ms with no routing issues. A local database dump/restore test preserved data and RLS; live project backup restoration remains pending.
- Public readback confirmed `main-slMr4qmE.js`, healthy production/configuration responses, the six-game catalog, disabled MCP and unavailable analytics.

Staging Worker: `53bf54cd-2ea4-4bd1-8a59-434b6a265784`. Production Worker: `b594a5f9-29ca-451c-be6d-134aab72f84f`.

## Activation gates

Supabase sign-in is waiting at GitHub's provider consent screen in Aside. Separate staging/production projects, live migrations, the OAuth token hook, storage and Worker secrets still need activation. A repository-scoped GitHub App must be installed and configured. Codex has the direct production MCP URL registered but disabled until these checks pass.

Real two-account OAuth connection/revocation, authenticated read/edit/preview/save through Codex, daily production counters, real preset pull requests, operational alert delivery and live backup restoration are not yet verified. GitHub Actions remains blocked by the account billing restriction; local checks are reported separately above. Slack and provider-backed research remain separate.

---

# Open-source website and visibility update: 14 September 2026

The public GitHub source now includes the website, JSON presets, locked dependencies, credential-free CI and contributor/self-hosting documentation. A header link opens the source repository. The FigJam documentation remains under `docs/FIGJAM.md`.

New diagrams default to public intent. The lock selects private storage and gallery exclusion. Guest diagrams remain browser-local and say so. Existing v3 files without visibility retain the previous explicit snapshot publishing behavior. Privacy changes do not enter canvas undo history.

`202609140001_diagram_visibility.sql` synchronizes gallery snapshots within the owner's optimistic save transaction. Locking removes public listing; stale saves and legacy snapshot writes cannot reverse it. Moderator removal survives later saves. Empty new diagrams are not listed. Shared links retain their separate explicit revocation controls. This migration is included and tested with PGlite; the live service still has no Supabase project configured, so account publication is not yet active.

Validation: 74 automated tests passed; production build passed; staging passed seven new visibility/source-link checks and all 22 direct-canvas checks. Staged source was scanned for credential patterns and deployment state; no matches were found. No service credentials were added to GitHub or Netlify.

Staging Worker: `5d50d918-0f55-4ab1-bd73-38f90301d15c`; app: `index-DAve0DQs.js`. Production Worker: `910cf429-1c43-4264-8b53-6e0cec4d9423`. Public readback confirmed `index-DAve0DQs.js`, the GitHub source link, the existing diagram and its private default, and a healthy Worker. A clean checkout installed locked dependencies, passed 73 tests (the workspace has one additional ignored local example), built identical asset hashes and passed the credential-free Wrangler dry run.

---

# Researched preset release: 14 September 2026

Deployed to https://flow.gameeconomistconsulting.com after staging verification. Production Worker version: `31e29cb0-29c3-4a09-8b00-e56af60156f7`. Public readback confirmed `index-BKzMMS0N.js`, the exact seven-entry catalog, source links and successful health/configuration responses. The existing open Wardogs diagram was retained across reload.

## Delivered

The public library and bundled Community seeds now contain exactly the starter and six games: Gossip Harbor, Royal Match, MONOPOLY GO!, World of Warcraft, Call of Duty: Warzone and Apex Legends. All previous public game presets were removed from the catalog; root examples, private fixtures and saved documents remain intact.

Each game has a description, platform category, research date and Sources view. Optional v3 research metadata records linked evidence, original card/pipe mappings, scope, interpretations and limitations, and survives copying, JSON and recovery. Sources explicitly distinguish original evidence from user edits. This release uses cited desk research, not live playtesting. Historical and secondary evidence is identified in each diagram.

## Verification

- 66 automated tests passed in seven files, including complete evidence mappings, optional-metadata compatibility, JSON preservation, unsafe-link rejection, export exclusion and collision-free geometry for all six new presets. Production build passed.
- Final staging passed 37 researched-preset browser checks and all 22 existing direct-canvas checks. Coverage includes platform search, exact public/community catalogs, source dialogs, private copying, metadata recovery, keyboard and pointer editing, menus, drawer drops, atomic creation/deletion/undo and no old-position frame after rapid dragging.
- All six editor views and their full PNG previews were visually compared on staging. No routing issues or clipping were observed. PNG dimensions: Gossip Harbor 4808 × 3172; Royal Match 5160 × 3712; MONOPOLY GO! 5248 × 4380; World of Warcraft 5296 × 3892; Warzone 5256 × 3840; Apex 5376 × 4132.
- The actual staging layout Worker round trip for the 100-card/300-edge fixture was 619.1 ms, with zero routing issues. This excludes import UI and rendering time.
- Staging Worker: `1cd54592-ea84-4797-8c5c-5b8c2e07f6fb`. Verified app: `index-BKzMMS0N.js`; styles: `index-Cahy7ObZ.css`; layout Worker: `layout.worker-MnzORUVw.js`.

Accounts and integrations remain separate and unconfigured. No provider job or Slack message was sent. The deployment and activation notes below describe the prior editor release and its remaining integration gates.

---

# Direct canvas editing release: 13 September 2026

Deployed and verified at https://flow.gameeconomistconsulting.com. Production serves the same static build verified on staging. The public browser loaded `index-D66N4qMb.js`, passed the full direct-editing suite, and returned successful health and configuration responses.

## Delivered in this revision

- Black action headers with white titles, yellow final-good bodies (`#F5C95C`), stronger resource fills, contrasting text and yellow editing controls. Existing custom resource colors survive; Appearance offers the original palette.
- Inline title, resource, note and heading editing. Selection never opens an inspector or resizes the canvas. Small anchored menus supply placement, connection, pipe and group options.
- Right + creates a connected action and focuses its title; left − removes a card and its connections. Each is one undo action. Stage extension preserves terminal final goods. Resource rows have separate removal controls.
- Bottom + supports click menus, press-drag-release, cancellation outside the menu and keyboard equivalents. The Resources overlay drawer supports searchable existing resources, click-to-add and pointer dragging with a highlighted destination.
- Common title-centered input/output anchors, horizontal terminal approaches, distinct orthogonal tracks, shared terminal overlap only for the same endpoint and one arrowhead per target. Feedback and unrelated crossing bridges remain separate.
- Measured drag previews, explicit node dimensions, matching worker-response commits and stale-response rejection eliminate the observed hidden-node and drop snap-back races. Placement transitions respect reduced motion. Failed layouts retain the last valid scene.
- Shared SVG drawing and geometry keep editor content and PNG exports aligned, with no editing controls in exports. The export legend remains an independent preference.

## Verification

- 49 automated tests passed in six files on the final source. The web production build and root plugin type check passed.
- The complete `tests/browser/direct-canvas.js` runner passed all 22 checks on final staging and again on the public production URL. It covers keyboard inline editing, Escape, click and drag menus, keyboard menu navigation, drawer viewport stability and resource dragging, connected creation/autofocus, atomic deletion/undo, measured previews, frame-by-frame absence of the old position after dropping, rapid consecutive drags, visible nodes, PNG generation and reload recovery.
- Geometry regressions cover old v3 settings, common anchors, direct connections, parallel relationships, permitted terminal overlap, forbidden unrelated/intermediate overlap, feedback, long text, group bounds, dense fan-in/fan-out, collision avoidance and selection-export arrowheads.
- Final staging's actual layout Worker round trip for 100 cards and 300 pipes was 723.2 ms, with zero routing issues, below the one-second layout target. A separate import-to-render measurement was 1248.1 ms; that includes import, scheduling and rendering and is not the layout-only measurement.
- Final staging editor and full PNG previews were visually compared for Apex (30 cards/34 pipes, 6480 × 4952 PNG), Rainbow Six Siege (13/20, 3840 × 6064), Dice Throne Digital (21/25, 4568 × 8904), and the anonymized private routing regression (11/15, 4600 × 2520). All had zero routing issues. Private fixture data was not bundled or published.
- Previously implemented isolated PGlite and mocked API tests remain passing for RLS ownership, stale saves, revocation, invalid AI output, encrypted credentials/cancellation and duplicate or uncertain Slack sends. These are not live integration proofs.

## Separate activation still pending

Production `/api/config` reports cloud, Slack and research as false. Real accounts, cloud saves, snapshot links, community publications, provider jobs and Slack sends still require the service activation described in README.md. This interaction release does not activate them.

Real two-account isolation, live publication/revocation, Slack OAuth and an explicitly approved send, provider-backed research, notification delivery and live backup restoration remain pending after service activation. No Slack message or provider request was sent. A real mobile-device acceptance pass remains open.

## Deployment identifiers

- Production Worker version: `6fda5c65-2263-4fe3-88c7-6ae2bb6685b6`
- Staging Worker version: `afc62e05-b14b-412c-a3ee-cadd622a16c9`
- Public app asset read back: `index-D66N4qMb.js`
- Styles: `index-DX4B_vK0.css`; layout worker: `layout.worker-BSPAlNvB.js`
- Existing Netlify gateway deployment unchanged: `6aa6d8af3e51c8f90e6a69fa`

The original plugin source and existing uncommitted task notes were preserved. The main company website and gateway configuration were not redeployed.
