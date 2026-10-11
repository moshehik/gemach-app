# Security audit - employees / models / model card / new model (a5-staff-models port)

Date: 2026-10-09 (first pass), final re-audit 2026-10-11 (section 6). Scope: every page and API the four ported screens use or will use. Method: code reading of the auth mechanism and of every
route, then real HTTP requests against the dev server (port 3071, TEST database only, no PROD) as: anonymous, a deactivated secretary, a
secretary (roleId 4), a branch manager (roleId 1), head management (roleId 0), a deactivated head-management employee, and the programmer
(roleId 2). Sessions were minted with the repo's own `createSessionToken` (`lib/authTokens.js`) for throwaway `SECAUDIT` employees that were
deleted afterwards. Re-run: `node scripts/test_a5_staff_models_security.mjs` (pure logic + source gate manifest, 61 checks).

## 1. How access control works here

| Layer | Mechanism | Notes |
|---|---|---|
| Middleware | `middleware.js` only forwards `x-pathname`. **No auth.** | By design; everything below is per route. |
| Page shell | `app/layout.js`: when `require_login=true` and no verified cookie it renders `LoginGate` instead of `children`. | `require_login` is `true` on the TEST DB. If it is `false` the whole site is "open mode" (see risk R1). |
| Page gates | `app/employees/layout.js`: `checkPageAccess([0,2])`. `app/dashboard/dresses/layout.js`: `PageGate page:dresses_catalog` (permissions catalog, default closed). | `/dashboard/dresses/new` and `/[id]/print` sit under the same layout. |
| Identity | `auth_token` (raw employee uuid) is trusted **only** together with a matching signed `auth_session` cookie (`getVerifiedAuthCookie`). A hand-typed `auth_token` is anonymous. | Verified: forged cookies are refused. |
| API gates | `checkAuth()` (any verified session, or anybody in open mode), `checkAuth('הנהלה ראשית')` (roles 0, 2), `checkAuth('מתכנת')` (role 2), `getAttendanceViewer()`, `checkAiAccess()` (`feature:ai`), `canOpenPage()`. | `ROLE_LEVELS`: 'מנהל' = [1,2], 'הנהלה ראשית' = [0,2], 'מתכנת' = [2]. |
| Escalation ladder | `canManageRoles` / `roleRank`: 2 > 0 > 1 > rest. | Employee create/edit/password refuse a target or new role above the actor. |
| Page variant | `UI_SCREEN_REGISTRY` + `/api/me/ui-variant/<screen>`: only roles 0 and 2 may switch, only their own record, role read from the DB. | The new design changes only the component; **it calls the same APIs and the same layouts**, so it inherits all the gates below. |

## 2. Results (after the fixes of this audit)

Legend: 401 = not logged in, 403 = refused, 200 = allowed. "low" = secretary (4), seamstress (3) and branch manager (1) behave the same unless noted.
"ded" = deactivated employee.

### Pages

| Page | anon | ded | low role (4/3/1) | head (0) | programmer (2) | Notes |
|---|---|---|---|---|---|---|
| `/employees`, `/employees/[id]`, `/employees/new`, `/employees/attendance`, `/employees/report`, `/employees/[id]/attendance` | login screen | no-access card | no-access card | page | page | Some paths 307 to the attendance redirect (by design). |
| `/dashboard/dresses`, `/dashboard/dresses/[id]`, `/dashboard/dresses/new`, `/dashboard/dresses/[id]/print` | login screen | no-access card | no-access card on TEST (catalog default is closed; PROD has explicit `DepartmentPermission` rows) | page | page | Same layout for all four. |
| `/admin` (reference) | login screen | no-access | no-access | page | page | |

### APIs

