# nqt file formats

`<dataDir>` defaults to `~/.claude/nqt` (override with env `NQT_DATA_DIR`).
`<plugin>` is the installed plugin folder; scripts run as
`node <plugin>/scripts/nqt.mjs <command>`. `<work>` below means
`<dataDir>/work/<project>/<ticket>/`.

## Data directory

```
<dataDir>/
├── config.md                    language, reviewRules.personal, pluginSourceDir, nicknames
├── review-rules/                personal review rules (*.md), default location
├── patterns/<pack>/index.md     global pattern library
├── runtime/                     pg, mysql2, playwright (installed by `doctor --install`)
├── projects/_map.json            remembered project names (git remote → project, or folder → project)
├── projects/<project>/
│   ├── project.md
│   ├── ui.md                    project design context (owner-confirmed)
│   ├── pitfalls.md              known traps (added only by /nqt:retro)
│   ├── review-rules/            team review rules (*.md)
│   ├── patterns/<pack>/         project patterns (override global ones)
│   └── tracer/{adapter.json,tests.json}
└── work/<project>/
    ├── _questions/<YYYY-MM-DD>.md   /nqt:ask-system logs
    ├── _graph/                      optional Graphify output
    └── <ticket>/                    one ticket's work files (below)
```

## project.md

Frontmatter (all optional except `name`); body holds free notes for agents.

```
---
name: <display name>
aliases: [<other names used for this project>]
language: vi                     # override config language for this project
gitHost: github | gitlab           # from `nqt.mjs detect-host`
gitHostname: <github.com, gitlab.com or the self-hosted name>
repo: <owner/repo or group/subgroup/repo>   # where the issues live (with several repos: the one holding issues)
baseBranch: dev                  # or main
branchPattern: feature/{ticket}-{slug}
commitConvention: <e.g. conventional commits, or "follow git log">
runApp: <command(s) to start each component, with absolute paths so app-check can tell which folder runs>
runTests: <command to run the test suite, or none>
writeTests: no                  # yes = the project requires automated tests for changes (write them its way); no = never add tests or test frameworks
appUrl: http://localhost:5173      # the web app; its port is checked with nqt.mjs app-check
apiUrl: http://localhost:3101      # the server, when separate
dbEngine: postgres | mysql | sqlserver
dbUrl: <only if not taken from an env file>
dbEnvFile: <path relative to project folder, e.g. api/.env, or src/App/appsettings.Development.json>
dbConnectionName: DefaultConnection   # for appsettings JSON (ADO.NET connection string; SQL Server, Npgsql, MySQL)
dbEnvVar: DATABASE_URL           # or omit and use DB_HOST/DB_PORT/... parts
confirmedLocalHosts: []
loginAccount: <test account for the local app>
graphify: off                    # on | off
---
```

Components (front end, back end, workers) live in `tracer/adapter.json`.

## tracer/adapter.json

```
{ "version": 1,
  "components": [{ "name": "api", "root": "api", "kind": "be" }, { "name": "web", "root": "web", "kind": "fe" }],
  // or, when each ticket folder holds one clone per repo: { "name": "web", "remote": "group/frontend", "path": "src", "kind": "fe" }
  "aliases": { "<table>": ["<model or helper spelling>"] },
  "dbAccessPatterns": ["<regex>"], "routePatterns": ["<regex: (method)(path) or (path)>"],
  "apiClientPatterns": ["<regex: (method)?(path)>"], "apiBase": "/api/v1",
  "jobPatterns": ["<regex>"],
  "assumptions": [{ "id": "...", "description": "...", "check": { "fileExists": "path" } | { "pattern": "regex", "inRoot": "dir" } }] }
```

`kind` is `be`, `fe`, `worker` or `shared`. `tracer/health.json` is the snapshot taken when the adapter was built or last updated (`nqt.mjs tracer-health --save`); each run compares against it to detect an outdated adapter. `tests.json` is a list of
`{ "name", "start": { "table", "column" }, "expect": [{ "file", "viaIncludes"? }] }`.

## state.json (in `<work>`)

```
{ "project", "ticket", "current": <step>, "steps": { <step>: "pending|running|waiting|done|skipped" },
  "waitingFor": null | { "kind": "question|approval|clear-suggestion", "text", "since" },
  "flags": { "hasUI": true|false|null, "architect": true|false|null },
  "planCheckRounds": 0, "files": { <name>: <path> }, "updatedAt" }
```

Steps in order: `setup, analysis, screens, risk, brief, test-design, free-qa,
architect, design, plan, plan-check, implement, review, qa, report, done`.
Manage it with `nqt.mjs state <work> --init <project> <ticket> | --resume | --set step=status | --flag hasUI=true | --wait kind text | --clear-wait`.

## Ticket work files (in `<work>`)

