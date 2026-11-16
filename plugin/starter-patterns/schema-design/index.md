---
title: Schema design
teaches: How to design the new tables and columns of a ticket - normal forms (1NF to BCNF) with examples, the few cases where keeping a copy of a fact is right, and keys, constraints and column types - for transactional (OLTP) databases on any engine
languages: [any]
frameworks: [any]
layers: [db]
situations: [a ticket adds a table or a column, designing the data model of a new feature, reviewing a diff that adds tables, columns or constraints]
---

Files:
- `normalization.md` — 1NF, 2NF, 3NF, BCNF (and when 4NF matters): the symptom, a small example, the fix, and three quick questions that expose a bad design.
- `deliberate-denormalization.md` — when storing a fact twice is correct (price at the time of sale, counters, report tables), and what must be recorded when you do.
- `keys-and-constraints.md` — primary and foreign keys, constraints the database should enforce, soft delete with unique rules, money, dates, text and many-to-many tables.

Use: the architect reads it when the brief adds tables or columns; the reviewer when the diff adds them; `dev` when a small plan adds one without an architect step.

**Scope: new parts only.** Apply it to the tables and columns the ticket adds. An existing structure is never normalised, renamed or "fixed" because of this pack (rules.md → Surgical changes, Preserve the scene); if it causes trouble for the ticket, report it as a smell for the risk step instead. The ticket's requirements come first, then the project's own conventions (naming, key style, soft delete), then this pack (rules.md → Pattern library priority).
