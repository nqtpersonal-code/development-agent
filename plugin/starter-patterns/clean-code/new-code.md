# Checklist for the lines a change adds

Judge what the diff adds. Report only what you can show to be harmful or misleading; a preference is not a finding.

## Names
- [ ] A name says what the thing is or does, in the words the project and the owner use (the same word for the same concept everywhere: do not add `learner` beside `student`).
- [ ] A boolean reads as a question (`isActive`, `hasTeacher`), and is not negated in its name (`isNotDeleted`).
- [ ] A name does not lie: a `list` that is a set, a `getX` that also writes, an `Id` that holds a code.
- [ ] No abbreviation the project does not already use.

## Functions
- [ ] A function does one job at one level of detail. A block that needs a comment to say what it does is a candidate for a named function — inside the code you are writing.
- [ ] Few parameters. Four or more, or a boolean flag that switches behaviour, suggest a parameter object or two functions (only if the project's code does it that way).
- [ ] No hidden side effect: a function that answers a question does not change anything; a function that changes something is named for it.
- [ ] Length is a symptom, not a rule: look at *why* it is long (several jobs, deep nesting, repeated blocks).

## Control flow
- [ ] Guard conditions return early instead of nesting; more than about three levels of nesting in new code is worth a second look.
- [ ] Conditions are positive where possible; a chain of `if/else` or `switch` on a type that grows with every new case points at a missing abstraction (note it; follow the project's pattern).

## Duplication
- [ ] Before copying a block, the project was searched for the same logic; reuse the variant the model code uses.
- [ ] **A business rule lives in one place.** A second copy of a rule (a fee calculation, a validation, a status check) is not a style issue: it is the next diverging copy (rules.md → One business rule, many implementations).
- [ ] Do not merge two things that only *look* alike: a wrong shared abstraction costs more than two small copies. Two copies are tolerable; at three, name the common thing.

## Errors
- [ ] Nothing is swallowed (empty `catch`, log-and-continue where the caller must know, a default value that hides a failure).
- [ ] Invalid input is rejected at the boundary with a message that says what is wrong and what to do.
- [ ] Specific error types or codes, not one generic exception for everything; the original cause is kept.

## Comments
- [ ] Comments say **why** (a business rule, a trap, a decision), not what the next line does. The code says what.
- [ ] No commented-out code; the history has it.

## Dependencies and values
- [ ] The new code depends on what the project already uses for the same job; no new global state, singleton or static helper unless the project does that.
- [ ] No long chains reaching through objects (`order.student.class.teacher.name`): ask the nearer object, or pass what is needed.
- [ ] Business numbers and texts that could change (a fee, a limit, a status name) are named constants or settings, in the way the project already keeps them; not bare literals scattered through the code.

## Tests (when the project writes them)
- [ ] One behaviour per test, named for the behaviour; no logic (loops, conditions) in a test; independent of other tests and of test order.

## Format
- [ ] Formatting is the project's formatter's, and only on the lines changed. A change that reformats untouched lines is out of scope.
