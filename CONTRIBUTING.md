# Contributing to Economy Flow

Fork the public repository, make your changes on a branch and open a pull request against `main`. The website lives in `web/`; the original FigJam plugin lives in root `src/` and `ui.html`.

## Website changes

Use Node 24 and run `npm ci` inside `web/`. Run `npm test` and `npm run build` before submitting. GitHub Actions repeats these checks without credentials. Browser regressions in `web/tests/browser/` cover direct editing and the preset library; use an approved local browser against your development build.

Describe the user-visible change and your validation in the pull request. Include before/after images for visual changes. Do not include local account data, private diagrams, generated deployment bundles or credentials.

## JSON diagrams

1. Create a diagram in the website, or copy an existing JSON file from `web/src/core/researched/` as a structural reference.
2. Choose **Edit JSON → Copy JSON** to copy the editable document. Save it as a `.json` file. Others can import it from disk or paste its contents into the editor without contributing code.
3. To propose a bundled public preset, add the JSON under `web/src/core/researched/` and explicitly import it in `web/src/core/presets.ts`. Update the expected catalog and browser checks if the proposal changes the catalog.
4. Use stable card and edge IDs. Stages run left to right; backward or same-stage pipes must have `feedback: true`. Final goods belong in the last stage. The validator is `web/src/core/document.ts`.
5. For researched game presets, include `research`: scope, review date, linked sources, original card/edge mappings, interpretations and limitations. Cite evidence you actually reviewed. Avoid inventing reward quantities or treating purchases as guaranteed outcomes.
6. Add the preset to the geometry regression coverage and run the checks. Inspect the editor and a full PNG for wrapping, collisions and readable pipes.

The six bundled game presets are curated. A pull request proposes a catalog change; it does not automatically deploy it. Community gallery copies are separate from files committed to GitHub. Locking a diagram on the website cannot remove a copy you already committed to a public repository.

## Self-hosting

Follow `web/README.md`. The guest editor needs no provider keys. Configure your own Cloudflare and Supabase projects for accounts, and your own Slack app for Slack sharing. Apply every SQL migration in filename order. Never point development at someone else's production database.

No Netlify credential or GitHub deployment token is needed to run the tests or build the website. Maintainers deploy staging, verify it, then deploy the same build to production.
