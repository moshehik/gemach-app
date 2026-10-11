# Models list - fidelity checklist (mock `models.html` vs `/dashboard/dresses` A5)

Source of truth: `scratch/emp-models-build/models.js` + `models.app.html` + `list-core.js` + `page.css` (built mock: `תצוגות-עיצוב/עובדים-ודגמים/models.html`).
Port: `app/components/models-list/ModelsListA5.js` on the shared kit `app/components/a5-list/`.

## How it was verified
Same method as `employees-list-fidelity.md` (same-tab same-DPR iframe comparison, ~45 elements x 28 properties + geometry, states base / filter / sort / expand / table / stuck / page2 / **delete-restore dialog**,
desktop 1440 and mobile 390). Result: **0 style differences** in all states (differences left are data-driven: page count, digits width, popup scrollbar gutter).
The mock page has no tabs row; the palette gives the first `.panel` a top margin only after `.tabs` in the design, so `.layout.one .main>.panel:first-child{margin-top:0}` is in `a5-page.css` (without it the card sat 64px lower).

## Checklist
| Element / state | Status |
|---|---|
| Title row "ניהול / דגמים", back button, variant toggle `models_list` | identical (toggle: added by owner rule) |
| Search bar half width under the title, AI + statistics buttons, ONE "סינון" trigger | identical |
| Filter groups: סטטוס (פעילים default / לא פעילים / מחוקים), מלאי (יש פריטים בתיקון / לא בשימוש / יש רזרבה / יש פריט מחוק), קטגוריה, השכרות (לא הושכר מעולם / לפחות 10 / 30 / 60); counts per option; zero-count options hidden unless selected | identical; "קטגוריה" options come from the data (`priceCategory` is free text on the server: "כללי", "תיקונים", ... , "ללא קטגוריה") instead of the mock's 4 fake categories -> adapted |
| Sort popup: 9 options (שם דגם, קוד, תאריך כניסה, כמות פריטים, כמות השכרות, לא בשימוש, רזרבה, בתיקון, סטטוס) + direction | identical |
| Results bar (count, view switch, sort, pager, export trio), sticky + peach when stuck, pager 50/page capsule | identical |
| Paging | adapted - **client-side 50/page over the whole catalog** (server returns up to 500/page, catalog ~120 models). Reason: the grouped filter with per-option counts and sorting by derived columns (לא בשימוש / רזרבה / בתיקון / השכרות) need the whole set; server-side search stays on the server. The kit also supports server paging (`total/page/onPage`) for lists that need it. |
| Row line 1: icon box (dress / ban / trash), 21px name; line 2: code (hash icon), then items / לא בשימוש / רזרבה / בתיקון / השכרות pairs **only when > 0**, entry date in Hebrew | identical (zero counts not shown, code on line 2 with the hash icon) |
| Row states: inactive = dimmed (`off`), deleted = dimmed + strikethrough name (`off gone`) | identical |
| Chevron expands quick details; row click opens the card (`/dashboard/dresses/<id>`) | identical |
| Details: קוד דגם, קטגוריה, פריטים (n פריטים · n לא בשימוש · n רזרבה · n בתיקון [· n מחוקים]), מידות במלאי (size (count) · ...), השכרות, נכנס למאגר, יצא מהמאגר, עדכון אחרון, סטטוס (reason) | identical |
| Actions: "כרטיס דגם" primary; trash icon button (active models; head management / programmer only - the existing rule); "החזר לפעילות" (inactive; everyone, as in the old page); "שחזור" (deleted; head management / programmer) | identical; permissions as the old page |
| Dark confirm dialogs: delete / restore / return-to-activity, with the hero badge icon, title, sub text, primary button with icon, "חזרה" ghost button | identical (verified numerically against the mock dialog); replaces `window.customConfirm` + `alert` of the old page |
| Result toasts: "הדגם X הועבר למחוקים / שוחזר / חזר לפעילות / עדיין לא פעיל (אין פריטים בשימוש)" and API errors | identical wording (mock) with real API calls |
| "דגם חדש" navy button in the card header (`/dashboard/dresses/new`) | identical; shown only to head management / programmer (existing rule of the old page) |
| Table view: 9 sortable columns, numeric cells centered, zero cells dimmed, status text | identical |
| Empty / loading / error states | empty identical; loading + error adapted (not in mock) |
| Server search notices (English keyboard rescue etc., `notices` of `/api/dresses`) | existing feature kept - shown above the results bar like on the home page |
| AI search | new for models (the old page had none): `smart-search` with context `dresses` (rows are items) -> narrows the list to their models; hidden with `hide-ai-features` |
| Statistics button -> existing `StatisticsModal` (legacy look, not dark) | open item (see notes) |
| Export trio -> `runListExport` (xlsx / PDF / print window); columns = the mock's 12 export columns | print/PDF sheets of the design come in stage 2 via `EXPORT_HOOK` |
| Mobile 390 | identical |

No `missing` items.
