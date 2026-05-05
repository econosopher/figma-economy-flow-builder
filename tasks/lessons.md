# Lessons

- When validating FigJam connector layering, inspect child order inside the common parent group, not only `currentPage.children`. Figma can reparent attached connector nodes under the node group, so the renderer must explicitly re-append card nodes after connector creation to keep lines visually behind boxes.
