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
gitHost: github | gitlab
repo: <owner/repo>
baseBranch: dev                  # or main
branchPattern: feature/{ticket}-{slug}
commitConvention: <e.g. conventional commits, or "follow git log">
runApp: <command(s) to start the app>
runTests: <command to run the test suite>
appUrl: http://localhost:5173
dbEngine: postgres | mysql
dbUrl: <only if not taken from an env file>
dbEnvFile: <path relative to project folder, e.g. api/.env>
dbEnvVar: DATABASE_URL           # or omit and use DB_HOST/DB_PORT/... parts
confirmedLocalHosts: []
dbTool: <how to run queries: prisma, mysql client, docker exec …>
loginAccount: <test account for the local app>
graphify: off                    # on | off
---
```

Components (front end, back end, workers) live in `tracer/adapter.json`.

## tracer/adapter.json

```
{ "version": 1,
  "components": [{ "name": "api", "root": "api", "kind": "be" }, { "name": "web", "root": "web", "kind": "fe" }],
  "aliases": { "<table>": ["<model or helper spelling>"] },
  "dbAccessPatterns": ["<regex>"], "routePatterns": ["<regex: (method)(path) or (path)>"],
  "apiClientPatterns": ["<regex: (method)?(path)>"], "apiBase": "/api/v1",
  "jobPatterns": ["<regex>"],
  "assumptions": [{ "id": "...", "description": "...", "check": { "fileExists": "path" } | { "pattern": "regex", "inRoot": "dir" } }] }
```

`kind` is `be`, `fe`, `worker` or `shared`. `tests.json` is a list of
`{ "name", "start": { "table", "column" }, "expect": [{ "file", "viaIncludes"? }] }`.

## state.json (in `<work>`)

```
{ "project", "ticket", "current": <step>, "steps": { <step>: "pending|running|waiting|done|skipped" },
  "waitingFor": null | { "kind": "question|approval|clear-suggestion", "text", "since" },
  "flags": { "hasUI": true|false|null, "architect": true|false|null },
  "planCheckRounds": 0, "files": { <name>: <path> }, "updatedAt" }
```

Steps in order: `setup, analysis, screens, brief, test-design, free-qa,
architect, design, plan, plan-check, implement, review, qa, report, done`.
Manage it with `nqt.mjs state <work> --init <project> <ticket> | --set step=status | --wait kind text | --clear-wait`.

## Ticket work files (in `<work>`)

| File | Written by | Content |
|---|---|---|
| `ticket.md` | setup | ticket title, body, comments, labels, link (verbatim) |
| `trace/impact.json` | code-tracer (script) | raw impact result |
| `trace/impact.md` | code-tracer | Technical part: confirmed places with file:line, certainty, chains. Owner part: affected screens/functions in natural language with links; "Not scanned" list; real example rows from the DB |
| `ba.md` | ba | requirement groups, source comparison table, contradictions, questions (ordered, each with recommendation) |
| `screens.md` | screen-designer | screen flow (mermaid), per-screen content (tabs, filters, fields, buttons, messages, navigation), desktop + mobile layout, real data examples |
| `mockup/index.html` | screen-designer | optional static clickable mockup |
| `ticket-brief.md` | orchestrator (from ba/screens/trace + owner answers) | see below |
| `test-scenarios.md` | qa (design mode) | per TC: steps in user language with real data, expected result; cross-impact scenarios X1…; TCs that cannot be verified |
| `questions.md` | orchestrator | free Q&A log: question, answer (natural language + links), proposed brief changes and owner decision |
| `architecture.md` | architect | Technical part: DB/migration changes, legacy data handling, API, flow, reuse, risks. Owner part: business-impacting decisions as questions |
| `spec.md` | superpowers:brainstorming | design spec |
| `plan.md` | superpowers:writing-plans | implementation plan |
| `plan-check.md` | plan-checker | verdict pass/revise, uncovered TCs, out-of-scope work, unhandled cross-impacts, round number |
| `review.md` | reviewer | findings (severity, business consequence, link), rules used or "no rules", Technical appendix |
| `qa-report.md` | qa (+ ui-checker section) | per scenario pass/fail with evidence (data before/after, responses, screenshots) |
| `ui/` + `ui/report.json` | ui-checker | screenshots per viewport and the script report |
| `final-report.md` | orchestrator | what changed (natural language), TC → where implemented → which test proves it, review and QA results, not tested, Technical part: commits and diff summary |

### ticket-brief.md sections

1. Summary (natural language, 3–5 lines)
2. Requirements (grouped)
3. Acceptance criteria — `TC1…TCn`, each with a source label; screens named by what the user sees
4. Screens (from `screens.md`, or "no UI change")
5. Impact summary (from `trace/impact.md`, owner part)
6. Owner answers (question → answer, dated)
7. Open questions — must be empty before design

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
