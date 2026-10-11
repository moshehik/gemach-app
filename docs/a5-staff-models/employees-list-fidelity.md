# Employees list - fidelity checklist (mock `employees.html` vs `/employees` A5)

Source of truth: `scratch/emp-models-build/employees.js` + `employees.app.html` + `list-core.js` + `page.css` (built mock: `תצוגות-עיצוב/עובדים-ודגמים/employees.html`).
Port: `app/components/employees-list/EmployeesListA5.js` on the shared kit `app/components/a5-list/`.

## How it was verified (numbers, not eyes)
Both documents were loaded in the SAME browser tab at the same DPR (the mock copied to `public/_mock/`, temporary, git-ignored, removed at the end, opened in a same-origin iframe,
`*{transition:none!important;animation:none!important}` injected into both) and ~45 elements x 28 computed properties + `getBoundingClientRect` (w/h, top/left relative to `.app`) were diffed
per state: `base`, `filter` popup open, `sort` popup open, row `expand`ed, `table` view, `stuck` results bar (scrolled 720px), `page2`, and a connected/password marker row.
Tolerance 1.3px for geometry, exact match for fonts/colours/borders/radii/padding/gap/shadows. Desktop 1440x900 and mobile 390x844.

Result: **0 style differences** in every state. The only remaining numeric differences are data-driven (different employee names -> different text widths, different counts "78" vs "73",
a 5px scrollbar gutter that exists only when the popup list is taller than its box, and `display:none` elements whose rect is 0). The mock's own placeholder data (128 fake employees) is of course replaced by the real list.

