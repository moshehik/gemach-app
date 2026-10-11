# Email log (`/admin/site-settings/email-logs`) - fidelity checklist vs the live new lists

Reference = `/admin/orders-list` (the same concept as `/employees` and `/dashboard/dresses`), same tab, same viewport, same DPR. Page = `app/components/email-logs/EmailLogsA5.js` on the shared kit, **header and shell from the kit component `A5ListPage`** (uniform-header requirement of 11.10.2026).

## How it was verified (numbers)
`getBoundingClientRect` + `getComputedStyle` (14 style props + w/h) on ~45 selectors in 5 states (base, filter popup, sort popup, row expanded, table view) at 1440x900, plus the header block at 390x844. Result: **0 style differences** (font size / weight / colour / background / radius / padding / gap / border) in every state. Remaining differences are data-driven only: widths that depend on text, the sort-popup option count (7 vs 9), the missing AI / statistics buttons (search input 76px wider), the selected sort row highlight (different default sort), `hv-btns` height (orders has an icon button).

### Header (uniform spec, 1440x900) - orders-list vs email logs (departments identical too)
| element | orders-list | email-logs | departments |
|---|---|---|---|
| `.app` left / top / width | 94.8 / 64 / 1240 | 94.8 / 64 / 1240 | 94.8 / 64 / 1240 |
| `.topbar` top / height | 88 / 44.8 | 88 / 44.8 | 88 / 44.8 |
| `.back` left / top / size | 1266.8 / 88.4 / 44x44 | same | same |
| h1 font | 28px / 600 / rgb(10,34,66) | same | same |
| `h1 small` left / top / font | 1216.3 / 103.2 / 18px 500 | same | same |
| `.hf-s` left / top / w x h | 714.8 / 146.8 / 596x60 | same | same |
| `.card.hist` left / top / width | 118.8 / 270.8 / 1192 | same | same |
| `.card-h` height | 68 | 68 (min-height rule in `a5-page.css`, no action button here) | 68 |
| `.hres-bar` top / h | 377.4 / 55.6 | 377.4 / 55.6 | 377.4 / 55.6 |
| first `.hrow` top / h | 449 / 112.5 | 449 / 112.5 | 449 / 112.5 |
390x844: `.app` 6.4/58, `.topbar` 22.4/74 (358.4 x 44.8), `.back` 336.8/74.4, `.hf-s` 22.4/132.8 (358.4x60), `.card` top 238.8 - identical; the filter trigger sits further to the left only because orders has the two extra icon buttons; `scrollWidth` 397 on all (the same 7px the other lists have).

## Checklist (identical / adapted (why) / missing)
| Element / state | Status |
|---|---|
| Title row: back arrow (to `/admin/site-settings`), `h1` with `<small>ניהול</small>יומן מיילים`, page variant toggle in the header | identical (kit `A5ListPage`) |
| Search bar under the title, half width, 60px pill, placeholder, clear button | identical |
| AI + statistics buttons | **omitted on purpose** - `smart-search` / `statistics` have no email-log context (no backend); search input is therefore 76px wider |
| ONE grouped "סינון" popup: סוג מייל (14 types), סטטוס שליחה (נשלח / נכשל / נרשם לרשימת תפוצה), תאריך שליחה (היום / 7 / 30 / שנה / טווח מותאם), נשלח על ידי (only senders that exist + "אוטומטי (בלי עובד)"); zero-count options hidden, no pills | identical look; counts are server counts (`/api/admin/email-logs/counts`, loaded only while the popup is open) |
| "טווח מותאם" -> dark dialog with the Hebrew range calendar (cancel un-selects) | identical to orders (`RangeDialog`); Hebrew dates only |
| Card header (navy, gold icon, "יומן שליחת מיילים") | identical (no action button - read-only log; height kept at 68 by the kit rule) |
| Results bar: count, rows/table switch, sort popup (7 sorts: זמן שליחה default, נמען, נושא, סוג, סטטוס, קבצים, מספר הזמנה), pager capsule 50/page (server paging), XL / download / print; sticky, peach when stuck | identical (kit) |
| Row line 1: recipient (email, bidi-isolated), 21px/600, icon box (mail / alert for failed / inbox for list registration), highlight | identical |
| Row line 2 (14px icon + value pairs): sent time (Hebrew date + HH:MM), type (catalog label + icon), status (icon + word, bold + warn colour when failed), attachments count (only > 0), order number (only when present), customer number (only when present), tooltips | identical pattern; nothing shown for zero / empty |
| Chevron expander with quick details: נמען, עותק, נושא, תוכן (first 300 chars; password-reset mails show "מוסתר - המייל מכיל סיסמה זמנית"), קבצים מצורפים, לקוח (name · #number), הזמנה, נשלח על ידי, נשלח (full Hebrew day + time), אישור קריאה, סיבת הכשל, קבצים בדרייב (links) + actions "כרטיס הזמנה" / "כרטיס לקוח" | identical layout; the old page showed a one-line clipped body preview - kept as a 300-char preview, hidden for password mails |
| Row click opens `/orders/<order no>` (else `/customers/<id>` - UUID only in the URL), rows without a target expand | identical behaviour (kit addition: `onOpen` returning `false` = expand) |
| Table view: 7 sortable columns (נמען, סוג, סטטוס, זמן שליחה, נושא, קבצים, הזמנה), numeric cells centred / dimmed at zero | identical |
| Export trio: Excel (real xlsx, 12 columns, whole filtered list up to 5,000), PDF + print = designed sheet "יומן שליחת מיילים" via `a5-print` (grouped by Hebrew day, time / recipient / type / status, "סיבת הכשל" column only when failures exist, count + failures once in the header) | identical markup; print preview verified (12 rows, day groups) |
| Empty / loading / error states, 503 "צמצמו את הסינון" shown in the list body or as a toast | identical |
| Dialogs / toasts: dark site dialog (range picker), palette toast; no `window.confirm/alert` (asserted by test) | identical |
| Mobile 390: header / search / card / rows as the other lists | identical (data-driven differences listed above) |

No `missing` items.