| API | anon | ded | low | head | prog | Data exposed / notes | Fix |
|---|---|---|---|---|---|---|---|
| `GET /api/employees` (no flag) | 200 names+ids only | slim | slim | full (all=true) | full | Login pickers need the anonymous list. Hashes are always stripped. | **Fixed (F2)**: non-head sessions get the slim shape even with `?all=true`. |
| `GET /api/employees?all=true` | 200 names+ids | slim (5 keys) | slim (9 keys) | 32 keys incl. wage, phones, address | same | Before: a secretary received `hourlyWage`, phones, email, notes of all 104 employees. | **Fixed (F2)** |
| `GET /api/employees?slim=1` | names+ids | slim | slim | slim | slim | Picker shape: id, names, roleId, department, approvals. | none needed |
| `POST /api/employees` | 401 | 401 | 401 | 200 (roleId 2 -> 403) | 200 | Extra body fields (`id`, `legacyId`, `showAi`, `themeColor`) are ignored (explicit field list). | none |
| `GET/PUT /api/employees/[id]` | 401 | 401 | 401 | 200 | 200 | No `password`/`pinHash` in output. Editing a programmer, or assigning roleId above own rank: 403. | none |
| `GET /api/employees/[id]/history` | 401 | 401 | 401 | 200 | 200 | | none |
| `GET /api/employees/presence` (new) | 401 | 401 | 403 | 200 | 200 | `getAttendanceViewer().isManager`, fails closed. | none |
| `GET /api/employees/attendance`, `/api/attendance-sheet` | 401 | 401 | 403 | 200 | 200 | wages only for managers | none |
| `POST /api/employees/[id]/shifts` (+ `[shiftId]` PUT/DELETE) | 401 | 401 | 403 for other people's shifts | 200 | 200 | `decideShiftWrite`: own shifts only for non-managers, wages stripped. | none |
| `POST .../set-password`, `.../reset-password` | 401 | 401 | 401 without manager code; 403 with a non-manager's code | manager code verified (bcrypt) | same | Cannot take over a more senior account. | none |
| `POST .../password` | 401 | 401 | 403 for other people | needs own password; senior target 403 | same | | none |
| `GET /api/departments` | 401 | 401 | 200 | 200 | 200 | names + roleIds only | none |
| `GET /api/dresses` (list, `fields=summary&counts=1`) | 401 | **was 200, now 401** | 200 | 200 | 200 | catalog data; API is intentionally open to all staff (the order form needs it). | F3 |
| `GET /api/dresses/[id]` (+ `/rentals`, items history) | 401 | 401 | 200 | 200 | 200 | rentals include customer names (same as the order screens) | F3 |
| `POST /api/dresses` (create model) | 403 | 403 | 403 | 200 | 200 | | none |
| `PUT /api/dresses/[id]` | 403 | 403 | 403, except a body made only of `exitDateFromRepo`/`entryDateToRepo`/`inactiveReason` (200, by design) | 200 | 200 | A mixed body (toggle + any other field), `{}` and `isDeleted` -> 403. | none |
| `DELETE /api/dresses/[id]` | 403 | 403 | 403 | 200 | 200 | | none |
| `POST /api/dresses/[id]/items`, `PUT/DELETE /api/dresses/items/[itemId]` | 401 | 401 | **200** | 200 | 200 | Existing design: any signed-in staff manage physical items (location, repair flags). | **Owner decision D1** |
| `GET /api/dresses/next-code` | **was 200, now 401** | 401 | 200 | 200 | 200 | | **Fixed (F4)** |
| `POST /api/upload` | 401 | 401 | 200 | 200 | 200 | Image is re-encoded to JPEG; undecodable files now keep only video/audio/pdf types (else octet-stream); 60 MB cap. | **Fixed (F1)** |
| `GET /api/attachment/[id]` | public | public | public | public | public | Public capability URL by design (uuid = secret, dress images). Path traversal, SQL text and null bytes -> 404. Active content (html/svg/xml/js, unknown types) is served as `application/octet-stream` + `attachment`, always `nosniff`. | **Fixed (F1)** |
| `GET /api/audit` | 401 | 401 | 200 without Employee/Shift/permission/device/key rows | 200 all | 200 all | Before: `entityType=Shift` returned every coworker's `hourlyWageSnapshot`/`totalCalculated`/`paymentMethod`; `limit=100000` returned 1.5 MB. | **Fixed (F5)**, limit capped at 2000 |
| `POST /api/ai/smart-search`, `/api/ai/statistics` | 401 | 401 | 403 (no `feature:ai`) | 200 | 200 | see risk R4 | none |
| `GET/POST /api/me/ui-variant/*` | 401 | 403 | 403 for any `a5`/screen change; GET shows `canSelfSwitch:false` | self only | self only | Tested for shell, home, employees_list, models_list, model_card, model_new, unknown screen (404); a foreign `employeeId` in the body is ignored. | none |
| `POST /api/pdf` | 401 | 401 | 403 unless the page permission is held | ok | ok | Only allow-listed print paths (`lib/printAccess.js`); a **new** print path must be added there with its page key. | none |
| `GET /api/settings` | public | public | public | public | public | Public by design (kiosk/login/print pages need it); secret keys are masked. | residual R3 |
| `GET /api/pricelists/categories` | public | public | public | public | public | price-category names only | residual R3 |
| `GET /api/dev/agent-login` | 404 | 404 | 404 | 404 | 404 | 404 unless `AGENT_LOGIN_SECRET` is set **and** matches. | none (see R5) |
| `GET/POST /api/dev/switch-env`, `GET /api/dev/fix-employees`, `POST /api/dev/db-import` | 403 outside `next dev`; in `next dev`: **was open to anyone**, now programmer only | | | | | `switch-env` GET returned the PROD and TEST connection strings to an anonymous caller in dev. Now URLs only for a signed-in programmer. | **Fixed (F6)** |

