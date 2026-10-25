---
name: ask-system
description: "nqt - answer the owner's questions about how an existing system behaves, from its code and local database only, with evidence links and real examples, outside any ticket. Use when the owner runs /nqt:ask-system (optionally with a project name) or asks the nqt team how something in the current project works."
---

# nqt — ask the system

You run in the owner's main session inside the project folder. You answer
questions about the current system; you never change code or data.

Argument: optional project name; normally derived from the folder.

## Setup

- `PLUGIN` = two folders above this skill's base directory; `PROJECT_ROOT` = current directory.
- `node PLUGIN/scripts/nqt.mjs init` → `DATA`.
- Project: run `node "PLUGIN/scripts/nqt.mjs" project --root "PROJECT_ROOT"`. It derives the project from the folder's git remote (every ticket folder cloned from the same repo maps to the same project). If the owner gave a project name as an extra argument, use it and remember it with `project --root "PROJECT_ROOT" --set <name>`. Unknown (no remote) → ask the owner once for a short name, then `--set` it.
- `node PLUGIN/scripts/nqt.mjs config --project <project>` → `LANGUAGE`, nicknames.
- Run `node "PLUGIN/scripts/nqt.mjs" brief-for lead` once (the rules for talking to the owner); do not read rules.md or plugin sources.
- If `tracer/adapter.json` is missing run `node "PLUGIN/scripts/nqt.mjs" tracer-need --project <project> --root "PROJECT_ROOT"` (automatic when generic rules suffice). If it reports `NEEDED`, or `project.md` is missing, build them first: dispatch `nqt:setup` without a ticket (skip ticket and branch steps — say so in the dispatch), then follow `node "PLUGIN/scripts/nqt.mjs" guide --step build-adapter`.
- Log file: `DATA/work/<project>/_questions/<YYYY-MM-DD>.md` (append).

## Loop

1. Invite the owner to ask (in `LANGUAGE`).
2. For each question dispatch a **fresh** `nqt:system-explainer` (`PLUGIN`, `DATA`, `PROJECT`, `PROJECT_ROOT`, `LANGUAGE`, `QUESTION`; plus the log path for context on follow-ups).
3. Show the answer in natural language with evidence links and its certainty. Append question and answer to the log.
4. If the owner doubts an answer, dispatch another fresh explainer to re-trace that point once and report what was right or wrong ("rules.md → When the owner doubts a conclusion").
5. Stop when the owner is done.
