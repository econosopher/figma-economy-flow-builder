# Economy flow release convention

Every economy diagram must start with two distinct initial inputs in its leftmost
stage: **Spend Time** and **Spend Money** (`inputRole: time | money`). Money means
real-world spending, not earned currency or an opening balance. An economy with
no monetary spending retains the Money input with an explicit Not applicable
explanation; never invent a paid mechanic.

Read the main flow left to right. Every other card must be forward-reachable
from an applicable input. Normal connectors advance to a later stage. Return
pipes require an explicit feedback designation and a visible explanation.
Final goods belong in the final stage.

Use the shared convention checker for generated research, preset builds,
publication, sharing, final exports and Figma rendering. A schema-valid document
is not necessarily release-ready. Noncompliant documents remain editable drafts;
recovery saves and clearly labeled JSON/package backups must remain available.
Do not weaken the gate, fabricate paths, or silently relabel unknown mechanics to
make a diagram pass. Correct the model against its evidence before releasing it.

When correcting diagrams, preserve source mappings, evidence, media references,
existing private originals and user edits. Test the release gate and inspect the
rendered left-to-right layout before deployment.
