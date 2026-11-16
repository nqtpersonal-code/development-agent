---
title: Clean code for new code
teaches: What to look for in the lines a ticket adds - names, functions, duplication, errors, comments, dependencies - a vocabulary of code smells that matches nqt's risk step, and how to use the linter a project already has without touching old code
languages: [any, typescript, csharp]
frameworks: [any]
layers: [server, ui, architecture]
situations: [writing the new lines of a change, reviewing a diff, designing a new module, naming a smell found while tracing a change]
---

Files:
- `new-code.md` — a checklist for the lines the change adds: names, functions, control flow, duplication, errors, comments, dependencies, magic values, tests.
- `smells.md` — the standard names for code smells (Duplicated Code, Shotgun Surgery, Divergent Change…), what each looks like, and what nqt does about it in a ticket.
- `existing-tools.md` — running the project's own linter or analyzer on the changed files only (`nqt.mjs lint-changed`), and why tool output beats opinion.

Use: `dev` for the lines it writes, the reviewer for the lines the diff adds, the architect for new modules, the risk-analyst for naming smells.

**Scope: the lines the change adds.** Cleaning is not the ticket's job: never tidy, rename, reformat or "improve" lines the change does not need (rules.md → Surgical changes; Preserve the scene). Existing code that breaks these guidelines is a note for the report or a smell for the risk step. The project's own style, naming and formatter come first (rules.md → Pattern library priority): match the code around you, even where this pack would do it differently.
