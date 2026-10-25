# Layer-3 evaluation checklist (fixtures only, fictional data)

Prepare **outside the plugin repo** (runs create branches and commits, and run names must not appear in the repo):
1. Copy `tests/fixtures/school-a` to e.g. `C:/nqt-e2e/run-a` (without `node_modules`), `git init`, commit everything on a `dev` branch.
2. Use a run-only project name that never appears in the plugin repo, e.g. `e2e-alpha` (`/nqt:work-ticket e2e-alpha a-1`).
3. `docker compose up -d` there; `cd api && npm install && npm run db:push && npm run seed && npm run build && node --env-file=.env dist/main.js`; `cd web && npm install && npx vite --port 5173`.
4. Open Claude Code **in a fresh session** inside the copy. Same for school-b (`school-b-api` + `school-b-web` side by side, name `e2e-beta`).
5. Afterwards delete `<data dir>/projects/e2e-*` and `<data dir>/work/e2e-*` if you no longer need them.

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
| 15 | a-2 | change points | says the fee rule lives in two places (server invoice and the web estimate) and asks the scope; brief lists both as change points |
| 16 | a-2 | risk step | risk-analyst runs (diverging copies), compares patch vs align with measured signals, recommends; owner decision lands in Fix mode |
| 17 | a-1 | variants | reports that the attendance query, unlike the others, does not filter deleted students (variant) without fixing it |
| 18 | any | preserve the scene | diff touches only must-patch points; QA regression on re-check points compares before/after |
| 19 | any | QA economy | each scenario has a Verify-by method; browser only for changed screen flows; totals shown |
| 20 | two-repo folder | workspace | project asked once, components found by remote, branch in each repo, report per repo |
| 14 | b-1 | impact only | worker, contact report (suspected) and both web screens listed; teachers route not listed |
