# Data access in .NET: EF Core, Dapper, raw SQL

## SQL built from strings
- [ ] No user input concatenated or interpolated into a SQL string. EF Core: `FromSql`/`FromSqlInterpolated` parameterize, `FromSqlRaw` with a built string does not. Dapper and ADO.NET: values go in parameters.
- [ ] A dynamic piece that cannot be a parameter (a column or table name) comes from a fixed list in code, never from the request.

## EF Core queries
- [ ] Read-only queries use `AsNoTracking()` when the project does so elsewhere.
- [ ] Filters run in the database: `Where` before `ToList()`, not after; a method the provider cannot translate is not silently evaluated in memory on a big table.
- [ ] No query or `SaveChanges` inside a loop over results (N+1): load related rows together with `Include`, a projection or one query with `Contains`.
- [ ] `First`/`FirstOrDefault` on a query that must be deterministic has an `OrderBy`.
- [ ] Several related writes happen in one `SaveChanges` (one transaction), or in an explicit transaction; a failure halfway does not leave half the data.
- [ ] Concurrency: a row edited by several users has a concurrency token or the project's own rule.

## Hand-written SQL beside the ORM (Dapper, stored procedures, reports)
- [ ] The same business filters the ORM side applies are repeated: **soft-delete (`IsDeleted`, `DeletedAt`), tenant, active flag**. A query written by hand that forgets them shows deleted rows. Compare with the sibling queries on the same table.
- [ ] Column lists are explicit (no `SELECT *` mapped to a class that changes).
- [ ] A changed column or table is also changed in the procedures, views and reports that use it (they are not in the model snapshot).

## Data rules
- [ ] A new uniqueness or "already exists" check is also enforced by the database (unique index), or the owner accepted that two simultaneous requests can both pass the check.
- [ ] Case, accents and soft-deleted rows are handled the way the owner decided (see the `migration-safety` pack for index and collation traps).
- [ ] Deleting a parent row has a defined effect on children (cascade, restrict, or soft delete with children hidden).
