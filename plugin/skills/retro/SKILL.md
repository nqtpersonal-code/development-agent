---
name: retro
description: "nqt - retrospective of one finished ticket run - what went smoothly, what stumbled, and for each mistake whether to fix the workflow, fix an agent, add a project pitfall, improve the project's tracer adapter or adjust patterns. Proposes changes; applies only what the owner approves; never leaks project data into the plugin. Use when the owner runs /nqt:retro <project> <ticket>, preferably in a fresh session."
---

# nqt — retro

Arguments: `<project> <ticket>`. You run in the main session.

## Setup

- `PLUGIN` = two folders above this skill's base directory; `node PLUGIN/scripts/nqt.mjs init` → `DATA`; config → `LANGUAGE`, `pluginSourceDir`.
- `WORK` = `DATA/work/<project>/<ticket>`. Read `state.json`, `ticket.md`, `ticket-brief.md`, `trace/impact.md` + `impact.json`, `questions.md`, `plan-check.md`, `review.md`, `qa-report.md`, `final-report.md`, and the current session's conversation if available.
- Read `PLUGIN/shared/rules.md`, especially "rules.md → Confidentiality".

## Find what went wrong

Look for: owner corrections and doubts, questions that should not have been
needed (already answerable from code), `[GUESS]`s that slipped, plan-check
rounds, review/QA failures, places found late that the impact map missed,
UI defects found after build, steps that were slow or repeated, token-heavy
moments, patterns that helped or got in the way.

Compare the impact map with places discovered later (review, QA, implementation,
owner remarks): every miss is a **tracer** finding.

## Classify each finding

| Category | Where the fix goes |
|---|---|
| `workflow` | order of steps, checkpoints → `pluginSourceDir/plugin/skills/work-ticket/...` |
| `agent` | an agent's instructions → `pluginSourceDir/plugin/agents/<agent>.md` |
| `project-pitfall` | a trap specific to this project → `DATA/projects/<project>/pitfalls.md` |
| `tracer` | the project's adapter → `DATA/projects/<project>/tracer/` |
| `pattern` | a pattern pack that helped/hurt → the pack in `DATA/patterns` or the project's patterns |

## Propose, then apply only what the owner approves

Present findings in natural language, most important first, one decision at a
time, each with the concrete proposed change.

- **tracer**: first add the missed place as a new test in `tracer/tests.json`; run `node PLUGIN/scripts/nqt.mjs tracer-test --project <project> --root <project folder>` and show it fails; propose the adapter change; after approval apply it and re-run until all tests (old and new) pass.
- **project-pitfall**: one line per trap in the format of `PLUGIN/shared/formats.md` (date, ticket, trap, link). Traps only, never business rules. Also propose removing pitfalls the code no longer confirms.
- **workflow / agent**: write the change **generalised** — no project, customer or table names, no ticket ids, no code from the project, fictional examples only. Before showing it, save the proposed text to a temp file and run `node PLUGIN/scripts/nqt.mjs scan-leaks --dir <temp folder>`; fix any finding. After approval, edit the files in `pluginSourceDir` (never the installed copy), run its tests (`npm test` there) and tell the owner to commit and update the plugin. If a lesson is half generic, half specific: generic half to the plugin, specific half to the project's pitfalls.
- **pattern**: suggest editing, removing or adding a pack; never copy project code into a pack.

End with a short summary of what changed where.