## Checklist (status: identical / adapted (why) / missing)
| Element / state | Status |
|---|---|
| Page shell: `.app` padding, title row, back button (to `/admin` = "מרכז הניהול"), `h1` with `<small>ניהול</small>`, size 28px/600 | identical |
| Variant toggle `PageVariantToggle screen=employees_list placement=header` (gold swap icon, header start) | adapted - added by owner rule (not in mock) |
| Search bar under the title, half width (min 540px), pill 60px, gold border, 17px input | identical |
| Search icon (changes to sparkle in AI mode), input placeholder (normal / AI), clear button (fades in) | identical |
| `hf-ib` AI toggle + statistics buttons (36px round, `on` state navy/gold) | identical; hidden when `body.hide-ai-features` (existing site flag, the old page ignored it) -> adapted |
| ONE "סינון" trigger: icon + label + badge (pop animation) + chevron; collapses to icon in a narrow bar (container query) | identical |
| Filter popup: groups "מחלקה" (building icon), "סטטוס" (userck icon), titled group headers, option rows (check box, round icon, label, count), selected rows, "נקה סינון", hide-zero-count options unless selected, scrim | identical |
| Filter groups content: departments come from the data (6 real departments + "ללא מחלקה"), status = פעילים (default) / לא פעילים / מחוברים עכשיו / נדרש עדכון סיסמה | adapted - the mock's 6 hard-coded departments replaced by the real ones |
| Tabs "רשימת עובדים \| נוכחות" (nav, tab icons, on/off look) | identical; the attendance tab navigates to `/employees/attendance` (the real route) |
| Card `.card.hist`: navy header, gold icon, h2 "רשימת עובדים", "עובד חדש" navy button (-> `/employees/new`) | identical |
| Results bar: count "עובדים N", view switch (rows/table, knob), sort trigger ("מיון: שם מלא" + direction icon + chevron), pager, export trio; 38px controls, 16px radius, 8/14 padding | identical |
| Results bar floats under the top menu (sticky `top: snav+10px`) and turns peach when stuck (glass, shadow) | identical (class `stuck` set from a scroll listener, same threshold) |
| Sort popup: 7 options (שם מלא, קוד עובד, מחלקה, כניסה אחרונה, טלפון, מייל, סטטוס), re-click flips direction, "מהקטן לגדול / מהגדול לקטן · הפוך" | identical |
| Pager capsule: prev/next inside, numbers, sliding knob, `…` gaps, 50 per page, hidden when 1 page, scroll-into-view on page change | identical |
| Export trio `xlbtn xlg/xld/xlp` + tooltips "ייצוא רשימת העובדים לקובץ Excel / הורדת ... כקובץ PDF (באותו עיצוב כמו ההדפסה) / הדפסת ..." | identical markup; wired to `runListExport` (xlsx / PDF server / print window) - print+PDF sheets of the design come later via `EXPORT_HOOK` |
| Row line 1: 21px/600 name, icon box `ic-b sq` 75x48 (user / userck / ban), search highlight `mark.hf-mk` | identical |
| Row line 2: department, "כניסה אחרונה · <relative Hebrew day> · HH:MM", phone, mail (14px, icon+text pairs, hover gold icons) | identical; phone/mail pair omitted when the employee has none (mock always has one) -> adapted |
| Connected marker (heartbeat icon + "מחובר", tooltip "מחובר עכשיו · במשמרת H:MM שעות") and key marker (password needs update) at the row end, left of the chevron | identical (verified on a real injected row vs the mock row) |
| "כניסה אחרונה" for employees that never clocked in | adapted - "אין כניסות" (dimmed `lni zero`); not in mock |
| Chevron `go` 40px round button (rotates when open), row click opens the card, `Enter`/`Space` too, chevron click expands only | identical |
| Expanded details: `hv-r` rows (קוד, מחלקה, טלפון, מייל, כניסה אחרונה full Hebrew day, משמרת when connected, סטטוס, סיסמה), actions row (כרטיס עובד, נוכחות החודש, איפוס סיסמה, mail icon, print icon) | identical layout; actions adapted: card -> `/employees/<id>`, attendance -> `/employees/attendance?view=emp&emp=<id>`, reset-password / send-mail -> open the card (toast explains; both need manager approval that lives in the card), print-card -> toast "תתווסף בשלב ההדפסות" (hook for stage 2) |
| Table view: 7 sortable columns (up/down arrows `tsb`, sorted header), navy header, `tcn` name cell with markers, nowrap cells, row click opens card | identical |
| Empty state ("לא נמצאו עובדים התואמים את החיפוש" + "איפוס החיפוש והסינון") | identical |
| Loading ("טוען…") and error ("טעינת רשימת העובדים נכשלה" + retry) | adapted - not in mock (needed with real data) |
| Row-in animation on filter/sort/page change, badge pop, pager knob slide, sort icon flip, popup open animation | identical (CSS from palette + glue; feed remount re-plays `rowin` as `gm-rowin`) |
| Tooltips (`data-tip`) on every icon button; `aria-label` on all of them | identical (the page root runs the same tipify + `usePageTooltip`) |
| Keyboard: Arrow Down/Up on trigger opens and moves, Space/Enter toggles, Escape closes and returns focus to the trigger, Escape in the field clears, Enter in AI mode submits | identical (tested) |
| AI search (`/api/ai/smart-search`, pageContext `employees`): results replace the list, errors as dark toast (the old page used `alert`) | existing feature kept - error display adapted |
| Statistics button -> existing `StatisticsModal` | existing feature kept; the modal is the legacy-styled window (NOT dark) - **open item** (see notes) |
| Dialogs / toasts / tooltips: toast = palette `#toast`; no `window.confirm/alert` in the new code | identical |
| Mobile 390: search on its own row, tools below it, bottom-sheet filter popup (palette), rows 44px icon box, bar controls wrap | identical (palette/glue media queries) |
| Page padding bottom on mobile (mock 150px - inherited from the customer-card rail, palette 112px) | adapted - palette value |
| Global thin scrollbars of the site inside the filter list (mock: classic) | adapted (site-wide setting) |
| `aria-expanded` on the `<article>` row | adapted - removed (invalid for the role; kept on the `role=button` row and the chevron) |

No `missing` items.
