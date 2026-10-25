# UI defect checklist (with usual fixes)

| # | Defect | How to spot | Usual fix |
|---|---|---|---|
| 1 | Horizontal overflow | page scrolls sideways at 375px | remove fixed widths/min-widths; fractional or auto-fit columns; wrap long words |
| 2 | Clipped text | ellipsis or hidden overflow hides meaning | let labels wrap; give values room; tooltips only for secondary text |
| 3 | Small tap targets | controls under 40px on phones | min 44px height, padding not font-size; spacing between targets |
| 4 | Covered input | field under a sticky header/footer | add bottom padding equal to the sticky bar; scroll field into view on focus |
| 5 | Style mismatch | spacing, colours, buttons, tables differ from the sibling screen | reuse the project's components and tokens listed in ui.md |
| 6 | Long form without grouping | > 8 fields in one block | group by meaning; collapsible sections (see dense-form-mobile) |
| 7 | Table unusable on phones | columns squeezed or page scrolls | cards on phones, or scroll inside the table container only |
| 8 | Primary action out of reach | Save far below the fold on phones | sticky action bar; keep one primary action |
| 9 | Unclear errors | message far from the field or generic | message under the field; scroll to first error; say how to fix |
| 10 | Missing empty/loading states | blank areas | skeleton or spinner while loading; friendly empty state with next action |

Items 1–4 are measured automatically by `nqt.mjs ui-check`; 5–10 need a look at screenshots.
