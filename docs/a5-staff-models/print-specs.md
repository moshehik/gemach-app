# Print / PDF / Excel sheet specs - orders and customers lists (management)

Written by the orders / customers list agent (11.10.2026) as the input for the print / PDF agent. The two lists only **hook** the export; they do not draw sheets.

## The hook (same convention as the employees / models lists)
Each list file exports `EXPORT_HOOK = { current: null }` (`app/components/orders-list/OrdersListA5.js`, `app/components/customers-list/CustomersListA5.js`).
On a click of the XL / download / print icon the list:
1. fetches the **whole filtered + sorted list** (not only the visible page of 50): pages of 500 through `POST /api/admin/<orders|customers>-list`, up to 10,000 rows
   (above that it exports the first 10,000 and shows a toast "צמצמו את הסינון");
2. builds the sheet spec below (pure functions `buildOrdersSheet` / `buildCustomersSheet` in `ordersLogic.js` / `customersLogic.js`, unit-tested);
3. calls `EXPORT_HOOK.current({ kind, rows, state, info, say, sheet })` - `kind` = `'excel' | 'download' | 'print'`, `rows` = all rows (list-row shape, see the logic files),
   `info.filterText` = the readable active-filter description ("סטטוס הזמנה: הושכר · חיפוש: כהן"), `info.sort` = `{key,label,dir}`, `info.total`, `say` = toast function.
   Return `true` when handled. Otherwise the default `runListExport` runs (xlsx / server PDF / print window of a plain table built from `sheetFlatRows(sheet)`).

## "דוח הזמנות" (orders)
`sheet = { title: 'דוח הזמנות', subtitle: <filter text>, groupBy: 'eventMonth', columns, groups, totals, hasDebt, hasCredit }`
* **Grouped by the Hebrew event month** (e.g. "תשרי תשפ״ז"), groups in chronological order, rows inside a group by event date then order number; orders without an event date in a last group "ללא תאריך אירוע".
  Each group object: `{ title, rows, total, paid, debt }` (per-group subtotals are available but the spec shows **totals once at the end**).
* **Columns**: `orderId` (מס׳ הזמנה), `customer` (לקוח), `day` (תאריך אירוע - only the Hebrew day, e.g. "ט׳ תשרי", because the month is the group title - no repeated value),
  `items` (פריטים, blank when 0), `total` (סכום, money), and `balance` (**"חוב" - only when at least one order in the list has a debt**; blank for orders without one).
* **Totals once, at the end**: `totals = { count, total, paid, debt, credit }` -> "N הזמנות · סך סכום ₪X · סך חוב ₪Y" (omit the debt part when `debt` = 0).
* No order status, no payment-state words, no delivery column (irrelevant duplicates of what the filter already says); the filter text appears once under the title.
* Excel: one flat sheet `sheetFlatRows(sheet)`: מס׳ הזמנה, לקוח, חודש אירוע, תאריך אירוע, פריטים, סכום, [חוב].
* Dates are Hebrew only; money as `₪1,234.5` (he-IL grouping); RTL; header row repeated on every printed page.

## "רשימת לקוחות" (customers)
`sheet = { title: 'רשימת לקוחות', subtitle, groupBy: null, columns, rows, totals: { count, debt }, hasOrders, hasDebt }`
* **Columns**: `number` (מס׳ לקוח), `name` (שם), `phone`, `email`, `city` - always; `orders` (הזמנות) **only when some customer in the list has orders**; `debt` (חוב) **only when some customer has a debt**.
  Blank cell instead of 0. No address / ID / bank / notes (sensitive or duplicate); no repeated values.
* Rows in the on-screen sort order (the user's choice), no grouping.
* **Totals once, at the end**: "N לקוחות" and, when `totals.debt` > 0, "סך חוב ₪Y".
* Excel: `sheetFlatRows(sheet)` = the same columns.

## Where the data comes from
Both lists read the management-only APIs (`/api/admin/orders-list`, `/api/admin/customers-list`; role gate `checkAuth('הנהלה ראשית')`). `print-access` (`lib/printAccess.js`) is NOT needed
unless the print agent opens a server-rendered print page: if it adds a new `/print/...` path it must also be added there with the page key `page:admin_orders_list` / `page:admin_customers_list`.
