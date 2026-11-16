# Code smells: names, and what nqt does about them

The standard names (from Fowler's catalogue) let the tracer, the risk analyst, the architect and the owner talk about the same thing. In a ticket the rule never changes: **name the smell, say where it is, and leave it alone unless the brief's fix mode allows changing it.**

| Smell | What it looks like | In a ticket |
|---|---|---|
| **Duplicated Code** | The same logic in several places, often slightly different. | The copies are **change points** (must patch / do not touch / re-check); when they disagree it is a "one rule, many implementations" case for the risk step. |
| **Shotgun Surgery** | One change to the business needs small edits in many files. | Exactly the "looks like one change, is really N places" warning; list every place; patch all of them or say why not. |
| **Divergent Change** | One class or file changes for many unrelated reasons. | Patch narrowly at the ticket's path; do not split it in this ticket. |
| **Long Method / Large Class** | A function or class that does too much. | If a must-patch point sits inside one, patch at the narrowest point; report the size as a note. New code: keep its own functions small. |
| **Feature Envy** | A method that mostly uses another object's data. | Note; follow where the project puts such logic. |
| **Primitive Obsession** | Money, ids, statuses or codes passed around as bare strings or numbers. | New code: use the project's own types if it has them; do not introduce new wrapper types alone. |
| **Data Clumps / Long Parameter List** | The same group of values travels together through many signatures. | Note; a parameter object only where the project's code does that. |
| **Switch / if-chain on a type** | A branch per kind that grows with every new kind. | Add the new case in the existing place; every other `switch` on the same kind is a change point. |
| **Message Chains** | `a.b().c().d()` reaching through objects. | New code: avoid; old code: leave. |
| **Speculative Generality** | Hooks, flags and layers for needs that do not exist. | New code: do not add them (the smallest change that satisfies the criteria). |
| **Dead Code** | Unused functions, branches or files. | **Report, never delete** unless the ticket says so; before calling it dead, search for dynamic uses (reflection, names built from strings, other repos). |
| **Magic Numbers** | A bare literal that carries a business rule. | Name it the way the project names such values; a copy of the same number elsewhere is a change point. |
| **Comments hiding bad code** | A long comment explaining a tangled block. | Note it; do not rewrite the block. |

## Naming a smell in a report
One line: the name, the place (`file:line`), what it means for *this* ticket. Example: "Shotgun Surgery: the discount rule is applied in `fees.service.ts:13`, `total.ts:2` and `report.ts:14`; all three are in the change points table."
