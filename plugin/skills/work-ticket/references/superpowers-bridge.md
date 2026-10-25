# Bridge to superpowers (design → plan → plan-check → implement)

The owner always wants superpowers brainstorming in the build phase. The
superpowers skills run in this main session. These owner preferences
override their defaults — state them explicitly when invoking each skill:

- Save design docs and plans in `WORK/` (not `docs/superpowers/...` in the repo) and **do not commit them**.
- No git worktree: skip `superpowers:using-git-worktrees`; the ticket already has its own folder and DB.
- Never run `superpowers:finishing-a-development-branch`, never push, never merge, never open PRs.
- Tests follow `writeTests` in project.md:
  - `yes` → write tests the way the project already does (same framework, folders, naming); TDD as superpowers normally works.
  - `no` → owner preference overrides test-driven development for this project: do **not** add test files, test frameworks or test scripts. Each task is verified instead by running the changed code for real (call the endpoint, run the job, open the screen) on the local DB and by self-review of the diff; plan steps say exactly how each task is checked.
- Local commits on the current feature branch are fine. When the ticket folder holds several repos, each task names the repo it changes, implementers run git inside that repo's folder, and each repo gets its own commits.
- DB writes (migrations, seeds, test data) only after `node "PLUGIN/scripts/nqt.mjs" db-check --project <project> --root "PROJECT_ROOT"` passes; never touch a non-local DB.
- Talk to the owner in natural language per `PLUGIN/shared/rules.md`; no technical questions to the owner.
- Touch exactly the brief's **must patch** change points, never the **do not touch** ones, in the brief's Fix mode (preserve the scene unless the owner chose otherwise); patch at the narrowest point on the ticket's path.

## design — start of the dev phase: brainstorming, if the owner wants it

Ask the owner (question tool, with your recommendation) whether to run brainstorming
again before coding, now that the brief (and architecture, if any) is settled:
- recommend **skip** when the brief has no open questions and either `architecture.md`
  exists or the change is small (few change points, risk level `quick` or none);
- recommend **run** when the architect step was skipped and the change is not small,
  or something is still undecided (a new fragment, an unresolved variant, a plan-checker
  "needs owner" finding from an earlier round).

**Skip** → write `WORK/spec.md` as a short pointer document: the brief's acceptance
criteria, change points and fix mode, plus `architecture.md` content if present (or a link
to it); no owner conversation. `S --set design=skipped`, continue with plan.

**Run** → invoke `superpowers:brainstorming` with this context:

> Owner preferences: design doc path `WORK/spec.md`, do not commit it.
> The requirements are already settled in `WORK/ticket-brief.md` (approved by the owner),
> with `WORK/screens.md`, `WORK/trace/impact.md`, `WORK/test-scenarios.md`,
> `WORK/questions.md` and, if present, `WORK/architecture.md`. Read them; do not re-ask
> anything they answer. The owner does not want technical questions: decide technical
> matters yourself (record them in the spec as your calls) and ask the owner only about
> choices that change what users get, in plain language with real data. Use the
> builder check as the skill describes. Present the design for approval as a short
> natural-language summary; the full technical spec stays in the file.

When brainstorming hands off to writing-plans, continue below. `S --set design=done`.

## plan (superpowers:writing-plans)

Invoke `superpowers:writing-plans` with: spec `WORK/spec.md`; save the plan to
`WORK/plan.md` (owner preference); Global Constraints must include "no work
files in the repo, no worktree, no push, surgical changes only, DB writes only after db-check passes, change only the must-patch points in the brief's fix mode, tests per writeTests (no = no test files)"; every plan task
names the TCs it serves. Do not ask the owner to review the technical plan;
the plan-checker reviews it. `S --set plan=done`.

## plan-check (nqt:plan-checker)

1. Dispatch `nqt:plan-checker` with `ROUND`. Increment `planCheckRounds` in state.json.
2. `revise` → apply the findings to `WORK/plan.md` yourself (or re-invoke writing-plans for large gaps) and re-check. "needs owner" findings → ask the owner first.
3. After round 3 still `revise` → show the remaining findings in plain words and ask how to proceed.
4. `pass` → `S --set plan-check=done`.

## implement — pick the execution by ticket size

- **Small** (≤ 4 plan tasks, ≤ 3 must-patch change points, no smell rated `full`):
  `superpowers:executing-plans` — implemented in this session task by task, one fresh
  whole-branch review at the end. Cheapest.
- **Large or risky** (anything else): `superpowers:subagent-driven-development` — a fresh
  implementer and reviewer per task.

Tell the owner which one you picked and why in one sentence; they may switch. Pass plan
`WORK/plan.md`, spec `WORK/spec.md` and the preferences above (both keep a self-ignored
`.superpowers/sdd/` workspace in the repo — accepted); say the execution method is already
chosen so the skill does not ask again.

Stop and come back to the owner when an implementer reports something that
contradicts the brief, finds another fragment of the same behaviour (a late change point), or when a DB/API change appears that the plan did not
contain — offer the architect step for it. When it finishes (its own final
review included, but **not** finishing-a-development-branch), `S --set implement=done`.
