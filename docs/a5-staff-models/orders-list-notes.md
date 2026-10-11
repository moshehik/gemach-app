# Orders list (management) - notes

Route `/admin/orders-list` (no legacy page, management area only). Files: `app/components/orders-list/{OrdersListA5,OrdersListLoader,ordersLogic}.js`, shared
`app/components/admin-lists/{useAdminServerList,RangeDialog}.js`, `app/admin/orders-list/page.js`, `lib/adminOrdersList.js` (pure), `lib/adminOrdersListServer.js`,
`app/api/admin/orders-list/{route,counts/route}.js`. Tests: `scripts/test_a5_orders_customers_lists.mjs` (32), DB proof `scripts/verify_orders_list_states_db.mjs`.

## Access (management only)
* The page sits under `/admin`, so `app/admin/layout.js` (`checkPageAccess(HEAD_MANAGEMENT_ROLES)`) shows the standard no-access card to everyone below head management / programmer; not logged in -> login screen (`app/layout.js`).
* The two API routes check `checkAuth('הנהלה ראשית')` before any query (roles 0 and 2; deactivated employees refused by `checkAuth` since the 2026-10-09 audit).
* Permission model: `page:admin_orders_list` / `page:admin_customers_list` registered in `lib/permissionsMetadata.js` exactly like `page:employees` (`notConfigurable`, `enforced:false`, default head management / programmer only). They are documentation + future wiring; enforcement is the layout + the API.
* Entry points: tiles "כל ההזמנות" / "כל הלקוחות" in the admin hub catalog (`lib/adminHubCatalog.js`, category "עבודה שוטפת", gate `head`) - which also feeds the shell's short "ניהול" panel pool and the menu search (labels in `lib/menu/pageLabels.js`).
  NOT in `navConfig.js`, the home page or the main menus. The legacy admin hub (`LegacyAdminPage.js`, frozen byte-identical copy) was not touched: it only lists 4 hard-coded cards; programmer (new hub) and any user with the new hub / new shell find the tiles.
* Registry: `NO_LEGACY_PAGES` entries `orders_list_admin` / `customers_list_admin` (`lib/uiVariantScreens.js`) - no variant switch, no `ui_variant_*` setting.
* Security test (TEST DB, minted sessions per `scratch/sec-audit`): anonymous, deactivated secretary, seamstress, secretary, branch manager, deactivated head -> **401 on all 6 API calls** (GET / POST / counts for both lists); head management and programmer -> 200. Pages: anonymous = login gate, low roles = no-access card.
  Known residual (R7 of `security-audit.md`): a deactivated head-management cookie still renders the empty page shell (no data - every API call is 401).

## Why a dedicated API (not `/api/orders`)
The list needs per-order **debt / credit** (payment sums), the **derived status** as a filter and sort, and **option counts**. `/api/orders` has none of these and its unpaid tabs load every order into memory.
The new route reuses the same search helpers (`lib/listSearch.js`, `lib/searchDb.js`: name / phone in any format / order number / barcode / model / Hebrew date, English-keyboard rescue, similar names, "partial results" notice),
the same effective-total formula as `/api/orders` (`totalAmount` > 0, else obligations, else payments - asserted in the unit test against the route source) and never loads all orders:
* all filtering, sorting, paging totals, debt / credit and option counts are derived in memory from ONE cached aggregate snapshot of the orders (30 s), and only the rows of the requested page are read from the DB - see "Cost model and safeguards" below.
Extra capabilities of the old list that were dropped on purpose: tab "לא-נלקחו", the 3-month default window (this list shows all orders, newest event first), inline delete / rental modal (management list - those are in the card).

