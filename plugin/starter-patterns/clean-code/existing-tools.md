# Use the tools the project already has

A linter's finding is a fact; an agent's opinion about style is not. When the project already has a linter or analyzer, let it judge the new lines.

## `nqt.mjs lint-changed`
`node "<PLUGIN>/scripts/nqt.mjs" lint-changed --root "<PROJECT_ROOT>" --base <base branch or commit>`

- Looks at the files the change touched (`BASE...HEAD`) in every repo of the ticket folder.
- Runs the project's **own** ESLint when it has a configuration and has it installed, and keeps only the findings on **lines the change added**. Old warnings are not the ticket's business.
- C# analyzer warnings come from the compiler, so they need a build (which writes `bin/` and `obj/` and can lock a running app): they are included only with `--dotnet`.
- If a tool is not configured or not installed, it says so and runs nothing. It never installs a tool or adds a configuration to the project.
- Exit code 1 when there is a finding; the output lists `file:line [tool rule, severity] message`.

## How to use the result
- **dev**: before finishing, run it with the base branch from `project.md`; fix findings on the lines you added; leave every other warning alone. A finding you cannot fix without touching other code goes in the notes.
- **reviewer**: run it, report each error-level finding on added lines as **important** (a warning as **minor**) with the line, unless the project's team rules say otherwise. A tool finding needs no extra proof; its rule id is the evidence.
- Both: a formatter check (`prettier --check`, `dotnet format --verify-no-changes`) is worth running only when the project already uses that formatter, only on the changed files, and a failure is fixed on the added lines only.

## What this does not replace
A clean lint run says nothing about whether the ticket is met, whether a business rule is duplicated, or whether the change points are all patched. Those stay with the tracer, the reviewer and QA.
