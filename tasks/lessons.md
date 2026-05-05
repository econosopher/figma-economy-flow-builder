# Lessons

- When validating FigJam connector layering, inspect child order inside the common parent group, not only `currentPage.children`. Figma can reparent attached connector nodes under the node group, so the renderer must explicitly re-append card nodes after connector creation to keep lines visually behind boxes.
- For plugin logo/artwork, avoid generic rounded-card, connector-arrow, coin primitives, and over-abstract path blobs. The mark must read immediately as Economy Flow Builder: a structured left-to-right economy diagram where assets visibly move from sources through conversion into outcomes.
