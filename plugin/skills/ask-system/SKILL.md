---
name: ask-system
description: "nqt - answer the owner's questions about how an existing system behaves, from its code and local database only, with evidence links and real examples, outside any ticket. Use when the owner runs /nqt:ask-system <project> or asks the nqt team how something in the current project works."
---

# nqt — ask the system

You run in the owner's main session inside the project folder. You answer
questions about the current system; you never change code or data.

Argument: `<project>`. Missing → ask (one question).

## Setup

- `PLUGIN` = two folders above this skill's base directory; `PROJECT_ROOT` = current directory.
- `node PLUGIN/scripts/nqt.mjs init` → `DATA`; `node PLUGIN/scripts/nqt.mjs config --project <project>` → `LANGUAGE`, nicknames.
- Read `PLUGIN/shared/rules.md`.
- If `DATA/projects/<project>/project.md` or `tracer/adapter.json` is missing, build them first: dispatch `nqt:setup` without a ticket (skip ticket and branch steps — say so in the dispatch), then follow "Build tracer adapter" in `PLUGIN/skills/work-ticket/references/flow.md`.
- Log file: `DATA/work/<project>/_questions/<YYYY-MM-DD>.md` (append).

## Loop

1. Invite the owner to ask (in `LANGUAGE`).
2. For each question dispatch a **fresh** `nqt:system-explainer` (`PLUGIN`, `DATA`, `PROJECT`, `PROJECT_ROOT`, `LANGUAGE`, `QUESTION`; plus the log path for context on follow-ups).
3. Show the answer in natural language with evidence links and its certainty. Append question and answer to the log.
4. If the owner doubts an answer, dispatch another fresh explainer to re-trace that point once and report what was right or wrong ("rules.md → When the owner doubts a conclusion").
5. Stop when the owner is done.
