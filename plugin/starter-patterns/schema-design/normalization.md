# Normal forms in practice

Default for a transactional database: **new tables in 3NF, or BCNF when it costs nothing**, then relax on purpose (see `deliberate-denormalization.md`). The examples use a fictional school.

## Three questions that expose most problems
1. **Update:** if this fact changes, how many rows must be edited? More than one means it is stored more than once.
2. **Insert:** can I record a teacher (or a class, a product) before any row refers to it? If not, a fact is trapped inside another fact's row.
3. **Delete:** if I delete the last row that mentions something, do I lose a fact I still need (the student's name when their last enrolment goes)?

## 1NF — one value per column, no repeating groups, a key per row
- Symptoms: `parent_phones = '0900000010, 0910000010'`; `phone1`, `phone2`, `phone3`; a column holding a list, a JSON blob of things you filter or join on.
- Fix: a child table (`student_phones(student_id, phone)`) with a key of its own.
- Fine to keep as one value: a field that is never searched, joined or counted on its own (a free-text note, an opaque payload).

## 2NF — every non-key column depends on the whole key
Only matters when the key has several columns.
- Symptom: `enrollments(student_id, class_id, student_name, joined_on)` — `student_name` depends on `student_id` alone.
- Fix: keep `student_name` in `students`; `enrollments` keeps only what depends on the pair (`joined_on`).

## 3NF — non-key columns depend on the key, not on each other
- Symptom: `classes(class_id, teacher_id, teacher_name)` — `teacher_name` follows `teacher_id`, not `class_id`. Renaming a teacher means editing every class.
- Fix: `teacher_name` lives in `teachers`.
- The usual sources: copied names, copied codes, a city column next to a postal code, a total stored beside the rows it sums (see the denormalization file before removing that one).

## BCNF — every determining column is a candidate key
- Symptom: `lessons(student_id, subject, teacher_id)` where each teacher teaches exactly one subject (`teacher_id` determines `subject`), but `teacher_id` is not a key of the table. A teacher's subject is repeated for every student.
- Fix: `teacher_subjects(teacher_id, subject)` and `lessons(student_id, teacher_id)`.
- Rarely differs from 3NF; check it when a table has two overlapping candidate keys.

## 4NF — independent many-valued facts in one table
- Symptom: `student_contacts(student_id, phone, hobby)` forces every phone to pair with every hobby; adding one hobby adds one row per phone.
- Fix: one table per independent fact (`student_phones`, `student_hobbies`). Rare, but easy to avoid at design time.

## Review notes
- Judge the tables and columns the change **adds**. A legacy table that breaks a rule is a note ("the same teacher name is stored in two tables"), never a request to restructure it.
- A column that looks like a copy may be correct: see `deliberate-denormalization.md` before calling it a violation.
- Over-splitting is also a defect: a table per attribute, or a join on every screen for a value that never changes independently, costs more than it saves.
