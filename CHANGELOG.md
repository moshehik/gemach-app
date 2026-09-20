# System Changes Log

## 2026-09-20: /admin/permissions redesign shipped; DB schema applied to both gemachs

- **Code:** new permissions page, linked from `/admin/site-settings` (developer sidebar). One unified, initially empty table of rows (pages and features mixed); a 5-step wizard (name -> pages/features -> departments -> specific employees -> confirmation); every item has an info icon with an explanation and pages are links opening in a new tab; each row stores its own access; a page may be in several rows (highlighted; effective access = union, lenient); rows can be deleted for real (items revert to catalog defaults); specific employees shown as tags. Page items stay documentation-only (`enforced: false`). No seed script. Details: `CLAUDE.md` -> "Permissions system".
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
- **Changes:** per-project function regions (removed `regions` from `vercel.json`; org1 `iad1`, org2 `fra1` set on the Vercel projects), batched `/api/log-visit`, light notification-bell polling (`/api/notifications?light=1`, 120s), error-report badge polling 30s -> 120s, removed the daily `/api/health` cron, `ignoreCommand` (`scripts/vercel-ignore-build.sh`) to skip docs-only / other-org preview builds (`[force-deploy]` overrides), `concurrency` on `claude-fix-reports.yml`.
