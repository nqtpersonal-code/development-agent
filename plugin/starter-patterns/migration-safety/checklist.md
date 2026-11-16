# Migration checklist (any engine)

Go through it for every change to the stored data. A "no" or "don't know" is a finding or a question for the owner, never something to assume.

## 1. Who depends on it
- [ ] Every reader and writer of the column or table is listed: ORM mappings, hand-written SQL, stored procedures, views, triggers, jobs, reports, exports (`nqt.mjs impact` and `nqt.mjs schema` show database objects too).
- [ ] Code that is not in this repository but uses the same database is named as a question ("is there another system that reads this table?").

## 2. Order of change: expand, move, switch, contract
- [ ] **Expand**: add the new column or table next to the old one (nullable, or with a default that costs nothing).
- [ ] **Move**: copy or backfill existing rows.
- [ ] **Switch**: the code reads and writes the new place.
- [ ] **Contract**: remove the old place in a *later* change, after the switch is proven.
- [ ] A rename, a type change or a drop is never done in the same step as the code that depends on it: while it rolls out, old code and the new schema (or the reverse) run side by side.

## 3. Reversible, or openly irreversible
- [ ] The migration has a way back (`down` / rollback script), and it was run.
- [ ] A step that destroys data (drop column or table, narrowing a type, truncate, delete) is marked irreversible, says what is lost, and has a copy of the data first.
- [ ] The plan says what happens if the change must be undone halfway.

## 4. Existing data against a new rule
Before adding a unique, not-null, foreign-key or check rule, query the real (local) data for rows that already break it:
- [ ] duplicates, NULLs, orphans, values out of range;
- [ ] **soft-deleted rows**: should a deleted row still block the rule? Decide on purpose (a filtered/partial unique index lets a deleted name be reused).
- [ ] What happens to the rows that break the rule is an owner decision (fix, delete, keep and exclude), not a default.

## 5. Backfills
- [ ] In batches (thousands of rows, not the whole table in one statement), so locks and the transaction log stay small.
- [ ] Safe to run twice and to resume after an interruption (selects only rows still to do).
- [ ] Triggers on the table that will fire during the backfill are known.
- [ ] Row counts and a few real rows checked before and after.

## 6. Locks and size
- [ ] How big is the table in production? Unknown → ask the owner and plan as if it is large.
- [ ] Statements that rewrite the table or hold a schema lock are identified (engine files tell which).
- [ ] New columns have a sensible value for old rows, and the application copes with both old and new rows.

## 7. Prove it
- [ ] Run up, then down, then up again on a copy of realistic data; run it twice to see it is repeatable.
- [ ] Open the screens and run the jobs that use the changed data.
- [ ] Reference or seed data is changed in its own step, not hidden inside a schema change.
