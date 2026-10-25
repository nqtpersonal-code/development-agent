# work-ticket flow, step by step

Notation: `S` = `node PLUGIN/scripts/nqt.mjs state WORK`. "Show" means a
natural-language message to the owner in `LANGUAGE` with nicknames.
Default agent and step names when no nickname is configured:

| step | default name (vi / en) |
|---|---|
| setup | Chuẩn bị / Setup |
| analysis | Phân tích ticket / Analysis |
| screens | Thiết kế màn hình / Screen design |
| risk | Phân tích rủi ro / Risk analysis |
| brief | Chốt hồ sơ ticket / Ticket brief |
| test-design | Viết kịch bản test / Test design |
| free-qa | Hỏi đáp tự do / Free Q&A |
| architect | Thiết kế kỹ thuật / Technical design |
| design | Thiết kế giải pháp / Solution design |
| plan | Lập kế hoạch / Planning |
| plan-check | Soát kế hoạch / Plan check |
| implement | Viết code / Implementation |
| review | Review / Review |
| qa | Kiểm thử / QA |
| report | Báo cáo / Report |

---

## setup

1. Dispatch `nqt:setup` (pass `TICKET_TEXT` if the owner pasted the ticket).
2. Handle its status:
   - `need-ticket-paste` → ask the owner to paste the ticket (title, description, comments).
   - `need-owner: db-host` → ask which connection is the ticket's local DB; record `confirmedLocalHosts`/`dbEnvFile` in project.md; re-dispatch.
   - `need-owner: dirty-tree` → show the changed files in plain words; ask whether to stop or continue on the current branch.
   - `need-adapter` / `need-adapter-update` → run **Build tracer adapter** (below), then re-dispatch setup.
   - questions about project facts → ask one at a time (this is a "technical part" moment: say so), update project.md.
3. `S --set setup=done`.

## Build tracer adapter (first run per project, or when stale)

Goal: `DATA/projects/<p>/tracer/adapter.json` + `tests.json` that pass.
1. Detect: dispatch `nqt:code-tracer` with task "survey for adapter": components (folders, kind), data access style (ORM, query helper, raw SQL), how the front end calls the API (wrapper, base path), route declaration style, jobs/queues, dynamic SQL habits. It returns a draft adapter and its uncertainties.
2. Brainstorm with the owner in natural language, one question at a time, only about what the survey could not settle (e.g. "I see the web app calls the server through one helper file; are there other apps (mobile, admin) that call the same server?"). Record answers.
3. Write `adapter.json` (format in formats.md) with `assumptions` for everything the adapter relies on. When the ticket folder holds several repos (`nqt.mjs repos`), declare each component by `remote` (+ `path`), not by folder name, so every later ticket folder works.
4. Ask the owner for 1–2 flows they know well ("when the student name changes, where does it show?"). Write them as `tests.json`; run `nqt.mjs tracer-test --project <p> --root PROJECT_ROOT`. Adjust the adapter until they pass; if a test fails because the owner's expectation and the code disagree, show the evidence and let the owner decide.

## analysis

1. From `ticket.md`, pick start points (tables/columns, screens, API paths). If unclear, dispatch `nqt:code-tracer` with "find start points" first.
2. Dispatch `nqt:code-tracer` with the start points. On `split-suggestion`, dispatch one per branch in parallel; merge their `impact.md` sections into `WORK/trace/impact.md` (dedupe places).
3. Dispatch `nqt:ba`.
4. Record whether UI is touched: `S --flag hasUI=true|false` (from ba.md).
5. **Checkpoint 1** — show: what the ticket asks (short), how it works today (with links and real data; every variant when copies differ), affected screens/functions, the change points (say plainly when one change is really several places, and ask the scope: all of them for consistent results, or only what the ticket names), whether the ticket allows refactoring (ask if unclear; default no), contradictions, then the first question. Loop: owner answers → append to brief "Owner answers" (create `ticket-brief.md` skeleton if needed) → re-dispatch `nqt:ba` → next question, until no `[GUESS]` remains.
6. `S --set analysis=done`.

