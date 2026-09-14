# Card evidence

Cards expose an evidence preview on hover or keyboard focus. The evidence button opens a screenshot-first reading panel; Edit evidence opens the metadata and attachment controls. Videos are loaded only after Play, using a YouTube privacy-enhanced embed with the saved start/end times. A timestamped external link remains available if embedding fails.

Version 3 documents may contain `evidence.details` (one explanation, interpretation, discussion prompt, status and uncertainty list per card) and `evidence.items` (sources, YouTube references and locally attached screenshots mapped to cards). Legacy files need no migration. Card content and connected-pipe changes invalidate the saved review fingerprint. Layout moves do not. Deleting a card removes its mappings; shared evidence remains attached to other cards. Copies retain attachments by content ID.

PNG, JPEG and WebP blobs live in IndexedDB, keyed by SHA-256. They are never embedded in localStorage or sent to an upload API. Maximum image size is 5 MB. Ordinary JSON and shared snapshots include references only; missing images are visible placeholders. Cloud media synchronization is not implemented.

Download with screenshots produces a `.flowpack.json` file containing the validated document and its referenced base64 image assets. Open diagram package validates the document, byte counts, MIME signatures, content hashes and references before storing media. The decoded image limit is 100 MB. Missing or corrupted attachments fail package export/import explicitly. A storage failure may leave unreferenced content-addressed blobs, but does not open a partially imported diagram or report a successful import.

Verification: `npm --prefix web test`, `npm --prefix web run build`, and `npx wrangler deploy --dry-run --env staging` from `web/`. Browser checks must also cover screenshot loading/enlargement, hover/focus, mobile panel, metadata edits, timestamped playback, package transfer into an isolated origin, save/reload, and legacy direct editing.
