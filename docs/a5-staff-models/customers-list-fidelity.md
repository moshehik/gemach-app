# Customers list (management) - fidelity checklist (`/admin/customers-list` vs the live employees / models lists)

Same method and reference as `orders-list-fidelity.md` (three same-origin iframes, computed style + rect diff, desktop 1440 and mobile 390).
Port: `app/components/customers-list/CustomersListA5.js` on the kit `app/components/a5-list`, server-paged.

Result: **0 style differences** against the models list in the base state (title row, search bar, card header, results bar and all its controls, row, icon box, chevron, pager),
and the same shared kit CSS for popup / expanded row / table / dialog (verified on the orders page, which uses the identical components). Mobile 390: only text-wrapping heights
(long names / e-mail addresses wrap to a second line).

## Checklist (status: identical / adapted (why) / missing)
| Element / state | Status |
|---|---|
| Title row `ניהול / לקוחות`, back arrow to `/admin`; no variant toggle (no legacy page) | identical / not applicable |
| Search bar, AI + statistics buttons, ONE "סינון" trigger | identical; AI = `smart-search` context `customers` -> narrows through `ids` (UUIDs, never shown) |
| Filter groups: **חוב** (עם חוב פתוח), **פרטים חסרים** (חסרים שדות חובה = the card's required fields from `customer_required_fields`; אין מייל; אין טלפון; אין תעודת זהות), **הזמנות** (עם הזמנות פעילות / עם הזמנות / בלי הזמנות), **תקנון** (חתמו / לא חתמו), **חסימה** (חסומים / לא חסומים), **לקוח חדש (הזמנה ראשונה)** (30 / 90 ימים / שנה / טווח מותאם) | identical look; zero-count options hidden unless selected; counts from `/api/admin/customers-list/counts` |
| "Created period": `Customer` has no creation timestamp (`registrationDate` is free Hebrew text) - the period is the date of the customer's FIRST non-deleted order | adapted - closest real data; documented in the notes |
| Row line 1: customer full name; icon box (user, ban when blocked) | identical |
| Row line 2 pairs: customer number (hash, `legacyId`), phone, e-mail, city, orders count (only > 0), debt (gold, only > 0), last order date in Hebrew, "חסום" (ban, tooltip with the reason) only for blocked customers; nothing for empty / zero | identical pattern |
| Blocked customer dimmed (`off`) | identical |
| Row click -> `/customers/<uuid>` (navigation only; the UUID is never displayed) | identical |
| Expanded details: מספר לקוח, טלפון, מייל, כתובת, הזמנות (n · m פעילות), חוב פתוח, הזמנה אחרונה (full Hebrew day), תקנון, תעודת זהות (קיימת / חסרה - the number itself is never sent to the browser), דיוור, חסימה + reason; actions: "כרטיס לקוח", "הדפסת כרטיס" (`/print/customer?type=card`), "דף חשבון" (`type=account`), mail icon (opens the card with a toast) | identical layout |
| Table view: 8 sortable columns (מס׳ לקוח, שם, טלפון, מייל, עיר, הזמנות, חוב, הזמנה אחרונה) | identical |
| Sort popup (8): שם (default), מספר לקוח, כמות הזמנות, חוב, הזמנה אחרונה, עיר, טלפון, מייל | identical look; orders / debt / last-order sort from the cached per-customer aggregates |
| Pager 50 per page (server), export trio on the whole filtered + sorted list (up to 10,000), hook + sheet spec in `print-specs.md` | identical markup |
| Dark range dialog for "טווח מותאם" (Hebrew calendar) | adapted - same dialog as the orders list |
| Empty / loading / error / notices, mobile 390 | identical |

No `missing` items.