| File | Written by | Content |
|---|---|---|
| `ticket.md` | setup | ticket title, body, comments, labels, link (verbatim) |
| `trace/impact.json` | code-tracer (script) | raw impact result |
| `trace/impact-<branch>.md` | code-tracer (`BRANCH`) | one branch of a split trace, same format as impact.md; merged by `TASK=merge` |
| `trace/adapter-draft.json` | code-tracer (survey) | draft tracer adapter before the owner's answers |
| `trace/impact.md` | code-tracer | Technical part: confirmed places with file:line, certainty, chains. Owner part: affected screens/functions in natural language with links; **Variants** (same rule implemented differently, with what differs); **Change points** (each fragment the ticket's behaviour lives in: must patch / do not touch / re-check, with link and radius); smells involved; **What else this could break**; **Already in the system** (odd data or behaviour not caused by the ticket); "Not scanned" list; real example rows from the DB |
| `trace/recheck-<n>.md` | code-tracer (re-check) | one doubted conclusion: right / wrong / why, with links |
| `risk.md` | risk-analyst | per smell: owner part (what is fragmented, options A patch-and-preserve / B fix-the-smell / hybrid with immediate and later risk, recommendation) and technical part (measured signals per option, files touched, regression scenarios) |
| `ba.md` | ba | requirement groups, source comparison table, contradictions, side effects, questions (owner question format), draft criteria, UI touched, screen design needed (yes/no + reason), Need from tracer |
| `screens.md` | screen-designer | screen flow (mermaid), per-screen content (tabs, filters, fields, buttons, messages, navigation), desktop + mobile layout, real data examples |
| `mockup/index.html` | screen-designer | optional static clickable mockup |
| `ticket-brief.md` | ba (`MODE=brief`, from ba/screens/trace/risk + owner answers); Owner answers added by `nqt.mjs answer` | see below |
| `test-scenarios.md` | qa (design mode) | per scenario: id (TCn / Xn / Rn), steps in user language with real data, expected result, **Verify by** (`code` / `api` / `browser`) with one-line reason; TCs that cannot be verified; count per method |
| `questions.md` | orchestrator | free Q&A log: question, answer (natural language + links), proposed brief changes and owner decision |
| `architecture.md` | architect | Technical part: DB/migration changes, legacy data handling, API, flow, reuse, risks. Owner part: business-impacting decisions as questions |
| `spec.md` | superpowers:brainstorming | design spec |
| `plan.md` | superpowers:writing-plans | implementation plan |
| `plan-check.md` | plan-checker | verdict pass/revise, round, findings graded blocker / should / note, "needs owner" items |
| `implementation-notes.md` | dev | tasks done, commits per repo, self-check results, test data created and removed, contradictions with the brief, late change points |
| `superpowers-review.md` | orchestrator | superpowers' code review of the branch: verdict and findings (≤20 lines) |
| `review.md` | reviewer | findings (severity, business consequence, link), rules used or "no rules", Technical appendix |
| `qa-report.md` | qa (+ ui-checker section) | app-check result, per scenario pass/fail with evidence (data before/after, responses, screenshots), Test data (created / removed), not tested, Already in the system |
| `ui/` + `ui/report.json` | ui-checker | screenshots per viewport and the script report |
| `final-report.md` | orchestrator | what changed (natural language), TC → where implemented → which test proves it, review and QA results, not tested, **Already in the system before this ticket** (seen, not changed), Technical part: commits and diff summary |

### ticket-brief.md sections

1. Summary (natural language, 3–5 lines)
2. Requirements (grouped)
3. Acceptance criteria — `TC1…TCn`, each with a source label; screens named by what the user sees
4. Screens (from `screens.md`, or "no UI change")
5. Impact summary (from `trace/impact.md`, owner part), including variants
6. Change points — table: place (user-facing name + link) · category (must patch / do not touch / re-check) · sibling group · owner decision
7. Fix mode — `Refactor allowed: yes/no` (from the ticket or the owner; default no) and, per smell, the chosen option from `risk.md`
8. Owner answers (question → answer, dated)
9. Open questions — must be empty before design

## Owner questions

Agents that need the owner's decision write each question as:

- `Q<n>` · **header** (≤12 characters, e.g. "Excused") · the question in one sentence, with screens, fields and real data the owner recognises;
- **options**: 2–4 short labels with one-line consequences; the **recommended option first**, marked "(Recommended)" in the configured language; a question with no sensible options is marked `open`;
- **evidence**: one or two lines with real data and links (the lead shows them before asking);
- **depends on**: `Q<k>` when it only makes sense after another answer, else `none`.

The lead asks independent questions together (up to 4 per batch).

## pitfalls.md entry

```
- <YYYY-MM-DD> · ticket <id> · <trap in one sentence> ([file:line](path#Lx))
```

Only traps ("every students query must filter deleted_at"), never business rules.

## Pattern pack index.md

```
---
title: <name>
teaches: <one line>
languages: [typescript, java, any]
frameworks: [react, nestjs, any]
layers: [ui, server, db, architecture]
situations: [<when to use>]
---
<files in the pack and what each covers>
```