CSRF: auth cookies are `SameSite=Lax` (+ `Secure` in production), so a cross-site POST/PUT/DELETE does not carry the session. No `GET` handler under
`app/api/employees`, `dresses`, `audit`, `upload`, `attachment` writes (asserted by the test). `GET` handlers that do write elsewhere are token or secret based
by design (`bulk-email/confirm`, `cron/daily`, `dev/agent-login`).

Error responses: all audited routes return generic Hebrew/English messages on 500 (no stack, no SQL); malformed JSON on `PUT /api/dresses/[id]` is a plain 500.

## 3. Findings and fixes

| # | Severity | Finding | Fix (files) |
|---|---|---|---|
| F1 | **High** | Stored XSS path: `POST /api/upload` kept a client-chosen `Content-Type` (e.g. `text/html`) for files `sharp` cannot decode, and the public same-origin `GET /api/attachment/[id]` served it as that type. A low-role employee could plant a page and send the link to a manager; the script runs on the app's origin with the manager's session. | `app/api/upload/route.js` (type allow-list for the fallback, size cap), `app/api/attachment/[id]/route.js` (allow-list serving, octet-stream + attachment for the rest, `nosniff`, uuid-shaped id only). Covers rows already in the DB (verified with a hand-inserted `text/html` row). |
| F2 | Medium | `GET /api/employees?all=true` (and the no-flag form) returned the full HR row (hourly wage, payment method, phones, address, email, notes, roleId, permissions) of every employee to **any** signed-in employee. The page is head-management only; the API was not. | `app/api/employees/route.js`: non-head sessions (and signed-in-but-deactivated cookies) are forced to the slim picker shape. Open mode unchanged. |
| F3 | Medium | A deactivated employee kept API access (every plain `checkAuth()` route, and the role gates on the fast path) until the 7-day cookie expired; only `getSessionEmployee()` and `/api/me` looked at `isActive`. | `lib/auth.js`: a 30 s per-instance cache of deactivated employee ids makes `checkAuth()` treat such a cookie as anonymous; the role-lookup selects `isActive`. `lib/authTokens.js`: DB paths of `checkAuthCore` / `checkPageAccessCore` refuse `isActive === false`. Staleness window: 30 s (cache) and, for role gates on a fresh token, 15 min (existing design). |
| F4 | Low | `GET /api/dresses/next-code` was unauthenticated. | `app/api/dresses/next-code/route.js`: `checkAuth()`. |
| F5 | Medium | `GET /api/audit` exposed Shift rows (per-shift wage snapshots of all employees) and permission / trusted-device / API-key change rows to every signed-in employee; no `limit` cap. | `app/api/audit/route.js`: `HEAD_ONLY_AUDIT_ENTITIES` (Employee, Shift, EmployeePermissionOverride, DepartmentPermission, PermissionPageGroup, TrustedDevice, ApiKey, Department), `limit` 1..2000. |
| F6 | Low (dev only) | In `next dev`, `/api/dev/switch-env` (GET/POST), `/api/dev/fix-employees`, `/api/dev/db-import` needed only a login (or nothing at all in open mode; `switch-env` needed nothing ever) - an anonymous request could read the DB URLs or flip the shared dev server to PROD. All three are `403` when `NODE_ENV !== 'development'`, i.e. dead on Vercel. | `app/api/dev/*`: `checkAuth('מתכנת')`; GET `switch-env` returns the URLs only to a signed-in programmer. Side effect: the dev banner shows the mode but not the URLs on the login screen. |

New code added by the port was reviewed in the same pass: `app/api/employees/presence` (gated, fails closed), the `counts=1` extension of `GET /api/dresses` (counts only, same
gate), `lib/uiVariantScreens.js` entries (`employees_list`, `models_list`, `model_card`, `model_new` - low roles refused, see test).

