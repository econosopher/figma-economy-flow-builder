# Rendering And Research Refactor

- [x] Extract connector routing into a shared pure module
- [x] Move diagram generation out of `main.ts` into a dedicated renderer module
- [x] Remove dead subsection-band and `edgeToEdge` plumbing
- [x] Tighten edge crossing detection to use real elbow segments
- [x] Update and expand tests for routing and layout behavior
- [x] Add a formal Gemini research/output contract with schema and conversion prompt
- [x] Harden research response validation after repair
- [x] Switch build-time Gemini key loading to env-first secret sources
- [x] Update docs and templates for the new Gemini flow

## Review

- Connector policy now lives in one place, so layout scoring, collision checks, and connector creation no longer duplicate elbow routing assumptions.
- `main.ts` is back to orchestration and message handling; the diagram build pipeline now sits behind a dedicated renderer entrypoint.
- Subsection band offsets and `edgeToEdge` config were removed because they were not carrying real behavior.
- Layout optimization now checks actual elbow-segment intersections instead of the previous coarse direction heuristic, which makes overlap scoring materially closer to what the canvas shows.
- Gemini research now has one source of truth for the JSON schema, a dedicated structured conversion prompt, and post-repair validation before results are accepted.
- Build-time key loading now prefers local secret files and successfully resolved a Gemini-capable key from `~/.api_keys` without putting a secret in the repo.
- Verification: `npm run type-check` passed, `npm test -- --runInBand` passed with 21/21 suites and 123/123 tests, and `node build.js --no-increment` completed successfully.

# Figma Overlap Validation Loop

- [x] Reproduce the chart overlap symptom in a disposable FigJam file with real FigJam nodes/connectors
- [x] Trace root cause in the layout/rendering path before editing production code
- [x] Add a failing regression test for the overlap case
- [x] Implement the minimal layout/rendering fix
- [x] Re-run local tests/build and a fresh FigJam screenshot/geometry validation

## Review

- Root cause: final-good nodes were anchored before subsection spreading, so later shifted source nodes could land to their right and create backward connectors across the diagram.
- Fix: `calculateColumns()` now re-anchors final-good nodes after all subsection shifts/spreads, keeping terminal outcomes at the right edge of the chart.
- Regression: added a layout test covering a widened subsection that previously pushed a source node past its final-good target.
- Figma validation: disposable FigJam QA file `LcVmmsJ7QoijL8sHl02CQz` reproduced the Dice Throne overlap, then the fixed layout moved final goods to the right edge; screenshot evidence saved at `/tmp/economy-flow-plugin-qa/baseline.png` and `/tmp/economy-flow-plugin-qa/fixed.png`.
- Geometry validation: the Dice Throne baseline showed 15 edge/node hit symptoms from the backward terminal placement pattern; after the fix Dice Throne has 0 backward edges, and every bundled example has 0 backward edges into final-good nodes.
- Verification: `npm run type-check`, `npm test -- --runInBand`, and `GEMINI_API_KEY=BUILD_VALIDATION_PLACEHOLDER npm run build:no-increment` passed.

# Economy Flow v2 Diagram Redesign

- [x] Add failing v2 schema validation tests
- [x] Add failing stage/lane layout and route-planner tests
- [x] Add failing renderer layer-order test
- [x] Implement v2 types, validation, deterministic layout, and route planning
- [x] Update the primary renderer to use v2 layer groups and node-front z-order
- [x] Migrate bundled example templates to `schemaVersion: 2`
- [x] Run local test/type/build verification
- [x] Run Figma MCP validation on Dice Throne v2 and capture screenshot evidence

## Review

