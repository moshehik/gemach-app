# Orders list (management) - fidelity checklist (`/admin/orders-list` vs the live employees / models lists)

Source of truth: the approved list concept as ported in `app/components/employees-list` and `app/components/models-list` (kit `app/components/a5-list`).
Port: `app/components/orders-list/OrdersListA5.js` on the same kit, server-paged. There is no mock page for orders - the reference IS the two finished lists
(owner request: "identical concept, exact in every aspect").

## How it was verified (numbers, not eyes)
The orders page, `/dashboard/dresses` and `/employees` were loaded as three same-origin iframes of one static page (same tab, same DPR; helper `public/_a5fid.html`,
temporary, deleted at the end), `*{transition:none!important;animation:none!important}` and ~35 selectors x 17 computed properties (+ `getBoundingClientRect` w/h) were diffed
per state: base (title row, search bar, card header, results bar and every control in it, row line 1 / line 2 / icon box / chevron, pager capsule), filter popup open,
row expanded (details + action buttons), table view, and the dark dialog; desktop 1440x900 and mobile 390x844.

Result: **0 style differences** in every state. Differences left are data-driven only: sort-button width (the label "מיון: תאריך אירוע" is longer than "שם דגם"), filter badge (models has a default
selection, orders has none), option check-box state, text-driven widths/heights (wrapping in the expanded rows, "הזמנה חדשה" vs "דגם חדש" button width), the disabled primary button of the range dialog.

