# PARITY-REPORT — זהות רכיבים, תגיות, תנועה ושדה-בשורה · 2026-09-24

**Bottom line.** All 7 prototypes now carry the **same** shared shell block (`v1 sha:d7c2b5b7b88b`, byte-identical, checked with `node tools/build-shell.cjs --check`), extracted verbatim from `sketch/order-card-sketch-B.html`. The Playwright parity script (`tools/parity-check.cjs`) reports **0 style FAILs and 0 motion FAILs** against the sketch at 1440/1024/390 for every component each page has. It also reports **no side-by-side fields** in any checked form state, **no horizontal overflow** at 360/768/1024/1440, and **0 page errors**. Everything below was produced by commands that were actually run on this branch; nothing is claimed that was not run.

How to reproduce: `npm i --no-save playwright` in any scratch dir, then `PW=<dir>/node_modules/playwright node docs/redesign-v3/prototypes/tools/parity-check.cjs [--only=archetype-x] [--shots] [--motion]`. Raw numbers: `tools/parity-results.json`.

## 0. What changed and why (root cause)
- **Before:** each archetype agent re-implemented tabs, history, rail, cards, top bar and animations "in sketch-B language" from prose. The customer card used ~20 generic keyframes against the sketch's 94, and had different tab/tile/history sizes and a different top bar.
- **Now:** one generated block (CSS = all four sketch `<style>` blocks; markup = sprite + site top bar + overlays; JS = sketch runtime ranges + marked glue). It is pasted into every file by `tools/build-shell.cjs`. Every prototype's own copies of shared components were deleted, and pages use the sketch's class names and markup patterns. See `SHELL-BLOCK.md` for the line-by-line source map.

## 1. Chip counts (C-1.14), before → after
Method: visible `.chip,.tag,.cnt,.badge,.pill,.hamt,[class*=chip]` inside page content, excluding the top bar, demo strip and notice area (bell badge not counted). Before = the reviewed prototypes on `redesign/v3-protos-review`; the brief's rough totals were 16/15/9/7/6/2/2. Per-view numbers below were measured by the lead (customer card) and by the per-archetype agents with the same selector.

| Prototype | View / state | Before | After |
|---|---|---|---|
| customer card | title row (all tabs) | 5 | 1 (blocked — a real status) |
| | details (incl. rail) | 11 | 0 (+1 title) |
| | orders | 15 | 1 (only live order status as a tag; finished statuses = text+icon) |
| | payments | 11 | 0 |
| | credit & bank | 8 | 0–1 (only "pending refund") |
| | history | 7 | 0 (amounts are text, count is "(6)") |
| | edit / new customer | 7 / 0 | 0 / 0 |
| board | month / week / list | 46 / 15 / 37 | 0 / 0 / 0 |
| | day window / advanced search / legend | 14 / 49 / 9 | 0 / 0 / 0 |
| | rental card | 4 | 1 (order status) |
| wizard | steps 1–5, dialogs | 0–4 per step | 0 everywhere |
| list | each tab (50 rows) | 105–112 (up to 3 per row) | 1 per row (status column only) |
| | header / filters | 3 | 0 |
| dashboard | home / results / dashboard | 3 / 8 / 1 | 0 / 0 / 0 |
| touch | catalogue list / table / orders dialog | 32 / 46 / 2 | 0 / 0 / 0 |
| forms | view / edited | 1 / 4 | 0 / 0 |

Information was converted, never dropped: counts → "(n)" text, categories/labels → text, value pills → AA text colour, statuses that aren't live → `.stx` text+icon. **Open point:** the list's table keeps one status tag per row, which is the "one status column" rule, but 50 rows means more than 3 tags on screen. This is logged in POLISH-QUESTIONS L-1.

