# UI defect checklist

Used by screen-designer (to avoid), ui-checker (to detect) and reviewer.
Items 1–4 are measured by `nqt.mjs ui-check`, which also records script errors and failing server calls while the page loads; the rest need a look at the
screenshots against `projects/<project>/ui.md` and the sibling screen.

1. **Horizontal overflow** — the page scrolls sideways at 375px.
2. **Clipped text** — labels or values cut off (ellipsis or hidden overflow) so the meaning is lost.
3. **Small tap targets** — buttons/links/inputs smaller than 40px on phones.
4. **Covered input** — a field hidden under a sticky header/footer or another element.
5. **Style mismatch** — spacing, colours, fonts, buttons or table style differ from the sibling screen named in `ui.md`.
6. **Long form without grouping** — more than ~8 fields with no sections, headings or steps.
7. **Table unusable on mobile** — wide tables not turned into cards/rows or not scrollable inside their container.
8. **Primary action out of reach** — the main button is not visible or reachable without long scrolling on phones.
9. **Error messages unclear or far from the field** — the user cannot tell which input is wrong.
10. **Empty and loading states missing** — blank areas with no explanation.