## Checklist (status: identical / adapted (why) / missing)
| Element / state | Status |
|---|---|
| Title row: back arrow (to `/admin`), `h1` with `<small>ניהול</small>הזמנות`, size/weight as the other lists | identical |
| Page variant toggle | not applicable - no legacy page (registered in `NO_LEGACY_PAGES`, no switch) |
| Search bar under the title, half width, 60px pill, placeholder (normal / AI mode), clear button | identical |
| AI toggle + statistics buttons; ONE grouped "סינון" trigger with badge | identical; AI = `smart-search` context `orders`, results narrow the list through `ids` (up to 500 order numbers); hidden with `body.hide-ai-features`; statistics = existing `StatisticsModal` (legacy look) - open item as in the other lists |
| Filter popup groups: **סטטוס הזמנה** (בקרוב / עבר / הושכר חלקי / הושכר / הוחזר חלקי / הוחזר / מחוק / טיוטה), **תשלום** (חוב פתוח / זיכוי ממתין / שולם במלואו), **משלוח** (עם / בלי), **תאריך אירוע** (היום / 7 ימים קרובים / 30 ימים אחרונים / שנה אחרונה / טווח מותאם), **סניף** (only when `branches_enabled`) | identical look; options hidden when their count is 0 unless selected (counts come from the server: `/api/admin/orders-list/counts`, same semantics as the kit: all other groups + the search applied); the "טיוטה" option only exists when `draft_orders_show_as_deleted` is off |
| "טווח מותאם": selecting it opens a dark dialog with the Hebrew month calendar of the order card (range mode); the option label becomes the chosen Hebrew range; cancel/Escape un-selects it | adapted - needed because the popup only holds options; Hebrew dates only (no Gregorian anywhere) |
| No pills / tags: the filter summary is only the badge number | identical |
| Card header (navy, gold icon, "רשימת הזמנות", navy "הזמנה חדשה" button -> `/orders/new`) | identical (button added like "עובד חדש" / "דגם חדש") |
| Results bar: count "הזמנות N", view switch, sort trigger, pager (50 per page, server paging), XL / download / print trio; sticky and peach when stuck | identical (kit) |
| Sort popup (9): תאריך אירוע (default, newest first), מספר הזמנה, לקוח, תאריך יצירה, סכום, שולם, יתרה, כמות פריטים, סטטוס | identical look; native sorts run in the DB; total / paid / balance / items / status are computed in SQL (see notes) |
| Row line 1: customer full name, 21px/600, icon box (file; trash for deleted), search highlight | identical |
| Row line 2 (14px, icon + value pairs): order number (hash), event date in Hebrew (gift), items (dress) only when > 0, derived status = icon + word (not a tag), truck only for orders with delivery, branch only when set, debt (cash, gold) only when > 0, credit (wallet) only when > 0; nothing for zero / empty | identical pattern; every pair has a tooltip |
| Deleted order: dimmed + struck-through name (`off gone`) | identical to the models list |
| Chevron expander + row click opens `/orders/<orderId>` (short order number - never a UUID) | identical |
| Expanded details: לקוח, טלפון, פריטים (model (size) · ...), תאריך אירוע (full Hebrew day), נוצרה, סטטוס, סכום, שולם, מצב תשלום, משלוח / סניף when present; actions: "כרטיס הזמנה" (primary), "הדפסת הזמנה" (`/print/order`), "כרטיס לקוח", mail icon | identical layout; the mail icon opens the order card with a toast (the summary mail needs recipient / attachments choices that live in the card's mail sheet - no silent real e-mails from a list) -> adapted |
| Table view: 8 columns, all sortable (מס׳ הזמנה, לקוח, תאריך אירוע, פריטים, סטטוס, סכום, שולם, חוב / זיכוי); numeric cells centred, zero dimmed | identical |
| Empty / loading / error states, server notices (keyboard rescue / similar names / partial) shown above the results bar | identical (existing /api/orders search behaviour kept) |
| Export trio: Excel (real xlsx), PDF, print - on the **whole filtered + sorted list** (not just the page): rows fetched in pages of 500, up to 10,000 | identical markup; wired through `EXPORT_HOOK` with the sheet spec (`docs/a5-staff-models/print-specs.md`), default = `runListExport` |
| Dialogs / toasts: dark site dialog (range picker), palette toast; no `window.confirm/alert` | identical |
| Mobile 390: search on its own row, tools below, rows 44px icon box, bar controls wrap; no horizontal overflow beyond the 7px the other two lists have | identical (the card-header title wraps to two lines because the button label is longer) -> adapted |

No `missing` items.

## Shared header shell (11.10.2026)
The page now renders its title row, search slot, card and card header through the kit component `A5ListPage` (`app/components/a5-list/A5ListPage.js`; same markup the page had by hand, so nothing visual changed). Measured before / after in the same viewport (iframe harness, 1440x900, `getBoundingClientRect`): **0 differences** on `.app`, `.topbar`, `.back`, `h1` (28px/600) and `h1 small` (18px/500), `.a5-tools` / toggle, `.hf-s`, `.card.hist`, `.card-h`, `.hres-bar`, first `.hrow`.
| element (1440x900) | before = after |
|---|---|
| `.topbar` left / top / w x h | 129 / 88 / 1192 x 44.8 |
| `.back` | 1277 / 88.4, 44x44 |
| `h1 small` | 1226.5 / 102, 36.5x22 |
| `.hf-s` | 725 / 146.8, 596x60 |
| toggle (`.a5-tools`) where present | 129 / 90.4, 40x40 |
| `.card.hist` top | 270.8 (employees: tabs row 270.8 x 60, card 394.8) |
| `.hres-bar` top / h | 377.8 / 56 (employees 501.8) |
(The iframe harness has a fixed 105px left offset; relative positions equal the spec of the coordinator's message: topbar 88/45, back 44x44, search 596x60 at 147, card 271.) 390x844: topbar 26 / 74, back 330 / 74.4, search 26 / 132.8 (348x60), card 26 / 238.8, toggle 280 / 76.4 on every page that has one.
Static gate: `scripts/test_a5_list_header.mjs`.
No legacy page => no toggle in the header (registered in `NO_LEGACY_PAGES`); at 390 the `<small>` therefore sits 50px closer to the arrow than on pages with a toggle - inherent, same as before.