## 2. Style parity (S14) — summary
| Prototype | shell | style 1440 | style 1024 | style 390 | motion | fields (checks) | overflow 360/768/1024/1440 | page @media / physical | contrast < AA | keyframes bound | page errors |
|---|---|---|---|---|---|---|---|---|---|---|---|
| detail-card | v1 sha:d7c2b5b7b88b | 39 PASS / 0 FAIL | 38 PASS / 0 FAIL | 36 PASS / 0 FAIL | 13 PASS / 0 FAIL | PASS (33) | ok ok ok ok | none / 0 | 0 of 47 | 45/94 | none |
| board | v1 sha:d7c2b5b7b88b | 17 PASS / 0 FAIL | 16 PASS / 0 FAIL | 17 PASS / 0 FAIL | 11 PASS / 0 FAIL | PASS (12) | ok ok ok ok | none / 0 | 0 of 186 | 36/94 | none |
| wizard | v1 sha:d7c2b5b7b88b | 24 PASS / 0 FAIL | 23 PASS / 0 FAIL | 21 PASS / 0 FAIL | 9 PASS / 0 FAIL | PASS (3) | ok ok ok ok | none / 0 | 0 of 17 | 45/94 | none |
| list | v1 sha:d7c2b5b7b88b | 20 PASS / 0 FAIL | 19 PASS / 0 FAIL | 15 PASS / 0 FAIL | 10 PASS / 0 FAIL | PASS (3) | ok ok ok ok | none / 0 | 0 of 385 | 42/94 | none |
| dashboard | v1 sha:d7c2b5b7b88b | 18 PASS / 0 FAIL | 17 PASS / 0 FAIL | 15 PASS / 0 FAIL | 10 PASS / 0 FAIL | PASS (3) | ok ok ok ok | none / 0 | 0 of 20 | 33/94 | none |
| touch | v1 sha:d7c2b5b7b88b | 21 PASS / 0 FAIL | 21 PASS / 0 FAIL | 21 PASS / 0 FAIL | 10 PASS / 0 FAIL | PASS (9) | ok ok ok ok | none / 0 | 0 of 203 | 30/94 | none |
| forms | v1 sha:d7c2b5b7b88b | 24 PASS / 0 FAIL | 23 PASS / 0 FAIL | 21 PASS / 0 FAIL | 10 PASS / 0 FAIL | PASS (3) | ok ok ok ok | none / 0 | 0 of 35 | 39/94 | none |
`n/a` components (not listed) are shared components the page doesn't have (e.g. the dashboard has no rail). They are counted per width in `parity-results.json`. **Tables** have no sketch reference (the sketch has none), so every table is compared against the list prototype's table (amendment A4). Probe method: first visible element per selector; numbers ±0.5px, strings exact; box height compared for fixed-size parts. Probe selectors exclude variants the sketch shows first by accident (e.g. `.card.cust` 2px frame, the timeline pin `.tip.pinm`).

Region screenshots, sketch vs each prototype at 1440 and 390 (top bar, tabs, rail, history): `screenshots/parity/<region>-<width>-<name>.png`.

## 3. Motion parity (S14) — method and sketch reference
Method: for each component, `getComputedStyle` → animation-name/duration/timing-function/iteration-count and transition-property/duration/timing-function, in four states:
- **initial**
- **hover** (Playwright `hover`, read 40ms later)
- **on/active** (selected tab, expanded history row)
- **entering** (read synchronously right after the change: tab click → new `.panel.on`, `openDlg` → `#dlg` + `#scrim`, `toast()` → `#toast`)

Every prototype: **0 motion FAILs** (see table in §2). Icon animations come from the same library in every file: each `svg.ic` gets `ia-<icon>` by its sprite name, which gives the same hover and entrance animation per icon meaning.

