# Permissions system — live verification & security audit (2026-09-20)

Scope: the `/admin/permissions` system (department / specific-employee rows, the four enforced
`feature:*` items, the documented-only `page:*` items) **plus the authentication layer it stands on**.
Method: throw-away sample employees at every level were created directly in each gemach's database,
logged in through the real `POST /api/login`, and every check below was an HTTP request made as that
user (API status codes and server-rendered pages) — first against the deployed code, then again after
the fixes. Nothing was tested by reading code alone.

## Sample users (all temporary, all deleted afterwards)

| Name | roleId | Meaning |
|---|---|---|
| dev | 2 | מתכנת |
| head | 0 | הנהלה ראשית |
| mgr | 1 | מנהל סניף |
| seam | 3 | תופרת |
| sec | 4 | מזכירה (regular staff) |
| d90a, d90b | 90 | a **temporary department** created just for the test, so permission rows could be created/edited/deleted without ever changing a real department's access |

## What was found on the live code (before the fixes)

| # | Finding | Severity | Live result |
|---|---|---|---|
| 1 | `auth_token` cookie = raw employee UUID, never verified. Anyone can set it by hand; UUIDs were served to everybody by the public `GET /api/employees` | **Critical** | forged cookie of the programmer → `GET /api/admin/permissions` **200** (no password) |
| 2 | `PUT/POST /api/employees` gated by default `checkPageAccess()` (= branch managers, excluding head management) | **Critical** | branch manager set a sample employee's roleId to 2 (**200**); head management got 403 |
| 3 | Password hashes / legacy PLAINTEXT passwords in `GET /api/orders/[id]/employees` (no auth at all), `GET/PUT /api/orders/[id]`, `GET /api/employees/attendance`; hashes also stored in Employee audit rows readable by every logged-in user | **Critical** | confirmed by code + response shape |
| 4 | `feature:ai` enforced only by hiding the widget; AI routes (an LLM writing SQL over the whole DB) open to every logged-in employee; `/api/ai/report` open to the internet; smart-search executed a client-supplied SQL where-clause on page 2 | **High** | secretary / seamstress / manager / test department → `POST /api/ai` **400** (= passed the gate) instead of 403 |
| 5 | `/api/auth/verify-pin` anonymous: tries a typed password against every active employee and returns the matching employee id | High | code |
| 6 | `feature:debt_approval`: a permissions row revoking roleId 1 was ignored by `verify-pin` (bypass `!isManager`) but honoured by `/api/employees`; the routes that record the approver trusted any id sent by the client | Medium | code |
| 7 | `/refunds` denied head management (roleId 0) when `restrict_refunds_to_head_management` is off (org 1 has it off) | Medium | head → denied on org 1 |
| 8 | Wizard trap: a `feature:ai` grant did nothing while the old `enable_ai_specific_employees` setting was off (it is off on both gemachs) | Medium | code |
| 9 | Catalog said `page:employees_report` is open to every employee; it is actually head-management-only (nested under the employees layout) | Low (documentation) | secretary denied |

## What was fixed

See CLAUDE.md → "Permissions system" → "Live verification + security hardening" and CHANGELOG.md
(2026-09-20). Short version: signed-session verification for every read of the auth cookie
(`getVerifiedAuthCookie`), head-management-only employee APIs + role-rank ladder
(`roleRank`/`canManageRoles`), `SAFE_EMPLOYEE_SELECT` for every employee join, audit masking,
`checkAiAccess()` in every AI route (+ SQL guard, signed smart-search token), `canApproveDebt()`,
`verify-pin` needs a session, refunds layout for roleId 0, catalog notes corrected.

## Deliberately NOT changed (owner decisions / follow-ups)

