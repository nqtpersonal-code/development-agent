# Keys, constraints and column types

Follow the project's own conventions first (key style, naming, soft delete); this is what to check when the project has none, or when a new table could do better without clashing with them.

## Keys
- [ ] Every table has a primary key. Use a **surrogate key** (identity/serial `bigint`, or a UUID if rows are created in several places) and still put a **unique constraint on the natural key** (a code, an email) so duplicates are impossible.
- [ ] Every relationship is a **declared foreign key**, with an explicit rule for deleting the parent (restrict, cascade, set null, or soft delete with the children hidden). Index the foreign-key columns (some engines do not do it for you: see `migration-safety`).
- [ ] A many-to-many relationship is a **junction table** with a composite unique key (or composite primary key) on the pair, plus the columns that belong to the relationship (joined on, status).
- [ ] Avoid a `type` + `id` pair that points at different tables ("polymorphic" link): the database cannot check it. Use one foreign-key column per target, or one table per kind.
- [ ] Avoid an "attributes" table of key/value rows for things you know in advance (EAV): you lose types, constraints and simple queries.

## Constraints the database should enforce
- [ ] **NOT NULL by default**; nullable only when "unknown" or "not applicable" is a real state, and then the code and the unique rules deal with NULL on purpose.
- [ ] **CHECK** for ranges and allowed states (`quantity >= 0`, `end_date >= start_date`). A fixed set of states can be a CHECK, an enum type, or a small lookup table (use the table when the owner may add values or labels need translating).
- [ ] **Unique rules decide what "same" means.** Decide with the owner: case, accents, spaces, and **soft-deleted rows**. "No two active students with the same code" is a unique index filtered to non-deleted rows, not a plain unique index. (Filter and collation details: `migration-safety`.)
- [ ] A rule that must always hold lives in the database, not only in code: two simultaneous requests can both pass a check made in code.

## Column types
- [ ] **Money:** `decimal(precision, scale)` and a currency when more than one is possible, never floating point.
- [ ] **Dates and times:** store UTC (or a timestamp with time zone); a calendar date with no time is a date type.
- [ ] **Identifiers that are not numbers** (phone numbers, tax codes, ids with leading zeros) are text.
- [ ] **Text:** Unicode types for names (Vietnamese and other accented text); sensible maximum lengths; no length limit shorter than real data.
- [ ] **Booleans:** a real boolean/bit; two booleans that exclude each other are a status column.

## Row lifecycle
- [ ] **Soft delete** (`deleted_at` or `is_deleted`): list the places that must filter it (screens, reports, exports, unique rules, joins) — this is the most common source of "deleted rows reappear".
- [ ] **Audit columns** (`created_at`, `updated_at`, who) when the project uses them; follow its names.
- [ ] Reference data (statuses, types) is inserted by a migration or seed step, not by hand.

## Naming
Follow the project: singular or plural table names, `snake_case` or `PascalCase`, how foreign keys and indexes are named. A new table that looks different from its neighbours is a finding; a new convention is not the ticket's business.
