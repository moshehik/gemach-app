# System Changes Log

## 2026-09-20: Live test of the courier email (Neve Yaakov real data) - one bug found + fixed

- **Test:** a local server (current main) on Neve Yaakov's real DB and the real mail bridge sent the courier email (`POST /api/deliveries/courier-email`, both directions, events 4-5.10) to Moshe's own mailbox, read back in Gmail. `courier_email` was set temporarily and deleted right after (Neve Yaakov has NO `courier_email` configured - the "send to courier" button on the live site returns 400 until it is set in admin settings). Both emails were logged in `EmailLog` (status success).
- **Bug found and fixed (PR #105):** `groupDeliveryRowsForCourier` grouped by the UTC date slice of `eventDate`; imported orders carry different hours for the same event day (21:00Z vs 00:00Z), so one event day appeared as two groups with the same title (5 groups instead of 4). Now grouped by Israel calendar day (`lib/deliveryCourier.js`). Verified: 5 -> 4 groups on the real data, second email arrived as "4 groups".
- **Observation (not changed):** with `delivery_days_before=2` an event on Monday gets its outbound dispatch on **Shabbat** ("משלוח יוצא שבת" in the email). Business decision for the owner (skip Shabbat / shift to Friday?).

## 2026-09-20: Neve Yaakov email complaint (2026-09-17/18, Ahuvi Pinkel / Rivka Levi) - 5 items verified, 4 fixed

Full detail per item in `docs/email-fixes-2026-09-20/` (README.md = summary + verification matrix).

- **#1 (critical) wrong-dress barcode accepted at rental:** real case order #52103 (ordered 557 size 06, rented with barcode 5470606 = model 547). Root cause: the manual-barcode modal of the order card -> `/api/rentals/toggle` never compared the barcode with the ordered model/size. Now the server checks it (`lib/rentalBarcodeMatch.js`, `lib/rentalBarcodeGuard.js`), returns 409 `barcodeMismatch`, and a manager (roleId 1/2) can override with a password (managers get a notification). Also enforced on order save (`PUT /api/orders/[id]`, 400) and on the manual-typed path of `/api/rentals/scan`. **Switch `enforce_rental_barcode_match` (default false = old behaviour); ON in Neve Yaakov only.**
- **#2 model+size search in advanced order search:** already fixed before this round (PR #95, new "size" field); verified again, nothing changed.
- **#3 deliveries by event date:** with `deliveries_select_by_event_date` ON, picking date D on the deliveries screen / courier print / courier email / bag page lists orders whose EVENT is on D (Israel day) instead of the outbound/return window (D+daysBefore / D-daysAfter); each row still shows the computed dispatch/pickup days (`dispatchDates`). Bag page (`/print/delivery-bag`) additionally prints the event date, a hand-fill "bag ___ of ___" line and the order notes (`Order.notes`) - no switch, pure addition. **Switch default false; ON in Neve Yaakov only.**
- **#4 "page X of Y" on the order print:** CSS `@page { @bottom-center }` counters in `app/print/order/page.js`, verified in a real PDF (`/api/pdf`). Batch print counts across the whole document. No switch.
- **#5 (critical) item edit "button does not work":** after the 15-minute full-edit window the only unlock button ("פתיחת עריכה מלאה (אישור מנהל)") lived inside the alterations column, which is hidden when `enable_alterations=false` (Neve Yaakov). It now lives in the model/size cell. **Not implemented:** "model replacement updates a partial payment of 50%" - business rule undefined, see the interpretation table in `docs/email-fixes-2026-09-20/02-edit-unlock-and-print-page-numbers.md`.
- **DB:** both settings rows created in both PROD DBs by a host-checked script (org1 = false/false, Neve Yaakov = true/true); no schema change. An earlier agent run also created `deliveries_select_by_event_date=false` in org1 PROD by accident (same value the seed would create).
- **Verified:** merged branch run against the TEST DB (API + real browser + real PDF), all TEST data restored.

## 2026-09-20 (second pass): permission pages are now connected

- `page:*` items of `/admin/permissions` are enforced: refunds, dress catalog, monthly board, orders, new order, rentals & returns, customers, deliveries, alterations, internal messages. A permissions row (department or specific employee) now really opens or closes the page — by URL and in the sidebar. New server helpers `canOpenPage` / `resolvePageAccess` (lib/permissions.js), `PageGate` component, new `layout.js` files for each page tree.
- No row = today's behaviour (refunds / dress catalog / board defaults follow the org's `restrict_*` settings). One deliberate tightening: the monthly board is now closed by URL as well when `restrict_board_to_managers` is on (it was only hidden from the sidebar); head management now sees it.
- Admin / employees / employees report / price list / dashboard / home / kiosk / punch clock are marked `notConfigurable` and no longer offered in the wizard (head-management-only data or no login).
- Bug fixed: employee lookups matched a UUID that starts with digits against another employee's numeric legacyId (login could say "wrong password" for such an employee); legacyId is now used only for digits-only input.
- Wizard defaults ("מותר כיום") use the organisation's real settings (`orgSettings` from `GET /api/admin/permissions`).

## 2026-09-20: Live permissions verification + security hardening

