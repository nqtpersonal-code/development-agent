---
title: Extensible new code
teaches: How to give the new code of a ticket a seam for future growth - which axis of change to look for, the lightest pattern for each, how to add it beside existing logic without touching that logic, and when direct code is the better choice
languages: [any, typescript, csharp]
frameworks: [any]
layers: [server, ui, architecture]
situations: [a ticket adds a new module, class or service, a new kind, rule, channel or provider next to existing ones, a rule that exists in several variants, designing the structure of new code]
---

Files:
- `choosing.md` — find the axis of change, then the lightest structure for it (function table, interface behind DI, named pattern), with TypeScript and C# shapes; when to stay direct.
- `seam-beside-old-code.md` — adding the seam and the new implementation while the old logic stays untouched; the migration note; worked example.

Use: the architect for the "Structure decision" of the design, `dev` for the new code it writes, the plan-checker and reviewer to check it. It applies only to **new code**, in the order of decisions in rules.md → Design for extension: the project's own mechanism first, the touch-risk gate second, an extensible shape third, direct code when no axis of growth is visible.
