# Customers list (management) - notes

Route `/admin/customers-list` (no legacy page, management area only). Files: `app/components/customers-list/{CustomersListA5,CustomersListLoader,customersLogic}.js`, shared
`app/components/admin-lists/*`, `app/admin/customers-list/page.js`, `lib/adminCustomersList.js` (pure), `lib/adminCustomersListServer.js`, `app/api/admin/customers-list/{route,counts/route}.js`.
Tests: `scripts/test_a5_orders_customers_lists.mjs`. Access model, registry, hub tile, permission key and the security matrix are the same as the orders list - see `orders-list-notes.md`.

## Data
* `POST /api/admin/customers-list` (head management / programmer only): 50 per page (up to 500 for export), same search helpers as `/api/customers` (name in any order, phone in any format incl. phone 2, e-mail, city, English-keyboard rescue, similar names).
* Per-customer aggregates (orders count, open debt, last order, active orders, first-order day) come from the cached customer snapshot - see "Cost model and safeguards" below. Open debt = sum of positive per-order balances (effective total as in `/api/orders`; credits are not netted); last order = `orderDate`, else the event date; active orders = derived status בקרוב / הושכר חלקי / הושכר / הוחזר חלקי.
* What leaves the server: name, `legacyId` ("number"), phone, e-mail, city, address line, blocked + reason, signed regulations, marketing consent, **`hasId` boolean** (the ID number itself is never sent), aggregates. No bank details, no notes. The UUID is sent only for navigation (`/customers/<id>`) and is never rendered.
* "Missing details": option "חסרים שדות חובה" = any field of `customer_required_fields` (the customer card's rule: `requiredFieldsFromSettings`) is empty; "אין מייל" accounts for `emailSuffix` the way `normalizeEmail` does; "אין טלפון" = no primary phone; "אין תעודת זהות" = `zeout` empty (TEST: almost every customer - the field is rarely filled).
* "Created period": **`Customer` has no creation timestamp** (`registrationDate` is free Hebrew text such as "כג אייר תשפג"). The period group is therefore "לקוח חדש (הזמנה ראשונה)": the first non-deleted order falls in the period (`some order in range AND none before the range start`). Customers without orders never match. If the owner wants real creation dates a DDL change would be needed - not done (no schema changes in this port).
* Customer number = `legacyId` (shown only when it exists; customers created in the app after the migration have none and show no number).

## Gotchas
* Filter counts: separate `/counts` request, loaded lazily (only while the filter popup is open) and computed in memory.
* "חתמו על התקנון" has no customers on TEST (the flag is new), so the option stays hidden until it has a count.
* A name stored with a leading space (old Access data) is shown as is (sorted first); trimming is a data fix, not a UI one.
* The card header title wraps on a 390px screen because the button label is longer than the other lists'.
* Export: whole filtered + sorted list, sheet spec in `print-specs.md`.

## Cost model and safeguards (11.10.2026 performance pass)
Same engine and guards as the orders list (see `orders-list-notes.md` > "Cost model and safeguards"); the customer-specific parts:
* **One aggregate snapshot** (`CUSTOMER_SNAPSHOT_SQL`, lib/adminCustomersList.js): all non-deleted customers with their order aggregates (orders count, open debt, last order, active orders, first-order day in Israel time), flags (blocked, signed regulations), sort keys and a **bit mask of empty fields** (the 13 card fields; "אין מייל" accounts for `emailSuffix`). One read-only query over `Customer` / `Order` / `Payment` / `PaymentObligation` / `OrderItem`, existing indexes only, ~190-250 ms of DB time on 19.5k customers; cached **30 s per DB mode** with in-flight de-duplication.
  Filtering (debt, missing details, orders, regulations, blocked, first-order period, AI ids, search ids), every sort (name, number, orders, debt, last order, city, phone, e-mail), the pager total and all option counts are computed from it in memory.
* **Per request only the page rows hit the DB** (`customer.findMany` by id for <= 100 rows) plus, for a new search, one cached (60 s) ids-only query. The previous version ran 12-21 statements per list request, `COUNTS` 69-87 statements (one `count` per option) and re-ran the 200 ms aggregate on every sort.
* **Counts are lazy** (only while the filter popup is open, debounced, not repeated on re-open) and free on the server (memory).
* Budgets, limits and the 503 / 400 behaviour are identical to the orders list (`SET LOCAL statement_timeout` 8 s / 12 s for the snapshot, 4 concurrent heavy requests per instance, page size <= 100 / export 500 up to 5,000 rows, offset <= 100,000, search matching more than 20,000 customers = "narrow your search").
* The "active orders" rule was corrected in this pass (an order is active when its derived status is בקרוב / הושכר חלקי / הושכר / הוחזר חלקי; the first version also counted past orders that still had untaken items): TEST now shows 677 customers with active orders instead of 1,140. `scripts/perf/verify-snapshot.mjs` checks it against `calculateOrderStatus` for every customer.

### Measured on TEST (same method and legend as the orders table)
| Scenario | Before: wall / statements | After: wall / statements | After: DB exec (sum, EXPLAIN ANALYZE) |
|---|---|---|---|
| default list | 2916 ms / 17 q | 5554 ms / 14 q | 252 ms |
| debt | 1891 ms / 12 q | 1888 ms / 9 q | 0 ms |
| active orders | 2156 ms / 13 q | 1920 ms / 9 q | 0 ms |
| no orders | 1743 ms / 13 q | 1873 ms / 9 q | 0 ms |
| sort orders desc | 3958 ms / 16 q | 1894 ms / 9 q | 0 ms |
| sort debt desc | 2685 ms / 12 q | 1875 ms / 9 q | 0 ms |
| sort lastOrder desc | 2529 ms / 12 q | 1901 ms / 9 q | 0 ms |
| sort city | 1729 ms / 13 q | 1895 ms / 9 q | 0 ms |
| first order d90 | 2941 ms / 15 q * | 1876 ms / 9 q | 0 ms |
| first order custom | 1746 ms / 13 q | 3865 ms / 15 q | 262 ms |
| missing any | 2833 ms / 12 q | 1855 ms / 9 q | 0 ms |
| missing email | 2769 ms / 12 q | 1873 ms / 9 q | 0 ms |
| search phone | 3233 ms / 20 q | 3855 ms / 19 q | 24 ms |
| search name | 4195 ms / 21 q | 3275 ms / 14 q | 9 ms |
| COUNTS default | 6037 ms / 69 q | 811 ms / 4 q | 0 ms |
| COUNTS search name | 3538 ms / 87 q | 788 ms / 4 q | 0 ms |
