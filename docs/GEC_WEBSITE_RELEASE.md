# GEC website editor release

## Scope

This release adds investment-path highlighting, guest research instructions and
JSON import, an origin-checked embedded mode, and the GEC grey canvas. It does not
enable hosted research, Slack, or publish the private Jev comparison.

The release branches from `9cbc8ed`. Before changes, its build reproduced the
asset hashes served by both the production Worker and the public Netlify
forwarding domain. Earlier local pilot work was left untouched in its checkout.

## Browser acceptance, 21 September 2026

Aside's existing GEC profile was reconnected. Tests used disposable local copies;
the existing production document was not edited.

- Seven path checks passed: both roots, all upstream boxes, retained selection,
  temporary hover, restored selection, empty-canvas clearing, keyboard Connect to.
- Unit cases cover parallel pipes, renamed investment boxes, disconnected inputs,
  feedback exclusion and cycles returning to a root.
- Guest instructions generated and copied without API-key fields. Invalid JSON
  left the current document intact. Valid JSON opened as a private copy and
  survived reload.
- Guided dragging showed a valid insertion preview. All 73 sampled frames after
  drop avoided the old position. Two immediate drags settled with no stale
  preview or routing errors.
- Removing a card removed its two pipes; one Undo restored all three. Escape
  cancelled an inline title edit.
- A 3328 × 1768 PNG preview rendered, the download action ran, and Copy image
  reported success. Export background preferences remain independent of the
  grey editor theme.

## Regression checks

- 137 unit tests passed; TypeScript compilation passed.
- Production-built Apex and Rainbow Six fixtures matched shared-renderer SVG and
  PNG output exactly, with zero routing issues.
- The legacy Dice Throne and return-routing fixtures have zero routing issues
  but fail existing release conventions. Tests assert that their SVG/PNG exports
  are rejected; the release gate was not weakened to make fixtures pass.
- The production-built 100-card/300-edge worker round trip took 645 ms with zero
  routing issues. The cold Vite development run took 1201 ms; the production
  measurement excludes development module compilation.
- Normal Vite inputs remain `index.html` and `render.html`. Browser verification
  builds go to ignored `.verification/`, never the deployment directory. The
  production bundle contains no pilot entry, private fixture or preview-origin
  allowlist.

Run `npm test`, `npm run build`, and the approved Aside checks in
`web/tests/browser/gec-release.js`. For browser geometry/export/performance
checks, build `vite.verification.config.ts` and serve `.verification/` locally.

## Configuration and limits

Staging embeds may allow one exact preview origin using
`VITE_GEC_EMBED_PREVIEW_ORIGIN`. Production builds omit it and accept only the
apex and www GEC HTTPS origins. The website validates both sender origin and
iframe window before processing messages. The editor preserves `embed=1` when
opening a document.

Accounts are optional for this guest workflow. Hosted automation still requires
authentication to own private jobs and credentials, and remains disabled.
Browser-local recovery is tied to that browser. Structural validity does not
verify research accuracy. Large diagrams still require zooming.

Deploy the verified editor first, then the website modal. Keep API configuration
and the existing Netlify forwarding layer unchanged. Record deployment receipts
in the release handoff after public readback.

## Deployment receipts

- Editor source: `92345e6c63593a36ca10ad71946aad28c717c01b`, pushed on
  `codex/gec-flow-release`.
- Cloudflare production version: `b337b0d6-f836-4c04-b0b2-09698827d609`.
- Public `flow.gameeconomistconsulting.com` HTML exactly matched the built
  artifact, including `main-DD3XTBKo.js`. The entire `/api/config` response
  matched the pre-release response.
- Website source: `082b6887cdcef6f753aa3290092f1a73b8c2c086`, pushed on
  `codex/gec-flow-modal-release` in `econosopher/website-gec`.
- Netlify preview: `6ab1bdeb34916c0eb00e5dfd`. Browser acceptance included lazy
  loading, retained iframe state, exact-origin readiness, focus and scroll
  restoration, browser Back/Forward, inner-dialog Escape, 390-pixel viewport,
  guest instruction copying, PNG clipboard copying and a valid downloaded
  3328 × 1768 PNG.
- Netlify production: `6ab1bea4d8bb91071745e802`. Published after the editor.
  The public modal JavaScript matched the artifact exactly. Homepage differences
  were limited to Netlify's injected monitoring script; the production editor
  origin and sidebar link were verified.

GitHub Actions run `35667544415` could not start: its annotation reports an
account billing lock. No workflow steps executed. Local unit tests, TypeScript,
build, production Wrangler dry run and approved browser acceptance passed.
No billing settings were changed. The release branches are retained for source
integration; production was deployed from the exact commits above.
