---
title: Migration safety
teaches: How to change a database schema or migrate data without losing rows, breaking old code or locking the system - a checklist for every engine plus engine-specific traps for SQL Server, PostgreSQL, MySQL and EF Core
languages: [any, csharp, typescript]
frameworks: [efcore, prisma, any]
layers: [db]
situations: [a ticket adds, renames, drops or retypes a column or table, a new unique or not-null rule on existing data, a data backfill, reviewing or planning a migration]
---

Files:
- `checklist.md` — the engine-independent checklist: order of change, reversibility, backfills, existing data that breaks a new rule, locks.
- `sql-server.md` — SQL Server traps (renames that silently break stored procedures, unique rules with NULLs, lock escalation, no automatic foreign-key index).
- `postgresql-mysql.md` — PostgreSQL and MySQL traps (long locks, concurrent indexes, non-transactional DDL, collations that merge Vietnamese names).
- `efcore.md` — EF Core migrations: read the generated code, rename versus drop-and-add, `Down()`, branch conflicts.

Use: the architect reads it when the brief changes how data is stored; `dev` and the reviewer read the files for the engine of the project. Project conventions win (rules.md → Pattern library priority). Migrations are written and tried on the **local** database only.
