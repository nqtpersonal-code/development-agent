# Storing a fact twice, on purpose

A copy is correct when the two values answer **different questions**, or when a measured need justifies it **and** something keeps the copy right. A copy added "to make the query simpler" with nothing keeping it in sync is a defect.

## Cases where the copy is the right design
| Case | Example | Why |
|---|---|---|
| **Snapshot at the time of an event** | An invoice line stores the unit price and the student's name as they were when it was issued. | Later price or name changes must not rewrite history. This is *different data*, not a duplicate. |
| **Aggregate kept for speed** | `classes.enrolled_count`, an account balance, an invoice total. | Counting or summing on every read is too slow, or the total is a legal figure that must not move. |
| **Report or read table** | A nightly table of sessions per student per month. | Reports run on a copy so they do not slow or lock the live tables. |
| **Derived column** | A computed column or generated value (full name from parts, a normalised search key). | The database computes it, so it cannot drift. |
| **Measured performance copy** | A name copied next to a foreign key to avoid a join on a hot list. | Only after measuring, and only with a sync mechanism. |

## What must be recorded when you do it
Write these down in the design (architect) or the migration notes (dev); the reviewer looks for them:
1. **Which column is the source of truth** and which is the copy.
2. **What keeps the copy right**: a trigger, a computed column, the same transaction in the code, a scheduled rebuild, or "never changes" (snapshots).
3. **What happens when the source changes**: nothing (snapshot), recalculated, or both are updated.
4. **Who else writes the copy**: imports, jobs and other screens must go through the same path, otherwise the copy drifts.

## Things that look denormalised and are usually wrong
- A name or code copied into a child table with no snapshot reason and nothing updating it.
- A total next to its rows, with several places that change the rows and only one that updates the total (check them all: they are all change points).
- Two columns holding the same meaning in different formats (`status` and `is_active`), where nothing forces them to agree.

## When the ticket meets an existing copy
If a ticket changes a fact that is stored twice, **both places are change points** (rules.md → One business rule, many implementations). Do not remove the copy in the ticket unless the brief's fix mode says so; report it as a smell for the risk step.