## 4. Residual risks / owner decisions

* **D1 - dress items.** Any signed-in employee can create, edit and soft-delete `DressItem` rows (the legacy cards do the same; staff move items between locations). Model create/delete and full model edits are head-management only. If the owner wants item create/delete restricted too, change `POST /api/dresses/[id]/items` and `DELETE /api/dresses/items/[itemId]` to `checkAuth('הנהלה ראשית')` **and** hide the buttons in both UIs; the location/repair edits would stay open.
* **R1 - open mode.** If `require_login` is turned off, `checkAuth()` (no role) passes anonymous visitors and `/api/employees?all=true` returns the full HR table to them. Role-gated routes (`הנהלה ראשית`/`מתכנת`) stay closed. Both production organisations must keep `require_login=true` (not verifiable from here: no PROD access).
* **R2 - no brute-force limit** on `set-password` / `reset-password` / `verify-pin` / login (the manager's code is checked server-side with bcrypt but attempts are unlimited). Pre-existing, global; a rate limit belongs in a separate change.
* **R3 - public reads by design:** `GET /api/settings` (secrets masked), `/api/pricelists/categories`, `/api/attachment/[id]` (capability URL: anyone who learns a uuid can fetch error-report screenshots/recordings; uuids are only shown to people who can open those reports), `GET /api/employees` names+ids for the login picker, `/api/queries-by-path` (static explanatory text, no data).
* **R4 - AI smart search.** A user holding `feature:ai` can steer the generated WHERE clause (prompt injection) into sub-selects on other tables, e.g. a yes/no probe of `Employee.hourlyWage`. `lib/sqlGuard.js` blocks credential columns and `stripSecretColumns` cleans rows, but non-credential HR columns are not blocked. Also: `pageContext: 'employees'` has no schema in `SCHEMA_MAP` and silently falls back to the **Customer** table (pre-existing bug, the legacy employees AI search shows customers). If the new employees screen should really search employees, add an `employees` context that (a) requires head management in addition to `feature:ai`, (b) uses an explicit safe column list. Not done here because it changes behaviour.
* **R5 - `agent-login`** compares the secret with `!==` and takes it from the query string (logged by hosting). It is 404 without `AGENT_LOGIN_SECRET`; rotate the secret if it ever appears in a log. Optionally switch to `crypto.timingSafeEqual`.
* **R6 - roles.** `ROLE_LEVELS['מנהל']` = [1,2] excludes head management (roleId 0) - `trusted-device` and a few settings routes lock roleId 0 out (functional, not a leak). `PUT /api/employees/[id]` treats an omitted `isActive` as `true` and an omitted `roleId` as an error, so partial bodies are not safe; the screens always send the full object.
* **R7 - page-level `isActive`.** `app/layout.js` treats any verified cookie as logged in for the shell; a deactivated employee sees an empty shell (no data: every API now refuses them) until the cookie expires.
* **R8 - `GET /api/history`** (page-visit log) is readable by any signed-in employee (already documented in `docs/security-visit-log-credentials.md`); out of this port's scope.
* **R9 - audit scope.** Other entity types (`AIChatSession`, `QueryLog`, `EmailLog`, `ErrorReport*`) are still readable through `/api/audit` by any signed-in employee; no ported screen needs them.

## 5. Documentation points

* Add to CLAUDE.md "Permissions system": a new screen must reuse the existing layouts/APIs; any **new** API or print path needs its own server gate (`checkAuth(role)`, `getAttendanceViewer`, `printAccess` key) - the page variant switch never grants data access.
* `checkAuth()` now refuses deactivated employees (30 s cache). After deactivating an employee through a path other than the employee card, call `invalidateInactiveEmployeeCache()` (exported from `lib/auth.js`) if instant effect matters.
* Test data: `SECAUDIT` employees / dress models were created only in the TEST database and deleted; the throwaway scripts live in the gitignored `scratch/sec-audit/`.

## 6. Final re-audit 2026-10-11 (admin lists, designed print sheets, statistics, registry)

Method: full read of the final diff (`git diff origin/main --stat`, 30 tracked files + new files), then the live matrix again on the restarted dev server
(`/api/dev/switch-env` confirms mode **test**), minted sessions for anonymous, deactivated secretary, deactivated head management, secretary (4),
branch manager (1), head (0), programmer (2). Re-run: `node scripts/test_a5_staff_models_security.mjs` (61 checks, includes the new routes) and
`node scripts/test_a5_orders_customers_lists.mjs`.

### 6.1 New routes and pages

| Route / page | anon | ded. sec | ded. head | sec / seamstress / branch manager | head | programmer | Data / notes |
|---|---|---|---|---|---|---|---|
| `GET/POST /api/admin/orders-list` | 401 | 401 | 401 | 401 | 200 | 200 | customer name + phone, items (name/size), totals, paid, debt/credit, branch. No hashes, no ID numbers, no bank data. |
| `GET/POST /api/admin/orders-list/counts` | 401 | 401 | 401 | 401 | 200 | 200 | numbers only |
| `GET/POST /api/admin/customers-list` | 401 | 401 | 401 | 401 | 200 | 200 | name, phone, email, address, debt, order counts, blocked reason, regulations flag; `zeout` only as yes/no (`hasId`); no bank, no notes. |
| `GET/POST /api/admin/customers-list/counts` | 401 | 401 | 401 | 401 | 200 | 200 | numbers only |
| `/admin/orders-list`, `/admin/customers-list` (pages) | login | no-access | no-access (15-minute fresh-token window, R7) | no-access | page | page | gate = `app/admin/layout.js`; catalog keys `page:admin_orders_list` / `page:admin_customers_list` are default-closed to everybody except roles 0 and 2 and `notConfigurable` (no permission row can open them). |
| `POST /api/pdf` with `surface` (employees list, models list, model card, orders list, customers list) | 401 | 401 | 401 | 403 | 200 | 200 | per-surface page key (`lib/printAccessKeys.js`): employees -> `page:employees`, models/card -> `page:dresses_catalog`, orders/customers lists -> `page:admin_*_list`. |
| `GET /api/employees/presence` | 401 | 401 | 401 | 403 | 200 | 200 | `getAttendanceViewer().isManager`, fails closed. |
| `GET /api/dresses?...&counts=1` | 401 | 401 | 200 | 200 | 200 | 200 | counts only, same `checkAuth()` as before. |
| `StatisticsModal` | - | - | - | - | - | - | conversion only: calls the existing `/api/ai/statistics` and `/api/ai/sessions` (both `checkAuth()` + `checkAiAccess()`; secretary without `feature:ai` = 403). No new data path. |

### 6.2 Injection / abuse (programmer session, TEST DB)

* Sort keys, filter keys, dates and `ids` are whitelisted/clamped by `parseOrdersListParams` / `parseCustomersListParams`; SQL text is only fixed constants (`ORDER_SNAPSHOT_SQL`, `CUSTOMER_FACTS_SQL`, no placeholders from users; page rows are fetched with Prisma `in: [ids]`). Probes with `; DROP TABLE`, quotes, `OR 1=1`, sub-selects in `sort`/`dir`/`states`/`branches`/`ids`/`search`/`from`/`to`, `__proto__`/`constructor` JSON, array bodies, a 100,000-character search: all answered **200 with ordinary data or empty results**, never a SQL error and no echo.
* Limits: `limit` is capped (100 per page; `export:true` 500), `page` capped, `search` cut to 200 characters. `lib/adminListGuards.js` adds a statement timeout, a request deadline and a concurrency limiter (4) - that layer was still being wired into the routes at audit time (the routes still map every failure to a generic 500, which is safe but gives the user no "narrow the filter" message).
* During the first pass the endpoints returned **500 under load** (Postgres `53200 out of memory` on the small TEST Neon compute: ~25 parallel `count()` queries per counts call and `IN (thousands of ids)` lists). Those were DB resource exhaustion, not input handling; the snapshot-in-memory design that replaced them answers the same probes without errors. Residual: R10.

### 6.3 Server-side HTML -> PDF (`/api/pdf`, `html` + `surface`)

Tested with a hostile document (head session, surface `a5-employees-list`) containing `<link>`, `@import`, CSS `url()`, `@font-face`, `<meta refresh>`, inline and external `<script>`, `fetch()` and `new Image()` in script, `<img>` to `127.0.0.1`, `169.254.169.254`, `file:///C:/Windows/win.ini` and this app's own `/api/employees`, `<iframe>` (http, `file:`, `srcdoc`), `<object>`, `<embed>`, `<video>`, `<audio>`, `<form>`, and a look-alike host `fonts.gstatic.com.evil.test`: a local listener on 127.0.0.1 recorded **0 requests**, the PDF was produced (200). Reasons (`lib/pdf.js`): JavaScript is disabled, request interception aborts everything except `data:`, `about:` and `https://fonts.googleapis.com|fonts.gstatic.com` (no port), unit-tested on the real function with 15 URLs.
Other checks: unknown / `__proto__` / `constructor` / array `surface` = 400 (own-property lookup); `surface` with `path` = 400; empty surface falls to the default order gate (403 for a secretary); 4 MB html = 413; non-string html = 400; every surface is 401 anonymous / 401 deactivated / 403 secretary and branch manager / 200 head and programmer.
Header injection: CR/LF, quotes, NUL, `../`, a `filename*=` smuggle and Hebrew names all produce a clean `Content-Disposition` (ASCII fallback + RFC 5987 `filename*`). **Fixed (F8):** a 5,000-character or non-string `filename` is now cut to 120 characters / coerced with `String()` (`app/api/pdf/route.js`).
The client-built sheets escape every dynamic text with `escH` before `innerHTML` (title, sub, chip, cells, notes, labels); asserted in the test.
DoS: a 1.7 MB table needs more than the 30 s render timeout and ends in a 500 - one Chromium page per request, shared browser, no per-user rate limit (R10).

### 6.4 Findings and fixes added in the final pass

| # | Severity | Finding | Fix |
|---|---|---|---|
| F7 | Low | `PUT /api/dresses/[id]` parsed the body outside any try/catch: malformed JSON, `null` or an array gave a 500 (and an array body was treated as "empty"). | `app/api/dresses/[id]/route.js`: 400 for invalid / non-object bodies; gates unchanged. |
| F8 | Low | `/api/pdf` `filename` had no length limit and `.replace` on a non-string threw **after** the full Chromium render. | `app/api/pdf/route.js` (see 6.3). |
| - | OK | F1-F6 of the first pass re-verified live and intact: upload/attachment (html/svg/xhtml served as octet-stream attachment, nosniff, `%00` id = 404), `/api/employees?all=true` (secretary 9 keys, head 32), `/api/audit?entityType=Shift` (secretary 403), deactivated users 401 on `/api/dresses`, `next-code` anonymous 401, `switch-env` URLs only for the programmer. | - |

### 6.5 Status of the open decisions

* **D1 (dress items open to all signed-in staff): unchanged, still an owner decision.** Not changed because both UIs rely on it; model create/delete/edit stay head-management only (re-verified).
* **R1 (open mode): unchanged, owner/ops decision.** Keep `require_login=true` on both production organisations; with it off `checkAuth()` passes anonymous visitors (role gates stay closed). Not verifiable here (no PROD access).
* **R4 (AI smart search on employees): unchanged, owner decision.** The new employees list still posts `pageContext: 'employees'`, which `smart-search` answers from the Customer table (pre-existing bug, same as the legacy page). A real employees search needs a new context that is head-management-only with an explicit column list. Not done because it changes behaviour.
* **R10 (new, availability):** heavy but authorised work has no per-user throttle - `/api/pdf` (one Chromium page per request, 30 s render timeout, html up to 3 MB) and the admin list/counts endpoints (the in-memory snapshot + concurrency limiter in `lib/adminListGuards.js` mitigate this once wired into the routes). Both need a signed-in user holding the relevant page permission. Recommend a small per-user rate limit if the owner wants it.
* **R11 (new, process):** the admin list server layer (`lib/adminOrdersListServer.js`, `lib/adminCustomersListServer.js`, `lib/adminListDb.js`, `lib/adminListGuards.js`) was being rewritten while this audit ran. The security properties (gate before query, whitelisted params, constants-only SQL, no sensitive columns) hold in the version audited (files dated 2026-10-11 15:24-15:27); the test file `scripts/test_a5_staff_models_security.mjs` re-checks the structural part on every run, so re-run it after the last edit of those files.
Cost / abuse limits (same day, performance pass): list page size <= 100 (export pages 500, max 5,000 rows from the UI), offset <= 100,000 (400), per-statement `statement_timeout` 8 s (12 s for the cached snapshot) and a 20 s request deadline (503 "צמצמו את הסינון"), at most 4 heavy requests per instance at once (503 busy), search matching > 20,000 rows refused (503). A head-management account therefore cannot drive unbounded DB work through these endpoints. Details: `orders-list-notes.md`.
