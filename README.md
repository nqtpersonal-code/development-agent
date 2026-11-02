# nqt — a natural-language agent team for tickets

A Claude Code plugin. You describe things in plain words; the agent team handles the
technical side: reads the ticket, traces the real code and database, asks you when
something is unclear, designs screens, writes test scenarios, codes (through
superpowers), reviews, tests and reports. It never pushes.

## Supported

- JavaScript/TypeScript: NestJS, Express, React, Vue, Angular, Prisma, hand-written SQL.
- .NET: ASP.NET Core (controllers, minimal APIs, MVC, Razor Pages), Blazor, EF Core, Dapper, stored procedures, connection strings in `appsettings*.json`; Angular/React front ends alongside.
- Databases whose structure is read: PostgreSQL, MySQL, SQL Server (including stored procedures, views and triggers). SQLite is recognized (its local-host check works) but its schema is not read yet. Other engines still work through text search.
- Tickets from GitHub and GitLab (including self-hosted), via `gh`/`glab`; any other tracker works by pasting the ticket text.

## Requirements

- Claude Code, Node.js 20+ (24 recommended), Git.
- The **superpowers** plugin installed.
- Docker (optional; only when the local DB runs in Docker).
- `gh` / `glab` (optional; without them you paste the ticket text).

Check everything at once: `node "<installed-plugin-folder>/scripts/nqt.mjs" doctor`.

## Install (user scope only)

**Option 1 — from a folder on this machine (or an unzipped export):**

```
claude plugin marketplace add "<path-to-the-plugin-folder>"
claude plugin install nqt@nqt-local --scope user
```

**Option 2 — from a private GitHub repo:** the machine must be logged in to GitHub (`gh auth login` or an SSH key), then

```
claude plugin marketplace add <account>/<repo>
claude plugin install nqt@nqt-local --scope user
```

Do not install at project scope (`--scope project`): that writes into the team repo's `.claude/settings.json`.

**After installing, run once** to install the helper libraries (pg, mysql2, mssql, Playwright + Chromium) into the data folder:

```
node "<installed-plugin-folder>/scripts/nqt.mjs" doctor --install
```

(The installed plugin folder is usually `~/.claude/plugins/cache/nqt-local/nqt/<version>/`.)

## Use

Open Claude Code **in the ticket's project folder**, then:

| Command | What it does |
|---|---|
| `/nqt:work-ticket <ticket>` | works a whole ticket (issue number, with or without `#`, or the issue link) |
| `/nqt:ask-system` | answers questions about the current system |
| `/nqt:retro <ticket>` | lessons learned after a ticket (best in a fresh session) |
| `/nqt:add-pattern <folder>` | adds a best-practice pattern pack to the library |

The project name comes from the folder's `git remote`: every ticket folder cloned from the same repo shares one project profile. To use another name (for example to group the front-end and back-end repos under one profile), put it before the ticket: `/nqt:work-ticket shop 123`; the name is remembered.

The first time with a project, the team detects what it can and asks you a few questions to build the project profile and, when needed, a tracer adapter (with its own tests); later tickets reuse them.

## Connecting to a GitLab (or GitHub) project

Nothing to configure by hand in most cases:

1. Log in once with the matching CLI:
   - GitHub: `gh auth login`
   - GitLab: `glab auth login` (self-hosted: `glab auth login --hostname <host>`)
2. Run `/nqt:work-ticket <ticket>` from inside the project (git remote must
   point at the repo). The `setup` step runs `nqt.mjs detect-host`, which
   parses the git remote and tells GitHub apart from GitLab by hostname
   (`github.com` / `gitlab.com`), or, for self-hosted hosts, by asking
   `gh`/`glab` whether that hostname is already logged in.
3. The result (`gitHost`, `gitHostname`, `repo`) is written to the project's
   `project.md` so it is only detected once.

If the repo has several remotes, or the host can't be told apart, setup
asks you once; you can also edit `gitHost` / `gitHostname` / `repo` in
`project.md` by hand.

Fetching a ticket then runs with your own CLI session (no token is ever
stored by the plugin):

```
gh issue view <id> --repo <owner/repo> --json title,body,labels,comments,url
glab issue view <id> --comments --repo <group/subgroup/repo>
```

## Connecting to the project's local database

