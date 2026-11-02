# Dev phase with superpowers (design → plan → plan-check → implement)

## dev-rules — owner preferences for every superpowers skill and dev subagent

State these explicitly whenever you invoke a superpowers skill or dispatch a dev subagent:

- Design docs, plans and notes go to `WORK/` (not `docs/superpowers/...` in the repo) and are **not committed**.
- No git worktree (skip `superpowers:using-git-worktrees`): the ticket already has its own folder and DB.
- Never run `superpowers:finishing-a-development-branch`; never push, merge or open PRs. Local commits on the feature branch are fine; with several repos, each task names its repo and git runs inside that repo.
- Tests follow `writeTests` in project.md: `yes` → tests in the project's own style, TDD as superpowers works; `no` → no test files, frameworks or scripts; each task is checked by a **quick self-check** (it builds/compiles, one smallest call or page load shows the change) — not by re-running QA's scenarios.
- Test data: the smallest possible, created only after `nqt.mjs db-check` passes, recorded and removed afterwards in `WORK/implementation-notes.md` ("rules.md → Local DB guard"). Non-ASCII text goes through UTF-8 files ("rules.md → Commands").
- Use the library versions the project has installed ("rules.md → Surgical changes", point 5); add or upgrade no dependency the ticket does not need.
- Touch exactly the brief's **must patch** points, never **do not touch** ones, in the brief's Fix mode, at the narrowest point on the ticket's path.
- The plugin path is `PLUGIN`; never search the disk for it or read plugin sources.
- No questions to the owner from dev subagents: they return them to the lead.

The lead keeps the main session thin: planning, plan fixes, coding and fixes run in **subagents**, for every ticket size. Only brainstorming (it talks with the owner) and subagent-driven-development (it dispatches its own subagents) run in the main session.

## design

Ask the owner (question tool, recommendation first) whether to run brainstorming again before coding:
- recommend **skip** when the brief has no open questions and either `architecture.md` exists or the change is small (few change points, risk `quick` or none);
- recommend **run** when the architect step was skipped and the change is not small, or something is still undecided.

**Skip** → write `WORK/spec.md` as a short pointer: the brief's criteria, change points and fix mode, plus `architecture.md` (or a link). `S --set design=skipped`.

**Run** → invoke `superpowers:brainstorming` in this session with:

> Owner preferences: see dev-rules (design doc `WORK/spec.md`, not committed). Requirements are settled in `WORK/ticket-brief.md` (approved), with `WORK/screens.md`, `WORK/trace/impact.md`, `WORK/test-scenarios.md`, `WORK/questions.md` and `WORK/architecture.md` if present; do not re-ask what they answer. Decide technical matters yourself (record them in the spec); ask the owner only about choices that change what users get, in plain language with real data. Present the design as a short natural-language summary. Do not continue into writing-plans: the lead dispatches planning separately.

`S --set design=done`.

## plan

Dispatch **one general-purpose subagent** (not this session) with:

> Use the superpowers:writing-plans skill. Spec `WORK/spec.md`, brief `WORK/ticket-brief.md`, impact `WORK/trace/impact.md`. Save the plan to `WORK/plan.md`. Follow the owner preferences printed by `node "PLUGIN/scripts/nqt.mjs" guide --step dev-rules`. Every task names the TCs it serves and the must-patch places it changes (file paths as in the brief). The plan covers code changes plus each task's quick self-check only; regression and scenario checks belong to QA, do not plan them. Do not ask about the execution method: the lead decides. Return ≤10 lines: task count, TCs per task, anything you could not place.

`S --set plan=done`.

## plan-check

1. `node "PLUGIN/scripts/nqt.mjs" plan-check "WORK"` — every TC has a task, every must-patch place is in the plan, no do-not-touch place is.
2. **Small ticket** (≤ 4 plan tasks, ≤ 3 must-patch points, no smell rated `full`, no architect step): the script is the check.
   **Otherwise**: also dispatch `nqt:plan-checker` once (`ROUND=1`); it grades findings `blocker / should / note`.
3. Blockers (script failures or plan-checker blockers) → dispatch one general-purpose subagent to fix the plan:
   > Fix `WORK/plan.md` for exactly these findings: <findings>. Change only what they need. Never remove or weaken how any TC is checked; if a finding seems to need that, return it instead of applying it. Return ≤5 lines.
   Then re-run the script; re-dispatch `nqt:plan-checker` only with `ROUND=2` and `FINDINGS=<its blockers>` to confirm those points (no full re-check). `should`/`note` findings are passed to implementation, not fixed in the plan.
4. Blockers left after round 2, or any "needs owner" finding → show them in plain words and ask.
5. `S --set plan-check=done` (it prints the `/clear` boundary: follow it).

## implement

Pick by the plan, not the plan-check rule: **Small** when the plan has ≤ 4 tasks and no smell is rated `full` (whether the architect step ran does not matter here); otherwise **Large or risky**. Tell the owner in one sentence which and why.

- **Small** → dispatch `nqt:dev` with `MODE=plan` (it runs `superpowers:executing-plans` on `WORK/plan.md` under the dev rules and writes `WORK/implementation-notes.md`).
  Then invoke `superpowers:requesting-code-review` in this session for the whole branch (its reviewer is a subagent); apply its fixes through `nqt:dev` with `MODE=fix` if needed. Save its verdict and findings (≤20 lines) to `WORK/superpowers-review.md`.
- **Large or risky** → invoke `superpowers:subagent-driven-development` in this session with plan, spec and dev-rules; the execution method is chosen. Dispatch every implementer (first dispatch and fresh fix-round implementers) as `nqt:dev` with `MODE=task` and the nqt inputs, keeping the skill's implementer prompt as the task; reviewers stay as the skill dispatches them. When it finishes (its own final review included), save that review's verdict and findings to `WORK/superpowers-review.md`.

Stop and come back to the owner when a subagent reports something that contradicts the brief, another place with the same behaviour (a late change point), or a change to how data is stored or a server call the plan did not contain — offer the architect step for it.

**Fixes** (from review or QA): dispatch `nqt:dev` with `MODE=fix` and `FINDINGS=<the findings>`.

`S --set implement=done` (it prints the `/clear` boundary: follow it).
