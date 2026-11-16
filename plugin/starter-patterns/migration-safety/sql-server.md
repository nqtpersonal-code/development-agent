# SQL Server traps

Behaviour depends on version and edition: when a point says "depends", check the project's version before relying on it.

## Renames break things silently
- `sp_rename` (and EF Core's `RenameColumn`/`RenameTable`, which use it) does **not** update stored procedures, views, functions or triggers that mention the old name. They keep compiling in the catalog and fail when they run.
- Before a rename or drop, list dependents: `SELECT * FROM sys.sql_expression_dependencies WHERE referenced_entity_name = 'OldName'`, and search procedure and view definitions as text too (dynamic SQL is not tracked).
- Views created `WITH SCHEMABINDING` block `ALTER` of the tables they use: drop and recreate them in the migration, in the right order.

## Unique rules and NULL
- A plain unique index allows **only one** NULL. For "unique when present" use a filtered index: `CREATE UNIQUE INDEX ux_t_col ON t(col) WHERE col IS NOT NULL`.
- The same trick makes "unique among non-deleted rows" work: `WHERE IsDeleted = 0` (or `DeletedAt IS NULL`).
- The default collation is case- and often accent-insensitive: `'Bình'` and `'binh'` can count as equal in a unique index. Check the column's collation against the rule the owner wants.

## Adding or changing columns
- Adding a NOT NULL column with a default can be a metadata-only change on newer versions and editions and a full rewrite of every row on older ones (depends). Safe route on a big table: add as NULL, backfill in batches, then `ALTER COLUMN ... NOT NULL`.
- A default is a *named constraint*. Dropping or retyping the column needs the constraint dropped first; its name is system-generated unless set (`sys.default_constraints`).
- Changing a column's type rewrites it and is blocked by indexes, statistics, computed columns and constraints that use it: drop and recreate them deliberately.

## Locks and logs
- `ALTER TABLE` takes a schema lock that blocks every query on the table while it waits and while it runs.
- A statement that touches many rows escalates to a table lock (around 5,000 row locks): backfill with `UPDATE TOP (n) ... WHERE <not done yet>` in a loop.
- Index builds can be online (`WITH (ONLINE = ON)`) only on editions that support it (depends).
- DDL is transactional here, so a migration can be all-or-nothing; a large transaction still grows the log.

## Other
- SQL Server does **not** index foreign-key columns by itself: index them, or joins and deletes on the parent table scan the child.
- `IDENTITY` values are not reused after a rolled-back insert or a delete; do not rely on gaps closing. Inserting explicit ids needs `SET IDENTITY_INSERT`.
- Triggers fire during backfills and imports; know them first (`sys.triggers`).
- Temporal (system-versioned) tables have extra rules for schema changes; check before altering one.
