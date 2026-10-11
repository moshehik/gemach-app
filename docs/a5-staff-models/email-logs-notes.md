# Email log (`/admin/site-settings/email-logs`) - notes

Variant screen `email_logs` (`lib/uiVariantScreens.js`; programmer = new by default, everyone may switch for themselves, old page = `app/admin/site-settings/email-logs/LegacyEmailLogsPage.js`, byte-identical to main 15dc7a0d and test-pinned). Files: `app/components/email-logs/{EmailLogsSwitch,EmailLogsA5,emailLogsLogic}.js` + `email-logs.css`, `lib/adminEmailLogs.js` (pure), `lib/adminEmailLogsServer.js`, `app/api/admin/email-logs/{route,counts/route}.js`, print builder `app/components/a5-print/pkSpecsAdmin.js` (`emailLogDoc`, registry id `email-log`, surface `a5-email-log`). Tests: `scripts/test_a5_email_logs.mjs` (27). EXPLAIN tool: `scripts/perf/email-logs-explain.mjs`. Fidelity: `email-logs-fidelity.md`.

## Access
Programmer only, exactly as before: page = `app/admin/site-settings/layout.js` (`DEVELOPER_ONLY_ROLES`) on top of `app/admin/layout.js`; the new API routes check `checkAuth('מתכנת')` before touching anything (the old `/api/email-logs` is untouched and still serves the frozen legacy page). Live matrix on TEST (minted sessions of existing TEST employees): anonymous / deactivated secretary / secretary / seamstress / branch manager / **head management** -> 401 on both new routes and the old one; programmer -> 200. Pages: everyone but the programmer gets the no-access card. `/api/pdf` surface `a5-email-log`: 401 anonymous / deactivated, 403 secretary / seamstress / branch manager, 200 head / programmer (the surface is only a render permission, key `page:admin`; the data gate is the API - head management cannot read the log).

## Data (no schema change, no DDL)
`EmailLog` has no type, no order number and a single `fileName` string. Derived, not stored:
* **Type** = from the subject (every subject is defined in `lib/emailCatalog.js`): ordered regex rules in `EMAIL_TYPES`; the same regex strings are used in JS (display, tests) and in SQL (`~`, filter / counts / sort). "כרטיס הזמנה" vs "אישור הזמנה" share the subject shape and are told apart by the attachment; `status='subscribed'` rows (pseudo-rows written by the mailing-list sync, not e-mails) are "רישום לרשימת תפוצה"; free-text / internal-message mails (custom subjects) fall in "מייל חופשי או אחר". The test asserts every id of the catalog is covered and that SQL and JS agree on every catalog example (also verified live against Postgres: 0 mismatches).
* **Order number** = `הזמנה #N` in the subject (link `/orders/N`). **Customer** = `customerId` joined (name + `legacyId` as the number; the UUID only goes into the `/customers/<uuid>` URL, never displayed). **Sender** = `employeeId` joined (the old page did not show it).
* **Status** = `success` -> נשלח, `subscribed` -> נרשם, anything else -> נכשל (the old page showed everything that was not success as "שגיאה", including the list registrations).
* `errorMessage` of a *successful* send holds `Drive: <links>` (not an error): shown as "קבצים בדרייב" (links only for https drive / docs hosts), never as a failure reason.

## Privacy decision
The body of the two password-reset mails contains the **temporary password in clear text**. The old page only showed a clipped one-line preview. The new list never returns it: SQL replaces the body with NULL for that type (the browser never receives it), the details say "מוסתר - המייל מכיל סיסמה זמנית", and the search does not look into those bodies. Other bodies are shown as a 300-character preview (the old page showed a clipped preview too); the placeholder body of order-card mails is hidden. Not changed here (documentation point): the temporary password is still stored in `EmailLog.body` in the DB.

## Cost model (server load safe)
* One page of 50 (<= 100; export <= 500 per request, the client stops at 5,000 and says "צמצמו את הסינון") + one `count(*)` + two primary-key lookups (customers / employees of the page). Never the whole table.
* Counts for the filter popup are separate (`/counts`), requested only while the popup is open (kit `onFilterOpen`), 5 grouped queries.
* Every query goes through `guarded()` (`SET LOCAL statement_timeout` 8 s; 503 "צמצמו את הסינון"), requests through `runLimited` (4 concurrent), `page*limit` <= 100,000, search <= 200 chars, parameters are bound (`$n`), ORDER BY / CASE come from code constants only.
* EXPLAIN (TEST, 52 rows): every scenario (default, each sort, type + status, period, sender, search) = Seq Scan + top-N, 0.4-0.8 ms; counts 0.06-0.4 ms. There is **no index on `EmailLog.sentAt`** (only `customerId`, `employeeId`), so on a big table the default list is a seq scan + top-N sort and the `ILIKE` search is a seq scan by nature. At the expected volume (tens of rows a day per org) that is negligible; if the log ever reaches ~100k rows, the owner's DDL process can add `CREATE INDEX "EmailLog_sentAt_idx" ON "EmailLog" ("sentAt")` (not done here - no DDL).

## Gotchas
* Row click uses the kit's new `onOpen` contract: returning `false` means "no target" and the row expands.
* No AI / statistics buttons (no backend); search placeholder says recipient / subject / content.
* `Period` boundaries are Israel calendar days (`getIsraelDayRange`), compared against `sentAt` cast to `timestamp` (UTC clock values).
* In the dev browser the first requests of a cold dev server take several seconds (Neon over the network from the PC); counts appear a few seconds after the popup opens.
