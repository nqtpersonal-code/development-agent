# Dense forms on mobile

Always start from the project's own form components and spacing (see the
project's `ui.md`); this guide decides structure, not styling.

## 1. Group by meaning, then order by importance

- Split fields into named groups that match how users think: e.g. *Student*, *Contact*, *Parent*, *Enrolment*.
- Inside a group: required and most-used fields first; rarely used fields last or in an "More details" collapsible part.
- Aim for groups of 3–7 fields.

## 2. Layout per width

| Width | Layout |
|---|---|
| < 600px (phone) | one column, full-width inputs, labels above inputs, groups as collapsible sections (first open, others closed or open in order of filling) |
| 600–1024px (tablet) | two columns inside a group for short fields (date, phone), long fields full width |
| > 1024px (desktop) | two or three columns inside a group; never a fixed total width — use a max width and let it shrink |

- Never set a min-width on the form or a fixed-column grid in pixels; use fractional columns or auto-fit with a minimum field width.
- Labels must not be truncated; wrap them.

## 3. Actions

- One primary action (Save) visually dominant; secondary actions (Cancel, Save draft) quieter.
- On phones keep the primary action reachable: a sticky bar at the bottom, at least 44px tall, full width or large.
- After saving, land where the user expects (usually the list or the detail page) and show a short confirmation.

## 4. Input help

- Use the right input types (`tel`, `email`, `date`, `number`) so phones show the right keyboard.
- Show the format with an example value from real data ("0901 234 567"), not with long instructions.
- Validate on blur and on submit; put the message right under the field and scroll to the first error on submit.

## 5. Long forms

- More than ~15 fields: consider steps (wizard) only when groups are truly sequential; otherwise collapsible sections are faster for frequent users.
- Preserve typed data if the user navigates away by mistake (warn before leaving).

## 6. Tables on phones

- Turn rows into cards: the 2–3 key values prominent, others secondary; actions on the card.
- Or keep the table but make only the table scroll horizontally inside its container, never the page.

## Worked example (fictional)

"Add student" with 18 fields → groups: *Student* (name, birth date, gender), *Contact* (phone, email, address, ward, district, city), *School* (school, grade, start date), *Parent* (name, phone, email, relation), *Other* (source, note — collapsed). Phone: one column, sections, sticky Save. Desktop: three columns inside each group, max width 1100px.