Sketch reference (1440):
| Component / state | animation (name duration timing iterations) | transition (property duration timing) |
|---|---|---|
| top bar menu item · initial | none 0s ease 1 | color, background, transform 0.2s, 0.2s, 0.2s ease, ease, cubic-bezier(0.22, 1, 0.36, 1) |
| top bar menu item · hover | none 0s ease 1 | color, background, transform 0.2s, 0.2s, 0.2s ease, ease, cubic-bezier(0.22, 1, 0.36, 1) |
| top bar icon btn · initial | none 0s ease 1 | color, background, transform 0.2s, 0.2s, 0.2s ease, ease, cubic-bezier(0.22, 1, 0.36, 1) |
| top bar icon btn · hover | none 0s ease 1 | color, background, transform 0.2s, 0.2s, 0.2s ease, ease, cubic-bezier(0.22, 1, 0.36, 1) |
| top bar user · initial | none 0s ease 1 | color, background, border-color, transform 0.2s, 0.2s, 0.2s, 0.2s ease, ease, ease, cubic-bezier(0.22, 1, 0.36 |
| top bar user · hover | none 0s ease 1 | color, background, border-color, transform 0.2s, 0.2s, 0.2s, 0.2s ease, ease, ease, cubic-bezier(0.22, 1, 0.36 |
| title back · initial | none 0s ease 1 | background-color, color, border-color 0.18s, 0.18s, 0.18s ease, ease, ease |
| title back · hover | none 0s ease 1 | background-color, color, border-color 0.18s, 0.18s, 0.18s ease, ease, ease |
| tab · initial | none 0s ease 1 | all 0.15s ease |
| tab · hover | none 0s ease 1 | all 0.15s ease |
| button sm · initial | none 0s ease 1 | background-color, color, border-color 0.18s, 0.18s, 0.18s ease, ease, ease |
| button sm · hover | none 0s ease 1 | background-color, color, border-color 0.18s, 0.18s, 0.18s ease, ease, ease |
| icon button · initial | none 0s ease 1 | background-color, color, border-color 0.18s, 0.18s, 0.18s ease, ease, ease |
| icon button · hover | none 0s ease 1 | background-color, color, border-color 0.18s, 0.18s, 0.18s ease, ease, ease |
| info tip · initial | none 0s ease 1 | all 0s ease |
| info tip · hover | none 0s ease 1 | all 0s ease |
| panel (entering) · entering | tabin 0.18s cubic-bezier(0.22, 1, 0.36, 1) | — |
| tab (on) · on | none 0s ease 1 | all 0.15s ease |
| dialog (entering) · entering | #dlg dlgIn 0.2s cubic-bezier(0.22, 1, 0.36, 1) · scrim fadein 0.2s | — |
| history entry (expand) · on | — | grid-template-rows 0.3s cubic-bezier(0.22, 1, 0.36, 1) |
| toast (entering) · entering | — | transform, opacity 0.5s, 0.3s cubic-bezier(0.2, 1.2, 0.3, 1), ease |
**Frame sequences** (0/150/300/600ms), sketch vs customer card, for tab switch, history entry expand, rail tile pop and dialog open: `screenshots/parity/motion/<seq>-<sketch|detail-card>-<ms>.png` (16 + 16 files). They match frame for frame by eye; no pixel diff was run.

### Keyframes not bound on each page (and why)
The shell carries all **94** sketch keyframes in every file. A keyframe counts as "bound" when a rule that uses it matches an element on the page's first screen. Unbound ones belong to components or states not on that screen, e.g. dialog keyframes before a dialog opens, the history filter sheet on pages without history, the notice bar before a notice, and the timeline pulses on pages without a timeline. None is unused because a page re-implemented it.

| Prototype | bound / 94 | not bound on this page (component absent) |
|---|---|---|
| detail-card | 45 | pulse, draw, nowpulse, tilepop, fadein, rowin, rowout, icnshake, icndrive, nowpulseN, nowpulseG, hf-out, hf-row, hf-mk, hf-sheet, cbin, cbsheet, ubShine, ubPulse, mspin, ashake, frameSpin, nb-in, nb-wig, nb-ring, nf-in, nf-ring, ia-spin360, ia-swap, ia-slide, dlgIn, dlgRow, dlgSheet, dlgPop, dlgDraw, dlgShine, tdrain, tcollapse, dk-float, dk-tilt, dk-lid, dk-write, dk-breathe, ia-clipw, ia-lid, ia-breathe, ia-float, ia-badge, ia-burst |
| board | 36 | pulse, draw, nowpulse, popin, tilepop, fadein, rowin, rowout, icnpop, icnshake, icndrive, cartbounce, nowpulseN, nowpulseG, barDraw, barShine, barShine2, hf-out, hf-row, hf-mk, hf-sheet, cbin, cbsheet, ubShine, ubPulse, mspin, ashake, frameSpin, nb-in, nb-wig, nb-ring, nf-in, nf-ring, ia-spin360, ia-swap, ia-undo, ia-slide, ia-cart, dlgIn, dlgRow, dlgSheet, dlgPop, dlgDraw, dlgShine, tdrain, tcollapse, dk-float, dk-tilt, dk-lid, dk-write, dk-breathe, ia-send, ia-clipw, ia-lid, ia-breathe, ia-float, ia-badge, ia-burst |
| wizard | 45 | pulse, draw, popin, tilepop, fadein, rowin, rowout, icnshake, icndrive, hf-out, hf-row, hf-mk, hf-sheet, cbin, cbsheet, ubShine, ubPulse, mspin, ashake, nb-in, nb-wig, nb-ring, nf-in, nf-ring, ia-spin360, ia-drop, ia-swap, ia-undo, ia-slide, dlgIn, dlgRow, dlgSheet, dlgPop, dlgDraw, dlgShine, tdrain, tcollapse, dk-float, dk-tilt, dk-lid, dk-write, dk-breathe, ia-send, ia-clipw, ia-lid, ia-breathe, ia-float, ia-badge, ia-burst |
| list | 42 | fade, pulse, draw, nowpulse, tabin, tilepop, fadein, rowout, cartbounce, nowpulseN, nowpulseG, barDraw, barShine, barShine2, hf-out, hf-row, hf-mk, hf-sheet, cbin, cbsheet, ubShine, ubPulse, mspin, ashake, frameSpin, nb-in, nb-wig, nb-ring, nf-in, nf-ring, ia-spin360, ia-swap, ia-cart, dlgIn, dlgRow, dlgSheet, dlgPop, dlgDraw, dlgShine, tdrain, tcollapse, dk-float, dk-tilt, dk-lid, dk-write, dk-breathe, ia-send, ia-clipw, ia-breathe, ia-float, ia-badge, ia-burst |
| dashboard | 33 | pulse, draw, nowpulse, popin, tilepop, fadein, rowin, rowout, icnpop, icnshake, icndrive, cartbounce, nowpulseN, nowpulseG, barDraw, barShine, barShine2, hf-out, hf-row, hf-mk, hf-sheet, cbin, cbsheet, ubShine, ubPulse, mspin, ashake, frameSpin, nb-in, nb-wig, nb-ring, nf-in, nf-ring, ia-nL, ia-spin360, ia-drop, ia-write, ia-swap, ia-undo, ia-slide, ia-cart, dlgIn, dlgRow, dlgSheet, dlgPop, dlgDraw, dlgShine, tdrain, tcollapse, dk-float, dk-tilt, dk-lid, dk-write, dk-breathe, ia-send, ia-clipw, ia-lid, ia-breathe, ia-float, ia-badge, ia-burst |
| touch | 30 | pulse, draw, nowpulse, popin, fadein, rowin, rowout, icnpop, icnshake, icndrive, cartbounce, nowpulseN, nowpulseG, snpulse, hf-out, hf-row, hf-mk, hf-sheet, cbin, cbsheet, ubShine, ubPulse, mspin, ashake, frameSpin, nb-in, nb-wig, nb-ring, nf-in, nf-ring, ia-nod, ia-bob, ia-tick, ia-tilt, ia-spin, ia-spin360, ia-drop, ia-hop, ia-blink, ia-squash, ia-snip, ia-swap, ia-drive, ia-cart, dlgIn, dlgRow, dlgSheet, dlgPop, dlgDraw, dlgShine, tdrain, tcollapse, dk-float, dk-tilt, dk-lid, dk-write, dk-breathe, ia-clipw, ia-spinp, ia-lid, ia-breathe, ia-float, ia-badge, ia-burst |
| forms | 39 | pulse, draw, nowpulse, popin, tilepop, fadein, rowin, rowout, icnpop, icnshake, icndrive, cartbounce, nowpulseN, nowpulseG, hf-out, hf-row, hf-mk, hf-sheet, cbin, cbsheet, ubShine, ubPulse, mspin, ashake, frameSpin, nb-in, nb-wig, nb-ring, nf-in, nf-ring, ia-spin360, ia-swap, ia-undo, ia-slide, ia-cart, dlgIn, dlgRow, dlgSheet, dlgPop, dlgDraw, dlgShine, tdrain, tcollapse, dk-float, dk-tilt, dk-lid, dk-write, dk-breathe, ia-send, ia-clipw, ia-lid, ia-breathe, ia-float, ia-badge, ia-burst |
| *sketch itself* | 58 | pulse, tilepop, fadein, rowin, rowout, hf-out, hf-row, hf-mk, hf-sheet, ubShine, ubPulse, mspin, ashake, nb-in, nb-wig, nb-ring, nf-in, nf-ring, dlgRow, dlgSheet, dlgPop, dlgDraw, dlgShine, tdrain, tcollapse, dk-float, dk-tilt, dk-lid, dk-write, dk-breathe, ia-send, ia-clipw, ia-breathe, ia-float, ia-badge, ia-burst |
## 4. Field layout (C-1.16 / S15)
Check: in each state, visible `input/select/textarea` (not checkbox/radio/file, not the top bar, search bar or code boxes) must not share a vertical band (`a.top < b.bottom-1 && b.top < a.bottom-1`), at 1440/1024/390.
- **Lead run:** every tab plus the default state of every prototype. For the customer card it also covered details-edit, bank form, new customer, new customer with errors and the mail dialog (33 checks). Result: **PASS everywhere**.
- **Agent runs:** each agent also ran its own form states (wizard steps, board search/day window, list dialogs, touch sign-up/unlock, forms password/login, dashboard setting dialog) at 360/390/768/1024/1440 with the same test, reporting 0 overlaps.
- **Implementation:** every form uses the shell `.fcol` column (one field per line, max 720px).

## 5. Earlier checks re-run
| Check | Result |
|---|---|
| No horizontal overflow 360/768/1024/1440 | **PASS** all 7 (after shell fix A6 — the sketch itself overflows to 862px at 768 because closed nav dropdowns stick out) |
| WCAG AA text contrast (sampled text nodes vs nearest solid background) | **0 below AA** on all 7 (47–385 nodes sampled per page; text over gradients skipped) |
| Allowed breakpoints only | **Page CSS: PASS** all 7. **Shell: 3 values kept on purpose** (1180/1040/900, top-bar compaction) — see §6 |
| No physical CSS properties | **PASS** (page CSS 0 on all 7; shell 0 after N3 conversion) |
| Page errors | none on all 7 (the only console message is Google Fonts failing TLS behind the sandbox proxy) |

## 6. Intentional deviations (documented, reasoned)
1. **Top-bar breakpoints 1180/1040/900 kept verbatim** (breach of ב.6). Mapping them to the allowed set would visibly change the top bar at 1041–1439px (common laptop widths), which is exactly what the owner forbade. Proposal: in code, make them container-query thresholds of the bar itself (D-15 already allows this).
2. **C-1.14 applied inside shared components** (the sketch predates the rule):
   - history amounts are text (A1)
   - tab counts are "(n)" text (A2)
   - the history heading count is text
   - the rail changes count is text
   The sketch should get the same edits (POLISH-QUESTIONS G-1).
3. **Reduced motion honoured** (N1). The sketch disables it for demo purposes.
4. **Fill-mode:** kept on 9 staggered entrances to avoid flashing; removed on 42 undelayed ones (N4).
5. **Sketch defect fixed:** overflow at 768 (A6).
6. **Page-only content with no sketch component**, built from sketch parts/tokens:
   - board: month grid, compact order card
   - dashboard: chart, chat bubbles
   - touch: calendar, clock
   - wizard: size stock count
   - list: sortable table header
7. **Approval dialogs.** The contract requires the full password for customer card, board and dashboard, so those use the sketch `.apprwin` shell with approver + password fields. Wizard and list use the sketch's 4-digit code boxes; POLISH-QUESTIONS A-1 asks which one the owner wants everywhere.

## 7. What remains
- The owner's eye: the parity script proves computed-style and motion equality of shared components; it cannot judge page-specific layouts (board grid, dashboard chart).
- `openDlg` in the sketch has no Escape/backdrop close or focus trap in its generic runtime; each page adds the sketch's page-level handling. In code: part of the one LayerManager (§ד).
- Sketch updates recommended so source and pages don't drift: G-1, G-6 (A6), and removing its tab/heading count pills.
- The per-view "before" chip numbers for 5 archetypes come from the agents' own measurement scripts (same selector), not from one central script run.
- The customer card's pixel-level frame comparison was visual only.

## Appendix A — sketch reference values (extracted by the parity script)
### 1. Reference values extracted from the sketch (computed, per width)

| Component | Property | 1440 | 1024 | 390 |
|---|---|---|---|---|
| page html | `background-color` | rgb(220, 237, 250) | rgb(220, 237, 250) | rgb(220, 237, 250) |
| page html | `background-image` | none | none | none |
| page body | `background-color` | rgb(220, 237, 250) | rgb(220, 237, 250) | rgb(220, 237, 250) |
| page body | `background-image` | none | none | none |
| page body | `font-family` | Rubik | Rubik | Rubik |
| page body | `font-size` | 16px | 16px | 16px |
| page body | `line-height` | 25.6px | 25.6px | 25.6px |
| page body | `color` | rgb(10, 34, 66) | rgb(10, 34, 66) | rgb(10, 34, 66) |
| app container | `max-width` | 1240px | 1240px | 1240px |
| app container | `padding-top` | 24px | 24px | 16px |
| app container | `padding-inline-start` | 24px | 24px | 16px |
| top bar | `height` | 64px | 64px | 58px |
| top bar | `padding-inline-start` | 24px | 14px | 14px |
| top bar | `gap` | 12px | 12px | 12px |
| top bar | `background-image` | linear-gradient(rgba(10, 34, 66, 0.97), rgba(15, 44, 82, 0.97)) | linear-gradient(rgba(10, 34, 66, 0.97), rgba(15, 44, 82, 0.97)) | linear-gradient(rgba(10, 34, 66, 0.97), rgba(15, 44, 82, 0.97)) |
| top bar | `border-bottom-color` | rgba(224, 191, 90, 0.3) | rgba(224, 191, 90, 0.3) | rgba(224, 191, 90, 0.3) |
| top bar | `box-shadow` | rgba(10, 34, 66, 0.7) 0px 8px 22px -14px | rgba(10, 34, 66, 0.7) 0px 8px 22px -14px | rgba(10, 34, 66, 0.7) 0px 8px 22px -14px |
| top bar | `position` | sticky | sticky | sticky |
| top bar | `box.height` | 64 | 64 | 58 |
| top bar brand | `font-size` | 19px | 19px | 19px |
| top bar brand | `font-weight` | 700 | 700 | 700 |
| top bar brand | `color` | rgb(255, 255, 255) | rgb(255, 255, 255) | rgb(255, 255, 255) |
| top bar brand | `box.height` | 30.5 | 30.5 | 30.5 |
| top bar mark | `width` | 38px | 38px | 38px |
| top bar mark | `height` | 38px | 38px | 38px |
| top bar mark | `border-top-left-radius` | 12px | 12px | 12px |
| top bar mark | `background-image` | linear-gradient(135deg, rgb(217, 184, 74) 0%, rgb(184, 145, 47) 100%) | linear-gradient(135deg, rgb(217, 184, 74) 0%, rgb(184, 145, 47) 100%) | linear-gradient(135deg, rgb(217, 184, 74) 0%, rgb(184, 145, 47) 100%) |
| top bar mark | `box.height` | 38 | 38 | 38 |
| top bar menu item | `height` | 40px | 40px | — |
| top bar menu item | `padding-top` | 0px | 0px | — |
| top bar menu item | `padding-inline-start` | 14px | 10px | — |
| top bar menu item | `border-top-width` | 0px | 0px | — |
| top bar menu item | `border-top-left-radius` | 999px | 999px | — |
| top bar menu item | `font-size` | 15px | 14px | — |
| top bar menu item | `font-weight` | 500 | 500 | — |
| top bar menu item | `line-height` | 24px | 22.4px | — |
| top bar menu item | `color` | rgba(255, 255, 255, 0.92) | rgba(255, 255, 255, 0.92) | — |
| top bar menu item | `background-color` | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | — |
| top bar menu item | `background-image` | none | none | — |
| top bar menu item | `border-top-color` | rgba(255, 255, 255, 0.92) | rgba(255, 255, 255, 0.92) | — |
| top bar menu item | `box-shadow` | none | none | — |
| top bar menu item | `gap` | 7px | 7px | — |
| top bar menu item | `box.height` | 40 | 40 | — |
| top bar icon btn | `width` | 40px | 40px | — |
| top bar icon btn | `height` | 40px | 40px | — |
| top bar icon btn | `border-top-left-radius` | 50% | 50% | — |
| top bar icon btn | `color` | rgba(255, 255, 255, 0.92) | rgba(255, 255, 255, 0.92) | — |
| top bar icon btn | `box.height` | 40 | 40 | — |
| top bar clock | `height` | 32px | — | — |
| top bar clock | `font-size` | 13px | — | — |
| top bar clock | `font-weight` | 500 | — | — |
| top bar clock | `background-color` | rgba(255, 255, 255, 0.1) | — | — |
| top bar clock | `box.height` | 32 | — | — |
| top bar user | `height` | 40px | 40px | — |
| top bar user | `padding-top` | 0px | 0px | — |
| top bar user | `padding-inline-start` | 6px | 6px | — |
| top bar user | `border-top-width` | 1px | 1px | — |
| top bar user | `border-top-left-radius` | 999px | 999px | — |
| top bar user | `font-size` | 14px | 14px | — |
| top bar user | `font-weight` | 500 | 500 | — |
| top bar user | `line-height` | 22.4px | 22.4px | — |
| top bar user | `color` | rgb(255, 255, 255) | rgb(255, 255, 255) | — |
| top bar user | `background-color` | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | — |
| top bar user | `background-image` | none | none | — |
| top bar user | `border-top-color` | rgba(255, 255, 255, 0.5) | rgba(255, 255, 255, 0.5) | — |
| top bar user | `box-shadow` | none | none | — |
| top bar user | `gap` | 8px | 8px | — |
| top bar user | `box.height` | 40 | 40 | — |
| title back | `width` | 44px | 44px | 44px |
| title back | `height` | 44px | 44px | 44px |
| title back | `border-top-left-radius` | 50% | 50% | 50% |
| title back | `background-image` | none | none | none |
| title back | `border-top-width` | 1px | 1px | 1px |
| title back | `border-top-color` | rgb(0, 0, 0) | rgb(0, 0, 0) | rgb(0, 0, 0) |
| title back | `box.height` | 44 | 44 | 44 |
| title h1 | `font-size` | 28px | 28px | 28px |
| title h1 | `font-weight` | 600 | 600 | 600 |
| title h1 | `color` | rgb(10, 34, 66) | rgb(10, 34, 66) | rgb(10, 34, 66) |
| tabs bar | `padding-top` | 4px | 4px | 4px |
| tabs bar | `gap` | 4px | 4px | 4px |
| tabs bar | `border-top-left-radius` | 14px | 14px | 14px |
| tabs bar | `background-color` | rgb(228, 241, 251) | rgb(228, 241, 251) | rgb(228, 241, 251) |
| tabs bar | `box.height` | 52 | 52 | 52 |
| tab | `height` | 44px | 44px | 44px |
| tab | `padding-top` | 8px | 8px | 8px |
| tab | `padding-inline-start` | 16px | 16px | 16px |
| tab | `border-top-width` | 0px | 0px | 0px |
| tab | `border-top-left-radius` | 12px | 12px | 12px |
| tab | `font-size` | 16px | 16px | 16px |
| tab | `font-weight` | 500 | 500 | 500 |
| tab | `line-height` | 25.6px | 25.6px | 25.6px |
| tab | `color` | rgb(47, 74, 107) | rgb(47, 74, 107) | rgb(47, 74, 107) |
| tab | `background-color` | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) |
| tab | `background-image` | none | none | none |
| tab | `border-top-color` | rgb(47, 74, 107) | rgb(47, 74, 107) | rgb(47, 74, 107) |
| tab | `box-shadow` | none | none | none |
| tab | `gap` | 8px | 8px | 8px |
| tab | `box.height` | 44 | 44 | 44 |
| tab (on) | `height` | 44px | 44px | 44px |
| tab (on) | `padding-top` | 8px | 8px | 8px |
| tab (on) | `padding-inline-start` | 16px | 16px | 16px |
| tab (on) | `border-top-width` | 0px | 0px | 0px |
| tab (on) | `border-top-left-radius` | 12px | 12px | 12px |
| tab (on) | `font-size` | 16px | 16px | 16px |
| tab (on) | `font-weight` | 600 | 600 | 600 |
| tab (on) | `line-height` | 25.6px | 25.6px | 25.6px |
| tab (on) | `color` | rgb(15, 44, 82) | rgb(15, 44, 82) | rgb(15, 44, 82) |
| tab (on) | `background-color` | rgb(255, 255, 255) | rgb(255, 255, 255) | rgb(255, 255, 255) |
| tab (on) | `background-image` | none | none | none |
| tab (on) | `border-top-color` | rgb(15, 44, 82) | rgb(15, 44, 82) | rgb(15, 44, 82) |
| tab (on) | `box-shadow` | rgba(15, 44, 82, 0.12) 0px 1px 3px 0px | rgba(15, 44, 82, 0.12) 0px 1px 3px 0px | rgba(15, 44, 82, 0.12) 0px 1px 3px 0px |
| tab (on) | `gap` | 8px | 8px | 8px |
| tab (on) | `box.height` | 44 | 44 | 44 |
| tab marker | `width` | 20px | 20px | 20px |
| tab marker | `height` | 20px | 20px | 20px |
| tab marker | `border-top-left-radius` | 50% | 50% | 50% |
| tab marker | `box.height` | 20 | 20 | 20 |
| panel | `gap` | 24px | 24px | 16px |
| panel | `margin-top` | 24px | 24px | 16px |
| panel | `animation-name` | tabin | tabin | tabin |
| panel | `animation-duration` | 0.18s | 0.18s | 0.18s |
| card | `padding-top` | 24px | 24px | 16px |
| card | `padding-inline-start` | 24px | 24px | 16px |
| card | `border-top-width` | 1px | 1px | 1px |
| card | `border-top-color` | rgb(15, 44, 82) | rgb(15, 44, 82) | rgb(15, 44, 82) |
| card | `border-top-left-radius` | 16px | 16px | 16px |
| card | `background-color` | rgb(255, 255, 255) | rgb(255, 255, 255) | rgb(255, 255, 255) |
| card | `box-shadow` | rgba(15, 44, 82, 0.04) 0px 1px 2px 0px | rgba(15, 44, 82, 0.04) 0px 1px 2px 0px | rgba(15, 44, 82, 0.04) 0px 1px 2px 0px |
| card header h2 | `font-size` | 18px | 18px | 18px |
| card header h2 | `font-weight` | 600 | 600 | 600 |
| card header h2 | `color` | rgb(10, 34, 66) | rgb(10, 34, 66) | rgb(10, 34, 66) |
| card header icon | `width` | 44px | 44px | 44px |
| card header icon | `height` | 44px | 44px | 44px |
| card header icon | `border-top-left-radius` | 12px | 12px | 12px |
| card header icon | `box.height` | 44 | 44 | 44 |
| label/value row | `padding-top` | 0px | 0px | 0px |
| label/value row | `gap` | 16px | 16px | 16px |
| label/value row | `border-bottom-color` | rgb(228, 241, 251) | rgb(228, 241, 251) | rgb(228, 241, 251) |
| label/value label | `font-size` | 14px | 14px | 14px |
| label/value label | `color` | rgb(77, 103, 135) | rgb(77, 103, 135) | rgb(77, 103, 135) |
| label/value value | `font-size` | 17px | 17px | 17px |
| label/value value | `font-weight` | 500 | 500 | 500 |
| label/value value | `color` | rgb(10, 34, 66) | rgb(10, 34, 66) | rgb(10, 34, 66) |
| button sm | `height` | 44px | 44px | 44px |
| button sm | `padding-top` | 8px | 8px | 8px |
| button sm | `padding-inline-start` | 16px | 16px | 16px |
| button sm | `border-top-width` | 1px | 1px | 1px |
| button sm | `border-top-left-radius` | 12px | 12px | 12px |
| button sm | `font-size` | 15px | 15px | 15px |
| button sm | `font-weight` | 600 | 600 | 600 |
| button sm | `line-height` | 24px | 24px | 24px |
| button sm | `color` | rgb(0, 0, 0) | rgb(0, 0, 0) | rgb(0, 0, 0) |
| button sm | `background-color` | rgb(251, 191, 169) | rgb(251, 191, 169) | rgb(251, 191, 169) |
| button sm | `background-image` | none | none | none |
| button sm | `border-top-color` | rgb(0, 0, 0) | rgb(0, 0, 0) | rgb(0, 0, 0) |
| button sm | `box-shadow` | none | none | none |
| button sm | `gap` | 8px | 8px | 8px |
| button sm | `box.height` | 44 | 44 | 44 |
| icon button | `width` | 44px | 44px | 40px |
| icon button | `height` | 44px | 44px | 40px |
| icon button | `border-top-left-radius` | 14px | 14px | 12px |
| icon button | `background-image` | none | none | none |
| icon button | `border-top-color` | rgb(0, 0, 0) | rgb(0, 0, 0) | rgb(0, 0, 0) |
| icon button | `box.height` | 44 | 44 | 40 |
| info tip | `width` | 24px | 24px | 24px |
| info tip | `height` | 24px | 24px | 24px |
| info tip | `color` | rgb(77, 103, 135) | rgb(77, 103, 135) | rgb(77, 103, 135) |
| info tip | `box.height` | 24 | 24 | 24 |
| field label | `font-size` | 15px | 15px | 15px |
| field label | `font-weight` | 500 | 500 | 500 |
| field label | `color` | rgb(47, 74, 107) | rgb(47, 74, 107) | rgb(47, 74, 107) |
| field label | `margin-bottom` | 8px | 8px | 8px |
| segmented | `padding-top` | 4px | 4px | 4px |
| segmented | `gap` | 4px | 4px | 4px |
| segmented | `border-top-left-radius` | 12px | 12px | 12px |
| segmented | `background-color` | rgb(228, 241, 251) | rgb(228, 241, 251) | rgb(228, 241, 251) |
| rail card | `padding-top` | 0px | 0px | 0px |
| rail card | `border-top-left-radius` | 16px | 16px | 20px |
| rail card | `background-color` | rgb(15, 44, 82) | rgb(15, 44, 82) | rgb(15, 44, 82) |
| rail card | `color` | rgb(255, 255, 255) | rgb(255, 255, 255) | rgb(255, 255, 255) |
| rail card | `box-shadow` | none | none | rgba(10, 34, 66, 0.5) 0px -10px 30px -10px |
| rail heading | `font-size` | 17px | 17px | 17px |
| rail heading | `font-weight` | 700 | 700 | 700 |
| rail heading | `color` | rgb(247, 236, 196) | rgb(247, 236, 196) | rgb(247, 236, 196) |
| rail heading | `padding-bottom` | 12px | 12px | 12px |
| rail heading | `animation-name` | none | none | none |
| rail tile | `height` | 44px | 44px | 56.7969px |
| rail tile | `min-height` | 44px | 44px | 52px |
| rail tile | `padding-top` | 8px | 8px | 6px |
| rail tile | `padding-inline-start` | 12px | 12px | 4px |
| rail tile | `border-top-left-radius` | 12px | 12px | 12px |
| rail tile | `font-size` | 15px | 15px | 13px |
| rail tile | `font-weight` | 500 | 500 | 500 |
| rail tile | `background-color` | rgba(255, 255, 255, 0.1) | rgba(255, 255, 255, 0.1) | rgba(255, 255, 255, 0.1) |
| rail tile | `color` | rgb(255, 255, 255) | rgb(255, 255, 255) | rgb(255, 255, 255) |
| rail tile | `box.height` | 44 | 44 | 57 |
| rail cart title | `font-size` | 17px | 17px | 17px |
| rail cart title | `font-weight` | 700 | 700 | 700 |
| rail cart title | `color` | rgb(247, 236, 196) | rgb(247, 236, 196) | rgb(247, 236, 196) |
| history card | `padding-top` | 24px | 24px | 16px |
| history card | `border-top-left-radius` | 16px | 16px | 16px |
| history search | `height` | 48px | 48px | 48px |
| history search | `border-top-left-radius` | 14px | 14px | 14px |
| history search | `border-top-color` | rgb(169, 210, 240) | rgb(169, 210, 240) | rgb(169, 210, 240) |
| history search | `box.height` | 48 | 48 | 48 |
| history filter btn | `height` | 48px | 48px | 48px |
| history filter btn | `font-size` | 16px | 16px | 16px |
| history filter btn | `font-weight` | 600 | 600 | 600 |
| history filter btn | `border-top-left-radius` | 14px | 14px | 14px |
| history filter btn | `box.height` | 48 | 48 | 48 |
| history day header | `padding-top` | 10px | 10px | 8px |
| history day header | `padding-inline-start` | 16px | 16px | 12px |
| history day header | `border-top-left-radius` | 12px | 12px | 12px |
| history day header | `border-inline-start-width` | 4px | 4px | 4px |
| history day header | `background-color` | rgba(243, 249, 254, 0.96) | rgba(243, 249, 254, 0.96) | rgba(243, 249, 254, 0.96) |
| history day header | `margin-bottom` | 0px | 0px | 0px |
| history day title | `font-size` | 16px | 16px | 16px |
| history day title | `font-weight` | 700 | 700 | 700 |
| history day title | `color` | rgb(15, 44, 82) | rgb(15, 44, 82) | rgb(15, 44, 82) |
| history entry | `border-top-color` | rgba(15, 44, 82, 0.12) | rgba(15, 44, 82, 0.12) | rgba(15, 44, 82, 0.12) |
| history entry | `border-top-left-radius` | 16px | 16px | 16px |
| history entry | `animation-name` | rowin | rowin | rowin |
| history entry | `animation-duration` | 0.32s | 0.32s | 0.32s |
| history entry | `animation-timing-function` | cubic-bezier(0.22, 1, 0.36, 1) | cubic-bezier(0.22, 1, 0.36, 1) | cubic-bezier(0.22, 1, 0.36, 1) |
| history entry icon | `width` | 40px | 40px | 40px |
| history entry icon | `height` | 40px | 40px | 40px |
| history entry icon | `border-top-left-radius` | 12px | 12px | 12px |
| history entry icon | `box.height` | 40 | 40 | 40 |
| history entry text | `font-size` | 16px | 16px | 16px |
| history entry text | `font-weight` | 600 | 600 | 600 |
| history group gap | `gap` | 16px | 16px | 16px |
| timeline | `padding-top` | 14px | 14px | 12px |
| timeline | `border-top-left-radius` | 16px | 16px | 16px |
| timeline | `background-image` | linear-gradient(rgb(217, 223, 255) 0%, rgb(194, 202, 253) 100%), linea | linear-gradient(rgb(217, 223, 255) 0%, rgb(194, 202, 253) 100%), linea | linear-gradient(rgb(217, 223, 255) 0%, rgb(194, 202, 253) 100%), linea |
| timeline node | `width` | 52px | 52px | 44px |
| timeline node | `height` | 52px | 52px | 44px |
| timeline node | `border-top-width` | 2px | 2px | 2px |
| timeline node | `box.height` | 52 | 52 | 44 |