## screens (only when the ticket touches UI; else `S --set screens=skipped`)

1. Dispatch `nqt:screen-designer` (`MOCKUP=no`). If it returns `need-owner-confirm: ui.md`, show a plain summary of the project's look and model screens; ask to confirm or correct; save.
2. **Checkpoint 2** — show the screen flow and each screen in words (and the mermaid diagram). Ask: "Do you want a clickable mockup to try in the browser?" Yes → re-dispatch with `MOCKUP=yes`, open `WORK/mockup/index.html` in the browser for the owner.
3. Iterate on the owner's remarks. `S --set screens=done`.

## risk (only when a change point touches a code smell; else `S --set risk=skipped`)

1. Smells: diverging copies of one rule, a must-patch function with a wide radius (many routes/screens of stable features), copied components on the ticket's path.
2. Dispatch `nqt:risk-analyst`.
3. **Checkpoint 2b** — per smell, show the owner part of `risk.md` (what is fragmented, options with risks, recommendation) and ask which option; record the decision in the brief → Fix mode. If the owner chooses B, re-classify change points accordingly.
4. `S --set risk=done`.

## brief

1. Write `WORK/ticket-brief.md` (sections in formats.md) from ba.md, screens.md, impact.md, risk.md and owner answers, including the Change points table and Fix mode. Acceptance criteria name what users see.
2. **Checkpoint 3** — show the brief's summary and criteria; ask for approval. Open questions must be empty.
3. `S --set brief=done`.

## test-design

1. Dispatch `nqt:qa` with `MODE=design`.
2. "Cannot verify" items → send back to `nqt:ba` (re-open analysis questions) and update the brief.
3. Show a short list of scenarios (user language) with how each will be checked ("read in the code", "existing tests", "call the server and check the data", "click through in a browser") and the totals — informational, no approval needed unless something changed the brief. `S --set test-design=done`.

## free-qa

1. Tell the owner they can now ask anything about the current system, or say "chuyển sang thiết kế" / "move on".
2. Each question → dispatch a fresh `nqt:system-explainer` with the question; show the answer; append Q and A to `WORK/questions.md`. If it proposes a brief change, ask the owner; apply only on yes (and re-run test-design for affected TCs).
3. Owner moves on → `S --set free-qa=done` → clear-suggestion boundary 1.

## architect (optional)

1. Recommend **yes** when the impact or brief involves schema/migration changes, new or changed API paths, two or more components, or existing data that must be handled; otherwise recommend **skip**. Ask with that recommendation.
2. Yes → `S --flag architect=true`, dispatch `nqt:architect`, ask the owner the "Owner part" decisions one by one, record answers in the brief. No → `S --flag architect=false --set architect=skipped`.

## design, plan, plan-check, implement

Follow superpowers-bridge.md. After plan-check passes → clear-suggestion
boundary 2. After implement → clear-suggestion boundary 3.

## review

1. Dispatch `nqt:reviewer` with `BASE` = the base branch recorded in project.md (`origin/<baseBranch>` if present).
2. Critical/important findings → show them in plain words; fix through superpowers (dispatch an implementer per superpowers:subagent-driven-development with the finding), then re-run the reviewer once. Minor → list in the report.
3. `S --set review=done`.

## qa

1. Dispatch `nqt:qa` with `MODE=run`; for UI tickets dispatch `nqt:ui-checker` in parallel once the app is running, only for the screens the ticket changed.
2. Failures → show in user language; fix via superpowers as in review; re-run the failed scenarios.
3. `S --set qa=done`.

## report

1. Write `WORK/final-report.md` (formats.md).
2. **Checkpoint 7** — show: what changed for users, TC → proof table, review and QA results with screenshots for UI, what was not tested, then a "Technical part" with commits per repo (`git log BASE..HEAD --oneline` in each repo from `nqt.mjs repos`) and how to view each diff; the owner pushes each repo. Remind: the owner pushes; suggest `/nqt:retro <project> <ticket>` in a fresh session.
3. `S --set report=done`.