## Derived status
Runtime: `deriveStateKey()` (lib/adminOrdersList.js) over the snapshot counts. Spec: `stateWhere()` expresses `calculateOrderStatus()` (lib/orderStatus.js) as a Prisma `where` (no longer used at runtime, kept as the declarative spec the tests and the DB proof compare against): deleted (order deleted, or items exist and all deleted, or draft when `draft_orders_show_as_deleted`),
returned / partReturned / rented / partRented (from the non-deleted items' `isReturned` / `isTaken`), draft, past / upcoming (event date vs. start of today in Israel).
Proven three ways: `scripts/perf/verify-snapshot.mjs` on the real data (the snapshot's status equals `calculateOrderStatus` for all 27,397 orders, both draft settings), an exhaustive combinations test without a DB (every item-flag pair x status x deleted x date, 1,500+ cases) and on the 27,397 orders of the TEST DB (counts and per-order ids identical, no overlaps, full coverage, both draft settings).
Default (no status selected) = every order except the deleted ones; selecting "מחוק" shows them.

## Gotchas
* Option counts are a separate request (`/counts`) loaded lazily - only while the filter popup is open (debounced; not on paging / sorting / re-open) - and computed in memory from the snapshot (no per-option query).
* Filters + counts + AI: "חיפוש חכם" returns order numbers (`ids`, max 500; none found = a non-existent id so the list is empty) and every request carries them.
* Search retry variants (keyboard rescue etc.): the list returns `variant`, the counts request repeats the same variant so the counts match the list.
* The snapshot's payment class uses `calculatePaymentStatus` semantics: an order with no amount and no payment (or only a refund) is neither debt nor "שולם במלואו" (the first version counted refund-only orders as settled: 23,500 -> 23,489 on TEST).
* `balance` sorts by `total - paid` (credits sort below zero). Refund payments are negative in `Payment.amount` (same as `/api/orders`), so an order with a refund can show a debt.
* TEST is reached over ~0.75 s of network per statement from a PC, so wall times in the table are dominated by the statement count; on Vercel (same region as Neon) a list request is one ~2-5 ms primary-key query (plus the 30 s snapshot refresh).
* Mail summary: the icon opens the order card (the card's mail sheet owns recipient / attachments) - deliberate, no silent real e-mails from a list.
* Creator ("created by") filter was not added: 60 distinct employees would make the popup group a long list; the `Order.employeeId` data exists if the owner wants it (group would be fed from the counts endpoint like branches).
* Branch group: shown only when the org setting `branches_enabled = true` (options from `branch_list`); TEST has no branches.
* Print / PDF: hook + sheet spec in `print-specs.md`.

## Cost model and safeguards (11.10.2026 performance pass)
Context: PROD has 27k+ orders and Neon compute / Vercel CPU quotas that were burned before by heavy scans. The first version of this API ran ~15-25 queries per request (a `count` + `findMany` with `EXISTS` filters over the whole table, 7 relation queries for the 50 rows, and for sorts / debt filters a 25,000-id array shipped to SQL and back);
`COUNTS` ran ~20 `count` queries per call. Measured on TEST (see the table) the 10-second cases were the computed sorts (SQL over a 25k-id array: 1.6 s DB time and ~25k ids on the wire) and everything chatty.

### The design now
1. **One aggregate snapshot, derived in memory.** `ORDER_SNAPSHOT_SQL` (lib/adminOrdersList.js) is ONE read-only query over all orders (3 CTE aggregates over `Payment` / `PaymentObligation` / `OrderItem` + `Customer` name, existing indexes only, no DDL):
   effective total (same formula as `/api/orders`), paid, item counts, event day in Israel time, delivery, branch, customer name. ~230 ms of DB time on 27k orders, 27k small rows. The result is kept **30 s per DB mode** in memory with in-flight de-duplication
   (`createTtlCache`, same idea as `lib/settingsCache.js`): at most ONE snapshot query per 30 s per server instance however many people click, sort, filter or page. From the snapshot (pure functions, unit-tested) come: the derived status (`deriveStateKey`), filtering (status / payment / delivery / period / branch / AI ids / search ids), **every sort** (total, paid, balance, items, status, customer, dates), the debt / credit / settled classes, the pager total and **all option counts**.
2. **Per request only the page rows hit the DB:** `orderRowsSql` = one query for the 50 (<= 100) rows of the page by order number (customer, payment / obligation sums and the items as JSON) - 1 query instead of ~7. A search adds one cached (60 s) ids-only query (`orderId` list of the matches; > 20,000 matches = "narrow your search"). Warm list request on TEST: 9 statements as counted by the harness - the page-rows query, `BEGIN` / `SET LOCAL` / `COMMIT`, and uncached setting reads that the real app serves from `lib/settingsCache.js` (was 15-26).
3. **Counts are lazy.** The client (`useAdminServerList`) asks for `/counts` only while the "סינון" popup is open (`onFilterOpen` hook of the kit), debounced 300 ms, and not again on re-open for the same filters. The server computes them from the snapshot in memory (no per-option `count`), so a counts call costs no DB query unless the snapshot is older than 30 s (+ the cached search ids).
4. **Budgets.** Every DB call goes through `guarded()` (lib/adminListDb.js): a batch transaction that starts with `SET LOCAL statement_timeout = 8000` (snapshot 12 s), so Postgres itself cancels a runaway query (proved on TEST: `pg_sleep(8)` cancelled at the limit, HTTP 503 `{"error":"הבקשה כבדה מדי - צמצמו את הסינון או את החיפוש ונסו שוב"}`, the pool is unaffected). A whole request has a 20 s deadline between stages. At most **4 heavy requests run concurrently per instance** (`createLimiter`); more get 503 "השרת עמוס" immediately instead of queueing and holding connections.
5. **Hard input limits** (`parseOrdersListParams` + `validatePaging`): page size <= 100 (an export request `export:true` may use 500 and returns no item details; the client exports up to 5,000 rows then tells the user to narrow the filter); `page * limit` offset <= 100,000 else HTTP 400; unknown sort / filter keys dropped; AI `ids` <= 500 numbers; search text <= 200 chars. Never "fetch everything".
6. **Freshness trade-off:** order membership, order of rows, the pager total and the counts reflect the snapshot (up to 30 s old); the 50 rows on screen are always read fresh. A just-created order shows up within 30 s.

### Expected cost (TEST DB = the same data volume as PROD)
| Operation | DB statements | DB time |
|---|---|---|
| Any list request (default / filtered / sorted / paged / searched) | 1 page-rows query (+1 ids query for a new search, cached 60 s) | ~2-5 ms |
| Snapshot refresh | 1 aggregate | ~230 ms, at most once / 30 s / instance |
| Counts (popup open) | 0 (memory) | 0 |
| Export page (500 rows, no item details) | 1 page-rows query | ~20 ms (measured 271 ms on a cold snapshot = 250 ms snapshot + ~20 ms) |
On a quiet day the whole screen costs ~1 snapshot query per 30 s of active use; on a busy day it is bounded by the same 1 query / 30 s plus 1 cheap primary-key query per click.

### Measured on TEST (`node --import ./scripts/perf/register.mjs scripts/perf/admin-lists-profile.mjs --explain`)
Wall time includes ~0.75 s of network round trip per statement from this PC to Neon, so the **statement count** (q) is the honest comparison; "DB exec" is `EXPLAIN (ANALYZE, BUFFERS)` execution time on the server (before: slowest single statement; after: sum of all statements).
Rows with ~230-260 ms of DB time and 14-15 statements are the ones that happened to include a snapshot refresh (30 s TTL). `*` = the harness run of the old code failed on this scenario (intermittent Prisma "error during query execution" on the `IN (1,700 ids)` / `NOT IN` pay filters); the old API took 3.4 - 13 s for these when called by hand.

| Scenario | Before: wall / statements | After: wall / statements | After: DB exec (sum, EXPLAIN ANALYZE) |
|---|---|---|---|
| default list | 5498 ms / 18 q | 4339 ms / 14 q | 234 ms |
| status rented | 4470 ms / 19 q | 1837 ms / 9 q | 2 ms |
| status upcoming+past | 4134 ms / 19 q | 1998 ms / 9 q | 2 ms |
| status deleted | 3992 ms / 18 q | 1846 ms / 9 q | 2 ms |
| pay=debt | 3466 ms / 15 q * | 1840 ms / 9 q | 3 ms |
| pay=settled | 3393 ms / 11 q * | 1894 ms / 9 q | 2 ms |
| pay=credit | 2216 ms / 11 q * | 1843 ms / 9 q | 2 ms |
| sort balance desc | 2083 ms / 10 q * | 2025 ms / 10 q | 7 ms |
| sort total desc | 10048 ms / 22 q | 1882 ms / 9 q | 9 ms |
| sort itemsCount desc | 14574 ms / 23 q | 3709 ms / 14 q | 261 ms |
| sort status asc | 7103 ms / 23 q | 1860 ms / 9 q | 2 ms |
| sort customerName | 5197 ms / 20 q | 1907 ms / 9 q | 4 ms |
| search phone | 5710 ms / 26 q | 3724 ms / 18 q | 16 ms |
| search barcode | 2700 ms / 16 q | 1829 ms / 9 q | 0 ms |
| search name | 6441 ms / 20 q * | 3865 ms / 19 q | 42 ms |
| search order no | 2863 ms / 12 q * | 3705 ms / 18 q | 38 ms |
| period custom (month) | 2113 ms / 11 q * | 3855 ms / 15 q | 242 ms |
| period past30 | 2331 ms / 13 q * | 1831 ms / 9 q | 2 ms |
| debt + sort balance | 7406 ms / 26 q | 1866 ms / 9 q | 7 ms |
| page 300 | 2201 ms / 12 q * | 1852 ms / 9 q | 3 ms |
| COUNTS default | 4392 ms / 27 q * | 1704 ms / 9 q | 0 ms |
| COUNTS debt | 2641 ms / 15 q * | 1533 ms / 8 q | 0 ms |
| COUNTS search name | 3668 ms / 20 q * | 2305 ms / 12 q | 0 ms |

### Tools
* `scripts/perf/admin-lists-profile.mjs` - runs every scenario of both lists against the real server code on TEST (read-only) with per-statement EXPLAIN; `scripts/perf/alias-loader.mjs` / `register.mjs` / `stub-*.mjs` let node run `lib/admin*ListServer.js` outside Next.
* `scripts/perf/verify-snapshot.mjs` - proves on all 27,397 orders (both settings of `draft_orders_show_as_deleted`) that snapshot status == `calculateOrderStatus`, Israel event day == `getIsraelDateKey`, total / paid == the `/api/orders` formula, and the customer aggregates (orders, debt, active orders) == a JS recomputation. (It found and fixed an off-by-one-day bug in the event-day SQL for midnight-UTC dates, and a wrong "active orders" rule for past orders with untaken items.)
* `scripts/perf/budget-check.mjs` - proves the statement timeout cancels a slow query and returns the clean 503.
* Node tests: `scripts/test_a5_orders_customers_lists.mjs` (limits, offset, timeout SQL, limiter, deadline, TTL cache, in-memory engine, static "every DB call is guarded" contract).
