# Departments (`/admin/departments`) - fidelity checklist vs the live new lists

Reference = `/admin/orders-list` (same concept as `/employees` / `/dashboard/dresses`), same tab, viewport and DPR. Page = `app/components/departments/DepartmentsA5.js`, header / shell from the kit `A5ListPage`.

## How it was verified (numbers)
Same harness as `email-logs-fidelity.md`: ~45 selectors x 14 style props + w/h in base, filter popup, sort popup, row expanded and table view at 1440x900; header block at 390x844; the dark create dialog compared with the orders range dialog (`#dlg`, `.dbadge`, `h2`, `.dbtns`, primary / ghost buttons). Result: **0 style differences**; differences left are data-driven: widths from text (departments labels, popup width 346 vs 336 because of "תפקיד מערכת"), popup height (4 vs 9 sort options), list height (6 rows vs 50), hv-btns height 41.6 vs 44 (orders has an icon button), the sort option highlight (different default sort), the disabled primary button of the range dialog, dialog height (form vs calendar).

Header numbers at 1440 / 390 are in `email-logs-fidelity.md` (identical to orders-list: topbar 88 / 44.8, back 1266.8 / 88.4 44x44, h1 28px/600, small 18px at 1216.3 / 103.2, search 714.8 / 146.8 596x60, card top 270.8, results bar 377.4, first row 449).

## Checklist
| Element / state | Status |
|---|---|
| Title row: back arrow (to `/admin`), `h1` `<small>ניהול</small>מחלקות`, variant toggle | identical (kit `A5ListPage`) |
| Search bar half width (name or number), AI / statistics | identical; AI + statistics **omitted** (no backend for departments) |
| ONE "סינון" popup: סוג מחלקה (תפקיד מערכת / מחלקה רגילה), עובדים (עם עובדים / בלי עובדים); zero-count options hidden (client counts) | identical |
| Sort popup: מספר מחלקה (default, as the old page), שם, מספר עובדים, סוג; table columns all sortable | identical |
| Card header "ניהול מחלקות" + navy "מחלקה חדשה" button | identical |
| Results bar, rows/table switch, 50/page pager capsule, XL / PDF / print trio | identical (kit, client paging - a handful of rows) |
| Row line 1: department name (21px/600, icon from `deptIcon`); line 2: number (hash), employees count (user icon, only > 0), "תפקיד מערכת" (lock + word, only for roleId 1 / 2; the old orange badge became icon + word, tooltip explains why it cannot be deleted) | identical pattern |
| Chevron details: מספר מחלקה, סוג, עובדים משויכים (active names + "ועוד N לא פעילים"), actions "שינוי שם" / "מחיקה" (disabled with tooltip for system roles, tooltip "יש עובדים משויכים" when blocked by employees) | identical layout |
| Create: dark dialog (number defaulting to max+1, name); server messages (409 duplicate name / number, 400 validation) shown inside the dialog; success toast | adapted from the inline table row of the old page (owner rule: dialogs, no inline editing, no `alert`) |
| Rename: dark dialog; the old page's warning about settings stored by department name is kept as the dialog sub-line | adapted (same reason) |
| Delete: dark confirm dialog; system role / employees => toast with the server wording; server error shown in a toast | adapted (replaces `window.customConfirm` + `alert`) |
| Empty / loading / 401 ("נדרשת התחברות") / load error with retry | identical |
| Export: Excel (number, name, employees, type, active names), PDF + print "מחלקות ועובדים" (a row per department, active employees, "+N לא פעילים" only when present, counts once in the header) | identical markup |
| Mobile 390: header / search / card / rows; dialogs become bottom sheets (palette behaviour) | identical; `scrollWidth` 397 as the other lists |

No `missing` items.