- **What was done:** end-to-end test of the permissions system on the LIVE sites (both gemachs) with temporary sample employees at every level (programmer / head management / branch manager / seamstress / secretary / two employees of a temporary department roleId 90), driven through the real login + API + SSR pages. The sample employees, the temporary department and every test permission row were removed afterwards. Full matrix, findings and the open items: `docs/permissions-security-audit-2026-09-20.md`.
- **Critical fixes:** forgeable `auth_token` cookie (anyone could become any employee, incl. programmer, by pasting a UUID from the public employee list) → signed-session verification everywhere (`getVerifiedAuthCookie`); branch manager could promote anyone/self to programmer or create programmer accounts → head-management-only employee APIs + role-rank ladder; password hashes (and legacy plaintext passwords) leaked by three order/attendance endpoints (one unauthenticated) → `SAFE_EMPLOYEE_SELECT`; `feature:ai` enforced only in the UI → enforced in every `/api/ai/*` route (+ SQL guard, signed smart-search clause, `/api/ai/report` no longer anonymous).
- **Behaviour changes worth knowing:** everybody logs in once more after the deploy; `feature:ai` no longer depends on the `enable_ai_specific_employees` setting; a permissions row can now revoke `feature:debt_approval` from branch managers; anonymous `GET /api/employees` returns names only; `verify-pin` needs a session; head management can open /refunds when the restriction setting is off.

## 2026-09-20: /admin/permissions redesign shipped; DB schema applied to both gemachs

- **Code:** new permissions page, linked from `/admin/site-settings` (developer sidebar). One unified, initially empty table of rows (pages and features mixed); a 5-step wizard (name -> pages/features -> departments -> specific employees -> confirmation); every item has an info icon with an explanation and pages are links opening in a new tab; each row stores its own access; a page may be in several rows (highlighted; effective access = union, lenient); rows can be deleted for real (items revert to catalog defaults); specific employees shown as tags. Page items stay documentation-only (`enforced: false`). No seed script. Details: `CLAUDE.md` -> "Permissions system".
- **Plain-language pass:** catalog labels lost their `(/route)` suffixes, every item got a plain-Hebrew `userNote` (shown in the info popover instead of the developer `note`), page links lost their underline, and the blank-iframe preview eye was removed.
- **הנהלה ראשית / מתכנת** have no column or toggle: both are always allowed every boolean permission (`ALWAYS_ALLOWED_ROLE_IDS`). Consequence: head management now also passes `feature:debt_approval` (its catalog default used to exclude roleId 0).
- **DB (applied by hand to both, additive only):**
  1. org1 `misty-darkness-06917297` (`ep-weathered-tree-avpypjjr`) and org2 `gemach-dresses-2` (`ep-broad-night-b1fxha9e`): `PermissionPageGroup` gained `catalogGroup` (now deprecated/unused), `access`, `employeeIds` (all NOT NULL with defaults).
  2. All existing `PermissionPageGroup` rows deleted on both (18 each) for a clean start; `DepartmentPermission` / `EmployeePermissionOverride` were already empty.
  3. org2 only: also added the missing `DressModel.thumbnailUrl` column and `Attachment` table (drift from the earlier "remove Vercel Blob" push).
- **Verified:** `prisma migrate diff --from-url <db> --to-schema-datamodel prisma/schema.prisma` returned an empty migration for both DBs (re-checked against the final schema after all changes). The wizard was exercised in a browser (validation, all 5 steps, info popover, shared-page highlight, edit mode with delete button).

## 2026-09-08: DB Connection & Missing Schema Fix

- **Issue:** The production application was failing to load orders with a `500` error (`P2022: The column Order.extraDay does not exist in the current database`). Also, it was returning only 65 settings instead of 121, indicating it was connected to an older branch of the Neon DB.
- **Cause:** Vercel's `DATABASE_URL` env var was manually overwritten on August 26, pointing to a preview branch that lacked the newest seeded settings. When updated to point back to the correct branch (`ep-rough-dawn-b1bepx3d`), the app still failed because that correct branch had never received the Prisma schema push for the recently added `extraDay` column on the `Order` model.
- **Resolution:**
  1. Updated `DATABASE_URL` in Vercel to point to `ep-rough-dawn-b1bepx3d` for Production & Preview.
  2. Triggered a manual deployment on Vercel to load the new config.
  3. Ran `npx prisma db push` against the `ep-rough-dawn-b1bepx3d` DB to sync the Prisma schema and create the missing `extraDay` column.
- **Result:** API and order pages are functioning normally again, and all 121 settings are correctly loaded.

## 2026-09-20: Vercel/Neon resource-waste fixes

- **Issue:** Audit (see `docs/vercel-resource-audit-2026-09-20.md`) found waste in function invocations, Neon egress and deployments; org1's functions ran in `fra1` against a `us-east-1` Neon DB (~459ms per `SELECT 1` vs 2ms on org2).
- **Follow-up (same day):** disabled the local Windows task `GemachApp-ProdDbBackup` (duplicate full-DB dump against Neon's 5GB egress cap; cloud backup covers both orgs), deleted the orphan Upstash Redis store, fixed stale Neon host references (`seed_phase1_settings.js`, `docs/fix-protocol-error-reports.md`), removed `test-db.js`. See BACKUPS.md "Local backup task disabled".
- **Changes:** per-project function regions (removed `regions` from `vercel.json`; org1 `iad1`, org2 `fra1` set on the Vercel projects), batched `/api/log-visit`, light notification-bell polling (`/api/notifications?light=1`, 120s), error-report badge polling 30s -> 120s, removed the daily `/api/health` cron, `ignoreCommand` (`scripts/vercel-ignore-build.sh`) to skip docs-only / other-org preview builds (`[force-deploy]` overrides), `concurrency` on `claude-fix-reports.yml`.
