# Choosing the shape of new code

## 1. Find the axis of change
Ask: "what is the next thing someone will ask for here?" The answer is the axis. If you cannot name one, the code is probably direct (section 4).

| The code will probably grow by... | Lightest structure that fits | Named pattern (when the lighter one is not enough) |
|---|---|---|
| another **kind** of the same thing (a discount type, a document type, a payment method) | a table (map) from kind to function | **Strategy**, picked by a registry or factory |
| another **rule** that must all hold or be evaluated in order | a list of small rule functions | **Specification** / rule objects, or **Chain of responsibility** |
| another **step** in a fixed sequence (validate, enrich, save, notify) | an ordered list of step functions | **Pipeline** (middleware style) |
| another **channel or provider** (SMS, email, a second payment gateway) | one interface with the current implementation behind it | **Adapter** / gateway per provider |
| another **reaction** to an event (send, log, update a total) | a list of handlers called after the action | **Observer** / domain events |
| another **state** and rules for moving between states | a table of allowed transitions | **State** / a small state machine |
| **cross-cutting** behaviour around many calls (logging, permission, caching) | a wrapper function | **Decorator** / middleware / pipeline behaviour |
| **construction** that varies by input (which class to create) | one creation function with a switch inside | **Factory** (method) |

Prefer the left column. Move right only when the variants need their own state, or several functions must travel together.

## 2. Shapes in this stack
- **TypeScript:** a `Record<Kind, (input) => Result>` or a `Map`, or an interface plus classes; register them in one place. Keep the kind a union type so a missing case is a compile error.
- **C#:** an interface (`IFeeRule`) with implementations registered in the container (`services.AddScoped<IFeeRule, SessionFeeRule>()`) and consumed as `IEnumerable<IFeeRule>`; or a `Dictionary<Kind, Func<...>>` for the simplest case. Match how the project registers services.
- **Keep one place that knows all variants** (the registry). Adding a variant then means adding one class and one registration, not editing callers.

## 3. Limits that keep it honest
- At most **one layer of indirection** between the caller and the work.
- Every interface or registry has **at least the current implementation** behind it and a named axis of growth; no hooks "just in case".
- Name things by the business concept (`FeeRule`, `ReminderChannel`), not by the pattern (`StrategyFactoryManager`).
- Use the project's own idioms (its DI, its naming, its folder layout); a pattern that looks foreign to the code around it is worse than direct code.
- Do not merge things that only look alike; two real kinds behind one interface is a seam, two unrelated things behind one is a trap.

## 4. When to stay direct
- Glue, one-off steps, mapping and orchestration that will not vary.
- No axis of growth can be named.
- The only way to introduce the structure is to change existing logic (see `seam-beside-old-code.md`: the seam goes on the new code only).
- The project's style would make the pattern look foreign.

Say "direct" and why in the design. That is a decision, not an omission.
