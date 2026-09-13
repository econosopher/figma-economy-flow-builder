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
