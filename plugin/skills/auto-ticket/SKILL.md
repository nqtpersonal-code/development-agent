---
name: auto-ticket
description: "nqt autopilot. Use when the owner runs /nqt:auto-ticket <ticket> (optionally /nqt:auto-ticket <project> <ticket>, or with a cost cap like 'max $5') or asks the nqt team to do a ticket on its own, end to end, without asking: starts the autopilot runner in the background, which works the ticket in fresh sessions while the product-owner agent answers questions for the owner, stops at red lines or the cost cap, never pushes, and ends with a report listing every decision made for the owner."
---

# nqt — work a ticket on autopilot

The owner wants the ticket done without being asked along the way, and will
review the result (the diff and the decisions made for them) before pushing.

Arguments: `<ticket>`, optionally preceded by a project name; an optional cost
cap in the owner's words ("max $5"). Missing ticket → ask once.

## Steps

1. `PLUGIN` = two folders above this skill's base directory; `PROJECT_ROOT` = the current folder.
2. Tell the owner in one or two lines, in their language, what will happen: the team works the ticket alone; the product-owner agent answers questions from the ticket, the owner's earlier decisions and how the system already works; it stops and waits on red lines (bulk data changes, how money is calculated, permissions, personal data, a self-contradicting ticket) and at the cost cap (default from `config.md`, $10); nothing is pushed; the final report lists every decision made for them.
3. The ticket text must be reachable without anyone pasting it later: if the project has no tracker the scripts can read (no `gitHost`/`ticketSystem` in project.md, or the owner says it is in a file), ask once now — in plain text — for the ticket text or a file path, and save pasted text to a file in the scratchpad.
4. Start the runner **in the background** with the shell tool's background option:
   `node "PLUGIN/scripts/nqt.mjs" autopilot --ticket <ticket> --root "PROJECT_ROOT" [--ticket-file <file>] [--project <name>] [--max-cost <usd>]`
   Then end your turn: say where the log is (`<data dir>/work/<project>/<ticket>/autopilot.log`) and that you will report when it finishes.
5. When the background run finishes, read its last lines (they say why it stopped and what to do next) and tell the owner, in plain words:
   - **finished** → the path of the final report, then the decisions made for them, lowest confidence first (from the report's first section), and that they review the diff and push themselves;
   - **needs-owner** → the waiting question in plain words, and that they answer it with `/nqt:work-ticket <ticket>`, then run `/nqt:auto-ticket <ticket>` again to continue;
   - **cost-cap**, **stuck**, **error**, **too-many-sessions** → what happened in one line and the step reached; the ticket can continue with `/nqt:work-ticket <ticket>`.

## Never

Push, merge or open pull/merge requests; run the ticket's work in this session
yourself (the runner's sessions do it); answer the red-line questions for the owner.
