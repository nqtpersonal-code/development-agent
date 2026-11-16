# A seam beside old code

The aim: new code that is easy to extend, **without changing the existing logic** that already works. The touch-risk gate (rules.md → Design for extension) decides; this file shows how to live with it.

## The gate, as questions
Before shaping anything, check what the structure would do to existing code:
- [ ] Would any existing function be **moved, split, renamed, re-signatured** or have callers **re-routed**?
- [ ] Would a line change in an existing function that is **not** a must-patch point in the brief?
- [ ] Would old and new code have to **share** a function whose behaviour must stay exactly as it is?

All "no" → the structure can reach into the existing code at the must-patch points. Any "yes" → **seam on the new code only** (below).

## Seam on the new code only
1. Put the new behaviour in its own unit (class, function or module) behind the seam (interface, registry, table of functions).
2. Connect it to the old code at **one** must-patch point: a single new branch, a single new registration, a single call.
3. Leave the old path exactly as it is. Do not make it implement the new interface "for consistency".
4. Write the **migration note** in the design: *"The old path X (file:line) still does its own thing; it can move behind this seam when a ticket allows refactoring."*
5. Add a regression scenario for the old path if it shares data with the new code (the brief's re-check points), so QA proves it still behaves.

## Worked example (fictional)
Ticket: "Add a 10% sibling discount to monthly fees." Today `fees.service.ts` computes the fee in one function with a hard-coded 15% discount for the 20th session on.

- **Not allowed under the gate:** extract the existing discount into a `DiscountRule` interface, rewrite the function to loop over rules. That moves existing logic.
- **Allowed:** a new `SiblingDiscount` unit behind a small `FeeDiscount` interface and a registry with that one implementation; `fees.service.ts` gets **one** new line that asks the registry for sibling discounts and subtracts the result. The old 15% code is untouched.
- **Migration note:** "The 20th-session discount (`fees.service.ts:13-17`) can move behind `FeeDiscount` when a ticket allows refactoring."
- **Next ticket** ("add a loyalty discount") adds one class and one registration.

## When even the single connection point is too risky
If the one new line would sit in a function with a wide radius (`nqt.mjs radius`) and no test or QA scenario covers it, do not add the seam in this ticket: write direct code at the narrowest point, record the axis and the idea in the design, and let the owner decide whether a later ticket should refactor.
