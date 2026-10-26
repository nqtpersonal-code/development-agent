# nqt — a natural-language agent team for tickets

A Claude Code plugin. You describe things in plain words; the agent team handles the
technical side: reads the ticket, traces the real code and database, asks you when
something is unclear, designs screens, writes test scenarios, codes (through
superpowers), reviews, tests and reports. It never pushes.

## Supported

- JavaScript/TypeScript: NestJS, Express, React, Vue, Angular, Prisma, hand-written SQL.
- .NET: ASP.NET Core (controllers, minimal APIs, MVC, Razor Pages), Blazor, EF Core, Dapper, stored procedures, connection strings in `appsettings*.json`; Angular/React front ends alongside.
- Databases whose structure is read: PostgreSQL, MySQL, SQL Server (including stored procedures, views and triggers). Other engines still work through text search.

## Requirements

- Claude Code, Node.js 20+ (24 recommended), Git.
- The **superpowers** plugin installed.
- Docker (optional; only when the local DB runs in Docker).
- `gh` / `glab` (optional; without them you paste the ticket text).

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

## Where your data lives

Everything stays outside the plugin and outside the project repos, in `~/.claude/nqt/`:

- `config.md` — language (`vi`/`en`), personal review rules folder, nicknames for agents and steps.
- `review-rules/` — your personal review rules (every `.md`).
- `patterns/` — the shared pattern library (two starter packs included).
- `projects/<project>/` — `project.md`, `ui.md`, `pitfalls.md`, `review-rules/` (team rules), `patterns/`, `tracer/`.
- `work/<project>/<ticket>/` — everything produced while working a ticket (ticket brief, test scenarios, reports, screenshots…).

Updating or reinstalling the plugin keeps this data.

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