- Implemented breaking v2 graph support with explicit `stages`, `lanes`, stage/lane-assigned nodes, and object-form edges.
- Replaced inferred column placement with deterministic stage/lane layout and a pure route planner; regression coverage now validates every migrated example has no non-endpoint route/card intersections and no backward final-good edges.
- Updated the renderer so backgrounds are created first, connectors are created next, and card groups are explicitly re-appended above connectors inside their Figma parent group. This handles the real FigJam behavior where attached connector nodes are reparented under the card group.
- Migrated all bundled examples to `schemaVersion: 2`, including Dice Throne as the visual QA case.
- Figma MCP validation used disposable FigJam file `YJQshZwLrk3Az8qMqC0T1s`: Dice Throne v2 rendered 21 cards and 25 connectors, route inspection returned 0 non-endpoint card intersections and 0 backward final-good edges, and the node group child order had all 25 connectors before all 21 card groups.
- Screenshot evidence saved at `/tmp/economy-flow-plugin-qa/v2-dice-throne.png`.
- Verification: `npm test -- --runInBand` passed with 24/24 suites and 148/148 tests, `npm run type-check` passed, and `GEMINI_API_KEY=BUILD_VALIDATION_PLACEHOLDER npm run build:no-increment` completed successfully.

# Economy Flow v2 Compact Readability

- [x] Add compact-layout regression tests for Dice Throne bounds, fan-out junctions, route clearance, and renderer ordering
- [x] Implement compact v2 sizing, active lane bands, final-good vertical alignment, and high fan-out junction routes
- [x] Update bundled examples with semantic stage labels where labels are generic
- [x] Run local test/type/build verification
- [x] Run Figma MCP validation on compact Dice Throne v2 and capture screenshot evidence
- [x] Run Figma MCP validation on compact Apex Legends and Rainbow Six Siege and compare naming style

## Review

- Compact layout now reduces stage gutters/card sizes, uses active lane bands, aligns final-good nodes near incoming sources, and annotates high fan-out routes with deterministic junction ids.
- Renderer now uses compact card/chip dimensions and edge-type styling while preserving the connector-behind-card child order.
- Bundled examples now use semantic stage labels; Rainbow Six inputs were normalized from `Time`/`Money` to `Spend Time`/`Spend Money` to match the rest of the examples.
- Figma MCP validation used disposable FigJam file `Ej7Q1YW3hG4ByQjshbgncF`: Apex rendered 30 cards and 34 connectors with 0 route/card intersections, 12 junction routes, 25.9% width reduction, and connector children behind cards; Rainbow Six rendered 13 cards and 20 connectors with 0 route/card intersections, 11 junction routes, 25.2% width reduction, and connector children behind cards.
- Screenshot evidence saved at `/tmp/economy-flow-plugin-qa/v2-apex-compact.png` and `/tmp/economy-flow-plugin-qa/v2-rainbow-six-compact.png`.
- Verification: `npm test -- --runInBand` passed with 25/25 suites and 154/154 tests, `npm run type-check` passed, and `GEMINI_API_KEY=BUILD_VALIDATION_PLACEHOLDER npm run build:no-increment` completed successfully.

# Documentation, Research, GitHub, And Sync Cleanup

- [x] Check adjacent feature paths after the v2 redesign: GitHub submission, research providers, and canvas sync
- [x] Update research provider storage/build defaults for Gemini, OpenAI, and Claude / Anthropic
- [x] Update GitHub submission to target the actual repository
- [x] Add v2 sync coverage for compact grouped cards and object-form edges
- [x] Update README, API setup, integration notes, LLM instructions, and usage notes for v2 compact QA
- [x] Run full test suite, type-check, and build
- [x] Commit and push the branch to GitHub

## Review

- GitHub submission is not a direct PR creator inside Figma; it opens the configured repository's draft new-file page for the generated `examples/*.json` preset and provides PR instructions.
- The Research tab can pass `provider: "gemini"`, `"openai"`, or `"claude"` to the local API. Build-time default key lookup now supports provider-specific env vars and local secret stores without committing any key values.
- Sync from Canvas now preserves the stored v2 stages/lanes for plugin-created diagrams and merges edited grouped cards/chips/connectors back into v2 JSON. It still does not infer a full economy from an arbitrary screenshot or non-plugin image.
- Verification: `npm test -- --runInBand` passed with 25/25 suites and 155/155 tests, `npm run type-check` passed, and `GEMINI_API_KEY=BUILD_VALIDATION_PLACEHOLDER npm run build:no-increment` completed successfully.
- Commit prepared for GitHub branch push.
