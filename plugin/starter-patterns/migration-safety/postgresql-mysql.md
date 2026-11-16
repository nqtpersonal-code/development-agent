# PostgreSQL and MySQL traps

Behaviour depends on the version: check the project's before relying on a point marked "depends".

## PostgreSQL
- **Adding a column with a constant default** needs no table rewrite on current versions (11 and later); a **volatile default** (`random()`, `gen_random_uuid()`) rewrites every row (depends on version).
- **Indexes on live tables**: `CREATE INDEX CONCURRENTLY` avoids blocking writes but cannot run inside a transaction block; if it fails it leaves an `INVALID` index that must be dropped before retrying.
- **New foreign keys and checks**: add `NOT VALID` first, then `VALIDATE CONSTRAINT` as a separate step, so the long scan does not hold a strong lock.
- **`SET NOT NULL`** scans the whole table; on newer versions an already validated `CHECK (col IS NOT NULL)` lets it skip the scan.
- **Type changes** often rewrite the table; some (for example widening `varchar(n)`) do not (depends).
- **Locks queue**: a waiting `ALTER` blocks every query behind it. Set `lock_timeout` for migrations so they fail fast instead of freezing the application.
- **`DROP ... CASCADE`** silently drops dependent views and constraints. Never use it to get past an error; read what depends on the object.
- Foreign-key columns are **not** indexed automatically: add the index.
- A unique constraint allows several NULLs (newer versions can change that with `NULLS NOT DISTINCT`). For "unique among non-deleted rows" use a partial unique index (`WHERE deleted_at IS NULL`).
- Text comparison is case-sensitive by default: `'Anna'` and `'anna'` are different. If the rule is "no duplicate names regardless of case", index `lower(col)` (or use a case-insensitive type) and say so to the owner.
- After inserting rows with explicit ids, move the sequence (`setval`) or the next insert collides.
- Batched backfills: select the batch with `FOR UPDATE SKIP LOCKED` so a batch never waits on rows another session holds.

## MySQL / MariaDB
- **DDL is not transactional**: each `ALTER` commits by itself. A failed migration leaves a half-applied state, so write steps that can be re-run (check whether the column or index already exists).
- **Online change**: say what you require, for example `ALGORITHM=INPLACE, LOCK=NONE` (or `INSTANT` where the version supports it). If the operation cannot meet it, the statement fails instead of silently locking the table. Which operations qualify depends on the version.
- Adding a foreign key creates an index on the column if none exists; plain columns used in joins still need one.
- **Collation merges names**: the default collations are case-insensitive and often accent-insensitive, so in a unique index `'Bình'`, `'binh'` and `'BINH'` can collide. Check the column's collation against the owner's rule before adding a unique index.
- Renaming a column does not rewrite stored routines or views that use the old name: search them.
- Changing a column's character set or collation rebuilds the table and its indexes.