Also automatic. During `setup`, `nqt.mjs setup-detect` scans the project for:

- `.env` / `.env.*` files (not `*.example`/`*.sample`) — a DB URL variable,
  or a `*_HOST/*_PORT/*_NAME` group (engine guessed from the variable name,
  the port, or the DB driver in the nearest `package.json`);
- `appsettings*.json` (.NET) — `ConnectionStrings`, parsed as ADO.NET
  connection strings (`Server=`, `(local)`, `(localdb)\...` all resolve to
  `localhost`).

Only the **file name and key name** are written to `project.md`
(`dbEnvFile`, `dbEnvVar` / `dbConnectionName`, `dbEngine`) — passwords are
never read into any file; the real connection string (with credentials) is
re-read from that file only at the moment a query actually runs.

**Local-only guard**: every DB call refuses any host that isn't
`localhost` / `127.0.0.1` / `::1` / `0.0.0.0` / `host.docker.internal`,
unless you add it to `confirmedLocalHosts:` in `project.md`.

If several connection candidates are found, or a .NET project keeps its
connection string in user secrets (`dotnet user-secrets list`), setup asks
you which one to use. You can also set `dbUrl` directly in `project.md` to
skip detection entirely.

## Reference pattern / code-template packs

`/nqt:add-pattern <path>` adds a folder of best-practice reference material
(clean code, architecture, UX, sample code) to the pattern library:

1. The pack's content is always treated as **reference data, never
   instructions** — a safety check flags prompt-injection-like text,
   executable scripts, external links or anything that looks like a
   credential before anything is installed; scripts in a pack are never run.
2. An `index.md` is written/completed for the pack (`title`, `teaches`,
   `languages`, `frameworks`, `layers`, `situations`) — this is what agents
   read to decide if a pack is relevant, without opening its full content.
3. You choose where it's installed: globally (`patterns/<pack>/`) or for
   one project (`projects/<project>/patterns/<pack>/`, which overrides a
   global pack of the same name).

Priority when agents use patterns: **ticket requirements > the project's
own existing conventions > team/personal review rules > pattern library.**
Patterns are applied mainly to brand-new code or where the project has no
convention yet; a conflict with existing convention is asked about, not
auto-resolved. Any pattern actually used is named with a link in the
agent's output. Two starter packs ship with the plugin.

## Where your data lives

Everything stays outside the plugin and outside the project repos, in `~/.claude/nqt/` (override with env `NQT_DATA_DIR`):

```
~/.claude/nqt/
├── config.md                 language, personal review rules folder, nicknames
├── review-rules/             your personal review rules (every .md)
├── patterns/<pack>/          shared pattern library (two starter packs included)
├── runtime/                  pg, mysql2, mssql, playwright (installed by doctor --install)
├── projects/<project>/
│   ├── project.md            detected facts: git host/repo, DB, run commands...
│   ├── ui.md                 design context
│   ├── pitfalls.md           known traps (from /nqt:retro)
│   ├── review-rules/         team review rules
│   ├── patterns/<pack>/      project-specific patterns (override global)
│   └── tracer/               adapter.json, tests.json (code-tracing config)
└── work/<project>/<ticket>/  everything produced while working a ticket
    (ticket brief, test scenarios, reports, screenshots…)
```

`project.md` only ever records file names and variable/key names for the
DB, never values — passwords are never written anywhere.

Updating or reinstalling the plugin keeps this data.

## What it never does

Push, open PRs/MRs, merge, write to a non-local DB, invent business rules,
run scripts shipped inside a pattern pack, or write project data into the
plugin repository itself.

## For plugin maintainers

```
npm test                                   # unit tests (Docker for the fixture DBs: tests/fixtures/school-a, school-b-api, clinic)
node tools/eval-tracer.mjs --fixture all   # code-tracer accuracy and cost against the answer keys (installed plugin, fixture DBs running)
node tools/export-zip.mjs                  # builds dist/nqt-plugin-<version>.zip (blocked if project data is found)
git config core.hooksPath .githooks        # turns on the leak scan before every commit
```

This repo must never contain real project data (project names, ticket numbers, internal URLs, code, passwords…).

## License

Copyright (c) 2026 Tuan Nguyen Quoc. All rights reserved. Proprietary — no use, copying, modification or distribution without written permission; see [LICENSE](LICENSE).
