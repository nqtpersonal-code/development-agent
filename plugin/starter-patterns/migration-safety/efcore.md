# EF Core migrations

## Read what was generated
- Open the generated `Up()` and `Down()` and read them as code, not as output to trust. The tool compares two model snapshots; it does not know your intent.
- Also look at the SQL it will run: `dotnet ef migrations script <from> <to>` (use `--idempotent` for a script that can be applied twice).
- A rename combined with another change (type, nullability, length) can be generated as `DropColumn` + `AddColumn`: **the column's data is lost**. Check every drop in `Up()`. Split the change in two migrations, or write `RenameColumn`/`Sql(...)` by hand.
- A new NOT NULL column without a default on a table that already has rows fails or fills a meaningless default: add as nullable, backfill with `migrationBuilder.Sql(...)`, then make it NOT NULL in a later step.

## `Down()` and the model snapshot
- `Down()` must really reverse `Up()`, including data steps you added by hand; an empty or throwing `Down()` is a finding unless the migration is declared irreversible.
- The `*ModelSnapshot.cs` file changes with every migration. Two feature branches that each add a migration conflict there: resolve by regenerating the later migration on top of the merged snapshot, never by hand-editing the snapshot.
- Never edit a migration that was already applied somewhere else; add a new one.

## Data steps inside migrations
- Put data backfills in `migrationBuilder.Sql(...)`, in batches for big tables, and make them safe to run twice.
- Refer to tables and columns by name in that SQL, not through entity classes: the classes will change later and old migrations must still run.
- `RenameColumn` and `RenameTable` on SQL Server use `sp_rename`, which leaves procedures and views that use the old name broken (see `sql-server.md`).

## Applying
- Applying migrations from application start-up (`Database.Migrate()`) is fine on a local database; for anything shared it is a risk (several instances start together, and a failed step stops the app).
- Seed data belongs in its own step; `HasData` seeds are tracked by key, so changing a key deletes and re-inserts the row.
- Check the unique and filtered indexes the migration creates against the rule the owner wants: soft-deleted rows, NULLs and case rules (see `sql-server.md`, `postgresql-mysql.md`).