1. **[Resolved in a second pass the same day — see the last section.] `page:*` were still documentation only.** The real gates are each page's `layout.js`. Pages without
   a layout gate (home, orders, customers, rentals, board, deliveries, alterations, messages, …) are reachable by URL
   by any logged-in employee; `page:board` is only hidden from the sidebar. Migrating them to read the
   permissions table is a separate project (the catalog defaults already reproduce today's behaviour).
2. **Refund APIs stay open to every logged-in employee** (`/api/refunds`, `/api/refunds/[id]`): the order's
   payments tab creates and executes refunds for regular staff, so gating them would break a real workflow.
3. Other `checkAuth()`-only routes and mismatches found by the code audit (not exploitable by an
   anonymous visitor any more, because the cookie can no longer be forged, but still broader than the UI):
   `db-mode`, `database/export|upload`, `backups/settings`, `admin/query` and `settings` are `[0,2]`-gated
   although `/admin/site-settings` is developer-only; `upload-logo` / `upload` need only a login; unauthenticated
   reads such as `attachment/[id]`, `dresses/items/[itemId]/history`, `queries-by-path`, `orders/*/email`
   and `cancel-changes`; `forgot-password` has no rate limit; cron routes accept the secret in the query string.
4. `ROLE_LEVELS['מנהל']` and `verifyManagerPin` are `[1,2]` and exclude head management (roleId 0) although
   head management is senior — routes using them lock roleId 0 out (`trusted-device`, `settings/guide`, …).
5. A demoted employee keeps their old role for up to 15 minutes (`SESSION_FRESH_MS`).
6. `feature:export_max_rows` is advisory only: exports are generated in the browser from data the list APIs
   already returned in full, so there is nothing server-side to enforce.

## Results after the fixes

Deployed to main (both Vercel projects, commit 8ae589b) and re-run against the LIVE sites with fresh sample users:

| Suite | org 1 (main gemach) | org 2 (נווה יעקב) |
|---|---|---|
| Access matrix by level (auth forgery, admin APIs, feature defaults per level, AI gate, escalation, page gates) | 91 / 91 pass | 90 / 91 — the one difference is expected: org 2 has `restrict_refunds_to_head_management` on, so a branch manager is (correctly) denied /refunds |
| Row lifecycle (create / edit / same key in two rows = union / delete = back to defaults), employee overrides on the card, forged-approver checks, escalation, leaks, AI extras, verify-pin | 104 / 104 pass | 104 / 104 pass |
| AI positive path (head user gets a real answer; smart-search page 2 with the signed token works; a token issued for another page context is rejected; secretary blocked) | 6 / 6 pass | – |

(The same 104-check suite was first run against a local dev server on the new code: 104 / 104.)

Not exercised on live data on purpose: a *successful* debt-approval write (it would add an audit row to a real order),
and a *successful* error-report submission (it e-mails the programmers) — those were checked at the gate only
(400 = allowed through, 403 = blocked).

### Page-access matrix actually observed (documentation-only items vs. reality)

| Page | org 1 | org 2 |
|---|---|---|
| /admin, /employees, /employees/report, /dashboard/pricelist, /dashboard | programmer + head management only | same |
| /refunds | head + programmer + branch manager (setting off) | head + programmer only (setting on) |
| /dashboard/dresses | everyone (setting off) | head + programmer only (setting on) |
| /admin/site-settings | programmer only | programmer only (head management is denied) |
| /board, /, /orders, /orders/new, /rentals, /customers, /deliveries, /alterations, /messages | everyone logged in (no server gate; /board and the sidebar rules are UI only) | same |

Catalog corrections made from this matrix: `page:employees_report` and `page:dashboard` are head-management-only.

### Cleanup

All sample employees, the temporary department (roleId 90), every test permission row / department value / override and
the audit rows the sample users generated were deleted from both databases afterwards; employee counts are back to
95 (org 1) and 83 (org 2) and `PermissionPageGroup` / `DepartmentPermission` / `EmployeePermissionOverride` are empty again.

## Second pass: pages connected

The catalog's page items are now enforced (layout guards + sidebar), see CLAUDE.md → "Pages connected". Results of the
live sample-user run are appended below.
