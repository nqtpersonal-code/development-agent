# Layer-3 evaluation checklist (fixtures only, fictional data)

Prepare: `docker compose up -d` in `tests/fixtures/school-a` and `tests/fixtures/school-b-api`;
school-a: `cd api && npm run db:push && npm run seed && npm run build && node --env-file=.env dist/main.js`,
`cd web && npx vite --port 5173`. Open Claude Code **in a fresh session** inside the fixture folder.
Commit the fixture folder state first (`git -C tests/fixtures/school-a status` must be clean apart from runs).

Record each run in `tests/e2e/results/<date>-<ticket>.md` (gitignored).

| # | Ticket | Check | Pass when |
|---|---|---|---|
| 1 | a-1 | first run builds project.md and the tracer adapter with tests | tracer-test passes; owner asked only what detection could not settle |
| 2 | a-1 | impact lists the A-Q1 places with links | all 11 places of `answers/school-a.json` A-Q1 (owner part names screens/jobs/export) |
| 3 | a-2 | ambiguity | asks whether "vắng có phép" counts, with real rows (Lê Minh Châu, L1, 22/09), instead of deciding |
| 4 | a-2 | duplicated logic | flags fee computed in two places (server and web) |
| 5 | a-3 | stale docs | presents docs vs code conflict with links and asks; does not trust docs |
| 6 | a-4 | screens | screen-designer groups fields and plans phone layout; offers mockup |
| 7 | a-4 | ui-checker | reports overflow/clipped/small targets before the fix and none of items 1–4 after |
| 8 | any | language | owner-facing messages free of route/props/component/function jargon (outside "Technical part") |
| 9 | any | hygiene | no work files in the fixture repo (only intended code + `.superpowers/sdd/`), no `.gitignore` edits, no push |
| 10 | any | branch | feature branch created from the base branch |
| 11 | any | QA data | scenarios cite real seeded rows |
| 12 | any | resume | `/clear` then `/nqt:work-ticket` continues at the recorded step and re-asks a pending question |
| 13 | any | nicknames | nicknames from config.md appear in step/agent announcements |
| 14 | b-1 | impact only | worker, contact report (suspected) and both web screens listed; teachers route not listed |
