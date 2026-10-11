# Independent fidelity review 1 - employees / models / model card / new model (2026-10-11)

Reviewer: independent agent (did not read the authors' fidelity docs as evidence; they were only used afterwards to classify a difference as "documented").
Question under test (owner complaint): "design details were omitted/changed when moving to the real site".

## Method (re-measured, not trusted)
* Mock pages `http://localhost:8902/עובדים-ודגמים/{employees,models,model-card,model-new}.html` vs the real site `http://localhost:3071` (TEST DB, programmer user = NEW design), both at 1440x900 and 390 wide, own browser tabs, `*{transition:none!important;animation:none!important}` injected.
* A script (run in both pages through `javascript_tool`) collected, for every distinct element signature (tag + sorted classes + role, optionally prefixed by the parent signature) the `getBoundingClientRect` (relative to `.topbar`/`.app`/`#dlg`), ~75 computed properties, `::before/::after`, all text / `data-tip` / `aria-label` / `placeholder` / `title` / `href` / icon names (svg classes + `use href`), and posted JSON to a local collector; a node diff then listed (a) signatures only in the mock = OMISSIONS, (b) signatures only in the real page = additions, (c) every property/rect difference > 0.6px (rect > 1.3px) on matched pairs. Class prefixes `mc-`->`dc-` normalised.
* States captured on BOTH sides: default, filter popup open, sort popup open, rows/table, expanded row, pager page 2, results bar stuck (scroll 720), search typed, empty state, mobile 390 (base/filter/expanded), details view/edit/dirty (rail with changes, pending toast), items (+filter/sort/expanded/table), rentals, history, every dialog (item info, item edit [normal/repair/unused], add item, date, inactive, summary, discard, delete, print menu), scan-bar result, new-model steps 1-4 (+category combo open, items added), exit/discard/date dialogs, mobile 390 for card and wizard.
* Hover / focus / active / disabled: for every element signature the merged declarations of all matching `:hover|:focus-visible|:active|:focus-within|:disabled` rules in both style sheets were diffed (real mouse hover is not reliable in a hidden pane). Tooltips (`#tt` vs `.pl-tt`) rule sets compared. Connected-employee marker: the mock's exact markup injected into a real row and the 5 elements' computed styles compared (identical).
* Global-CSS leak hunt: `design-overrides.css` / `layout.css` rules that match new-design elements were listed per element (that is how the table-border leak was found).
* Tools (kept outside the repo): scratchpad `col/measure.js`, `col/diff.js`, `col/pdiff.js`.

Severity: **blocker** = omitted/changed element or visual difference > 2px / colour; **minor**; **justified** = deliberate and documented (or a defect of the mock that the port corrected) - still listed so the owner can veto.

---------------------------------------------------------------------------------------------------

## Screen 1 - employees list (`employees.html` -> `/employees`)

Result: structurally and numerically identical in every captured state except the items below. 134 element signatures compared per state; after normalising ids/icon helper classes, 0 mock-only elements apart from "connected" rows (no connected employee exists in the TEST DB; markup+CSS verified by injection) and 0 style differences except E1.

| # | Sev | Where / selector | Mock | Real | Status / fix |
|---|---|---|---|---|---|
| E1 | **blocker** | table view `table.etbl.rtbl tbody td` `border-bottom-color` | rgb(211,215,220) (`--sky-100`) | rgb(229,219,203) - site global `design-overrides.css` §9 `table tbody td{border-bottom-color:var(--divider)!important}` leaks into the new table | **FIXED**: `app/components/a5-list/a5-page.css` `.gm-ds.gm-a5 .rtbl tbody td{border-bottom-color:var(--gm-sky-100)!important}`; re-measured rgb(211,215,220) on /employees and /dashboard/dresses (same kit) |
| E2 | justified | header: `div.a5-tools > span.gm-pvt` (variant toggle) | absent | gold swap icon next to the title; `.ttl` x +54px / w -54px (mobile h1 w 304->254, the title can wrap) | owner rule (toggle on every new screen) |
| E3 | minor | `button.back` | `title=` | `data-tip=` (same text) | custom tooltip instead of native; fine |
| E4 | minor | `span.lni.zero "כניסה אחרונה · אין כניסות"` | rows always have a time | dim line for employees that never clocked in | documented; fine |
| E5 | minor | `main.main` display block->flex column, `.topbar` z-index auto->5, `article.hrow aria-expanded` removed, `th aria-sort`, `button type=button`, `.hf-bdg.pop` | - | a11y / shell differences, no visible effect | none |
| E6 | minor | row line 2: last-entry date shows day+month only ("כניסה אחרונה · כ״ח חשוון · 11:07") also for entries from 2023 (expanded detail shows the full year) | mock data are all within the current year, same format | ambiguity for old entries | owner question (not a design difference) |
| E7 | justified | popup scrollbar | classic 15px | site thin scrollbar -> popup 4.8px wider, `.app` margin +2.4px | site-wide setting |

Checked and identical (numbers): search bar (pill 60px, gold border, 17px input, AI/stat 36px buttons), "סינון" trigger + badge + chevron + popup (group headers, option rows, counts, "נקה סינון", scrim), results bar (38px controls, 16px radius, count, view switch+knob, sort trigger, pager capsule 50/page, xl/dl/print trio, stuck = peach), sort popup (7 options), rows 21px/14px, icon box 75x48, markers (key, connected: injected), chevron 40px, expanded `.hv-r` rows + actions, table (7 sortable columns), empty state text, hover/focus/active rule sets (0 differences), tooltips, mobile 390 (bottom sheet popup z-index 1000/1001 vs mock 118/120 - needed above the real site header), statistics modal = dark `stm-dlg`.

Behavioural notes: first load of `/api/employees?all=true` took 9-15s in dev (spinner "טוען…"), one transient "טעינת רשימת העובדים נכשלה" while the dev server recompiled (retry button works). The clear-search button loses its tooltip in a *background* tab only (`decorateButtons` runs in `requestAnimationFrame`, throttled when the tab is hidden) - not a user-visible bug.

Counts: found 7 / fixed 1 / remaining 6 (all minor or justified, 0 blockers).

---------------------------------------------------------------------------------------------------

## Screen 2 - models list (`models.html` -> `/dashboard/dresses`)

Same engine as screen 1: 0 style differences besides E1 (verified fixed on the models table too). Row anatomy / popups / default filter badge "1" / pager / expanded details / empty state / mobile identical; hover rule sets: only `:disabled` extras in real (filter none / cursor not-allowed), harmless.

| # | Sev | Where / selector | Mock | Real | Status / fix |
|---|---|---|---|---|---|
| M1 | **blocker** | table view `td` border colour | rgb(211,215,220) | rgb(229,219,203) | **FIXED** together with E1 |
| M2 | minor | table `td.num` | `<span class="nc" data-z>` inside the cell (no CSS rule for `.nc`) | plain text in `td.num` (`.zero` class identical) | no visual difference |
| M3 | minor | expanded row "פריטים" line | shows "0 רזרבה", "0 בתיקון"... | same | **owner rule vs mock**: "zero values not shown" is not applied inside the expanded detail in the mock itself; the port copies it. Owner decision |
| M4 | justified | variant toggle (`.a5-tools`), `section.on.panel` margin-top 64->0 (page has no tab bar) | - | - | y positions of all following elements identical |
| M5 | minor | size list `<span><span>01 (11)</span><span> · 02 (11)</span>...` | one text run | per-size spans (wrap points) | no visual difference; real data are zero-padded sizes |

Counts: found 5 / fixed 1 / remaining 4 (0 blockers).

---------------------------------------------------------------------------------------------------

## Screen 3 - model card (`model-card.html` -> `/dashboard/dresses/<id>`)

States compared: details view/edit/dirty, rail, pending toast (identical, 0 diffs), scan result chip (identical), items / rentals / history (rows, table, expanded), 9 dialogs, print menu, mobile 390. Rail top == first card top (346.8 = 346.8 real; 320.8 = 320.8 mock). Tab markers, glance tiles, cart header/body identical.

| # | Sev | Where / selector | Mock | Real | Status / fix |
|---|---|---|---|---|---|
| C1 | **blocker** | history tab "יומן הדגם" detail line `.prc-m` / `.prc-w` ("נרשם במאגר", "הזמנה #… · לקוח") | `.prc-m{display:flex;gap:8px;flex-wrap:wrap;align-items:center}` `.prc-w{font:500 15px; color:var(--ink2)}` | the rules were not ported: text rendered 16px/400 navy, block | **FIXED**: `app/components/dress-card/css/dress-card.css` (`.gm-ds.gm-dc .prc-m/.prc-w`); re-measured 15px/500/rgb(47,74,107), flex |
| C2 | **blocker** | card table view (items / rentals / history) `td` border-bottom | rgb(211,215,220) | rgb(229,219,203) - same leak as E1; the card root has `gm-dc`/`gm-oc`, not `gm-a5`, so the a5-page.css fix does not cover it | **FIXED**: `dress-card.css` `.gm-ds.gm-dc .rtbl tbody td{border-bottom-color:var(--gm-sky-100)!important}`; verified rgb(211,215,220) |
| C3 | **blocker** (omission) | items / rentals / history search bars: `button.hf-ib` "חיפוש חכם (AI)" and "שאלות סטטיסטיקה" (x3 lists) | present; input width 484px | absent; input 560px (+76px) | **NOT FIXED** - author-documented ("no data source for item/rental/log AI search"); needs an owner decision (either wire to `/api/ai/smart-search` with a page context, or approve removal) |
| C4 | minor | edit-details button after click | `svg.ic.ia-check.ia-h.ia-in.ia-dr` (draw-in animation, check hover animation) | svg kept `ia-pencil` (global icon tagger does not re-tag when the `use href` changes) -> pencil hover animation on a check, no entry animation | **FIXED**: `DcDetailsTab.js` `<OcIcon key={ed ? 'check' : 'pencil'} …>`; class now identical |
| C5 | minor | summary dialog change row `.chg .c .ico` | 38x38 | 40x40 (dark-dialog rule overrode `.oc-cico`) | **FIXED**: `dress-card.css` `.gm-ds.gm-dc :is(#dlg,#dlg2) .chg .c .oc-cico{width:38px;height:38px}`; re-measured 38px |
| C6 | justified | `.oc-app` padding-top | `.app` 24px | 50px (whole card 26px lower; topbar y 114 vs 88 in page coordinates) | documented as "same offset as the live order card (owner note 5.10.2026)". If the owner wants the mock literally, set `.gm-ds.gm-oc .oc-app.dc-app{padding-top:24px}` |
| C7 | justified | "הצג בבדיקה" tooltip text | "כשמופעל — הדגם יופיע בהתראות המלאי…" | "סימון עצמי בלבד — … לא חוסם השכרה ולא מופיע ברשימת התראות המלאי" | documented: the mock described behaviour that does not exist |
| C8 | justified (mock defect) | status "סטטוס" tooltip | attribute truncated at `…סימון ` (unescaped `"`) | full text | port corrected |
| C9 | justified (mock defect) | item-info dialog `.hv-r small/b`, add-item `.dc-barc` | navy text on the dark dialog (unreadable) | light tokens (`--k-faint/--k-ink`), 0.8px divider | port corrected; same for `.empty` |
| C10 | justified (mock defect) | item edit / add dialog row `.dc-dlg-row > .field + .field` | 2nd/3rd cell pushed 16px down (`.field+.field{margin-top:16px}`), dialog 754px | aligned, dialog 738px | documented small fix |
| C11 | justified | `a.btn.sm "מחירון"` | `<button>` | `<a href=/dashboard/pricelist target=_blank>` | real navigation |
| C12 | justified | mobile 390 tabs `nav.tabs` | overflow visible - 4th tab sticks out 104px beyond the card | `overflow-x:auto` scrollable | better |
| C13 | justified | mobile topbar | 157px | 191px (title wraps because of the variant toggle) | toggle |
| C14 | minor | `button.cart-t aria-expanded` | false while the body is visible | true | mock inconsistency |
| C15 | minor | image card: while `/images/dresses/<code>.jpg` is probed the frame is in the "has" state (broken `<img>`/"תמונה מקושרת") until the 404 returns, then "אין תמונה" | mock: no probe | possible flash of the wrong state (dev: a few seconds) | verify in a production-like build |
| C16 | minor | `dc-frame` etc. `aria-*`, `type=button`, `tabindex` on tabs (roving), `role=menuitem` in print menu | - | a11y additions | none |

Checked and identical: scan bar (chip text, colours), tabs + alert markers (`tabmk debt`, first-appearance `fresh` logic), details cards (kv rows, status `.seg.pill` x2 incl. aria, image card, notes), edit mode fields (category combo `.cb`, date line), rail "סיכום" 6 tiles (156x44), cart header/body/empty, change list with undo, pending toast ("שינויים ממתינים לשמירה" + "לשמירה", 2.8s) 0 diffs, items rows/popup/sort/table, rentals, history (23 vs 15 rows - data), dialogs: info, edit (3 states), add, date, inactive (textarea, buttons), summary, discard (0 diffs), delete, print menu (8 entries identical text/icons), toast. All floating windows are the dark site dialogs (`#dlg/#dlg2`, `body.dlg-dark`); no `window.confirm/alert/prompt` in the new components (grep) - the only `alert()` is in `LegacyNewDressPage.js` (frozen legacy).

Behavioural notes: the page requests `/api/dresses/<id>?includeDeleted=true` and `/api/pricelists/categories` twice on load (dev strict mode?) - worth checking in a prod build; dev only: the card's lazily loaded CSS chunk once did not attach after a hot reload (card rendered unstyled until a fresh load).

Counts: found 16 / fixed 4 (C1, C2, C4, C5) / remaining 12 = 1 blocker needing an owner decision (C3), 7 justified, 4 minor.

---------------------------------------------------------------------------------------------------

## Screen 4 - new model (`model-new.html` -> `/dashboard/dresses/new`)

States: step 1 (empty / category combo open / valid), step 2, step 3 (empty / 3 items added), step 4, rail (glance + cart + actions), exit / discard / date dialogs, mobile 390 (step 1 + cart). Progress bars, hero question, nav (top/bottom), recap rail text identical; 0 style differences except below.

| # | Sev | Where / selector | Mock | Real | Status / fix |
|---|---|---|---|---|---|
| N1 | minor | rail location chips + step-3 location pill order | חנות · מחסן · רזרבה | חנות · רזרבה · מחסן (`item_locations` setting / legacy default; the card mock uses the same order as the real page) | the mock is internally inconsistent; real follows the data/setting. Owner may want the mock order |
| N2 | minor | initial state | code prefilled instantly (#623), "יש להשלים: שם דגם, קטגוריית מחיר" | code arrives after `/api/dresses/next-code` (~2s): first paint "קוד" empty and need-list includes "קוד דגם" | real data; fine |
| N3 | minor | category combo option text | "קטגוריה A" / "מחיר בסיס ₪90", height 54px | real price categories ("אחר" / "תיקון אורך") / "מחיר ₪20–₪40", first option has no second line (46px) | data + wording "מחיר" vs "מחיר בסיס" |
| N4 | minor | rail chip icons | `svg.ic.ia-hash` (no hover class) | `svg.ic.ia-hash.ia-h` (hover animation) | tiny; mock card uses `ia-h` too |
| N5 | minor | `.topbar` position | static | relative | none |
| N6 | justified | variant toggle in header | - | present | owner rule |
| N7 | minor | dialogs `::before/::after` | animation snapshot differences (frozen mid-animation) | - | noise |

Not exercised: the final "יצירת הדגם" create + success view (would write to the TEST DB), image upload/URL dialog.

Counts: found 7 / fixed 0 / remaining 7 (0 blockers).

---------------------------------------------------------------------------------------------------

## Summary

| Screen | found | fixed | remaining | remaining blockers |
|---|---|---|---|---|
| 1 employees list | 7 | 1 | 6 | 0 |
| 2 models list | 5 | 1 | 4 | 0 |
| 3 model card | 16 | 4 | 12 | 1 (C3 - AI/statistics buttons in the card lists; owner decision) |
| 4 new model | 7 | 0 | 7 | 0 |

Files changed by this review (CSS/markup only, LF kept, no commit):
* `app/components/a5-list/a5-page.css` - E1/M1 table row divider colour.
* `app/components/dress-card/css/dress-card.css` - C1 (`.prc-m/.prc-w`), C2 (card table divider), C5 (summary icon 38px).
* `app/components/dress-card/tabs/DcDetailsTab.js` - C4 (`key` on the edit/check icon). `npx eslint` clean.

Not verified: real mouse hover (rule-set diff used instead), keyboard behaviours beyond popup navigation, print/PDF sheets (stage 2), save-success dialog and restore dialog (need writes), a "connected" employee on real data (CSS verified by injection), Safari/Firefox.
