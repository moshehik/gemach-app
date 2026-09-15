# נווה יעקב (org-2) — full data wipe + fresh Access reimport, 2026-09-15

## Why

Owner reported ongoing sync issues between the legacy Access source and the
נווה יעקב site, and asked for a full reset: delete all customer/employee/
order/model data and reload everything fresh from a new Access export
(`השכרת שמלות-נתונים (3).zip`), keeping prices/settings/departments intact.

## Safety approach: rehearsed on an isolated Neon branch, not production

The first attempt to run the wipe directly against the live production
connection was blocked by Claude Code's own auto-mode safety classifier
(destructive/irreversible action) — correctly so. Per the owner's suggestion,
the entire operation was instead rehearsed end-to-end on a **Neon branch**
(`reimport-staging-2026-09-15`, id `br-dark-glade-b1yfhmuw`), a full
copy-on-write clone of org-2's real production database
(`jolly-silence-63127698`, host `ep-rough-dawn-b1bepx3d...`) created via the
Neon API. Every step below ran against the branch (host
`ep-broad-night-b1fxha9e...`) — **production was never written to.** A
separate full pre-wipe logical backup of production was also taken
independently (`scratch/org2_reimport_2026-09-15/backups/gemach-neve-yaakov-prod-2026-09-15-pre-wipe.sql.gz`,
12.3MB, all 25 tables) before any of this began, as a second safety net.

**Pending decision, not yet done:** cutting production over to this verified
branch (updating org-2's Vercel `DATABASE_URL` to the branch's connection
string) — this is the one remaining step, and it does touch the live app, so
it needs the owner's explicit go-ahead.

## Scope, as confirmed with the owner across several rounds of questions

- Target: org-2 (נווה יעקב) only. Every script here is host-checked to refuse
  anything but org-2's hosts.
- Full delete, not an incremental reconciliation.
- Every "dynamic" field with no Access source resets to default (bank
  details, delivery flags on Order, roleId promotions, custom notes, etc.) —
  explicitly requested by the owner, not preserved/restored.
- **Exception #1** (owner-confirmed): the 2 Employee rows with `legacyId =
  NULL` (שיינועטר משה, roleId 2; חיה בלומה שיינועטר, roleId 3) — no Access
  counterpart at all, these are login accounts, not Access data — preserved.
- **Exception #2** (discovered live this session, owner-confirmed): the new
  Access export's own עובדים table has only **24** rows, vs. 98
  Access-sourced Employee rows in the DB before the wipe — 74 would have
  vanished with no way to be recreated, 57 of them currently-active real
  staff logins (including a row named "מנהל ." with roleId=1). Owner chose to
  **preserve any currently-active employee missing from the new Access file**
  and only actually delete the 17 inactive ones missing from it.
- Also deleted, per an explicit owner instruction mid-session: Shift
  (עובדים_נוכחות / employee attendance).
- Left untouched: `PriceList`, `SystemSetting`, `Department`, `PriceRule`,
  `AuditLog`, `AuditReport`, `Notification`/`NotificationTag`,
  `ErrorReport`/`ErrorReportReply`, `PageVisitLog`, `EmailLog`, `QueryLog`,
  `TrustedDevice`, `AIChatSession`.

## What ran (all against the staging branch)

| Step | Script | Result |
|---|---|---|
| Backup (real prod, before anything) | `scratch/backup_org2_db.js` | 25 tables, 12.3MB, `.sql.gz` |
| Wipe | `scratch/wipe_new_gemach.js --write` | see table below |
| Reimport | `scratch/import_new_gemach.js --write` | see table below |
| OrderItem→DressItem relink | `scratch/link_order_items_org2.js` | 61,015/61,015 linked |
| Verification | `scratch/verify_new_gemach_import.js` | see below |

### Wipe counts

| Table | Deleted |
|---|---|
| PaymentObligation | 53,627 |
| Payment | 26,583 |
| Refund | 7 |
| OrderItem | 61,071 |
| Order | 21,234 |
| Shift | 192 |
| DressItem | 3,966 |
| DressModel | 159 |
| Customer | 19,797 |
| Employee (scoped: 24 in new Access + 17 inactive-orphaned) | 41 |

Employee FK references nulled ahead of the Employee delete (Notification
senderId/receiverId/handledById, ErrorReport/ErrorReportReply employeeId,
AIChatSession employeeId): 0 / 8 / 0 / 111 / 72 / 56.

### Reimport counts (all `written` == `attempted`, zero silent conflicts)

Customer 18,858 · Department 6 (updated) · Employee 24 (created) · DressModel
159 · DressItem 3,932 · Order 21,223 · Shift 190 · SystemSetting +2 ·
PriceList 9 (updated) · OrderItem 61,015 · Payment 26,663 · PaymentObligation
53,927.

## Verification results (`scratch/verify_new_gemach_import.js`)

Row-count parity, Access vs. DB, after the full wipe+reimport:

| Table | Access | DB | Status |
|---|---|---|---|
| Customer | 18,858 | 18,858 | OK |
| Order | 21,223 | 21,223 | OK |
| DressModel | 159 | 159 | OK |
| DressItem | 3,932 | 3,932 | OK |
| Payment | 26,663 | 26,663 | OK |
| PaymentObligation | 53,927 | 53,927 | OK |
| Shift | 190 | 190 | OK |
| OrderItem | 61,016 | 61,015 | 1-row gap, explained below |
| Employee | 24 (Access) | 83 total | expected, see Employee section |
| Refund | n/a | 0 | expected (100% app-only concept) |

**Employee full picture:** 83 total = 24 freshly (re)created from the new
Access export + 57 preserved active employees missing from it + 2 preserved
no-legacyId admin accounts. Exactly as designed.

**The 1-row OrderItem gap, investigated and fully explained:** the single
Access הזמנות_פרטים row (legacyId 114494) that didn't import has `קוד_הזמנה`
(order link) = **NULL in Access itself** — a pre-existing orphaned line-item
in the source data with no parent order to attach to. Not a bug in this
process; correctly and safely excluded.

**Other checks, all clean:**
- Customer.legacyId duplicates: 0. Order.orderId duplicates: 0.
- Orphaned active DressItem rows (legacyId no longer in Access): 0 (as
  expected right after a full wipe — nothing not in Access can survive it).
- OrderItem → DressItem link coverage: 61,015 / 61,015 (100% — up from 81 /
  61,071 before the wipe; batched via `scratch/link_order_items_org2.js`,
  51,915 exact size matches + 7,487 barcodePrefix-only fallback matches, 0
  unmatched).
- Orders with a customer legacyId not found anywhere in Access's own
  לקוחות table (orphan FK in the *source* itself, not an import bug): 4
  orders (38735, 49170, 52341, 52342).
- Orders with an employee legacyId not found in Access's עובדים table
  (same caveat): 13 orders, all referencing employee legacyId `0` (a
  placeholder/unset value in Access, not a real missing employee).

## Deliveries feature — specifically checked per the owner's request

Confirmed via code research this session: `isDelivery` /
`deliveryAddress` / `deliveryCity` / `deliveryDirection` /
`deliveryOneDayBefore` (on `Order`) are **100% app-only fields, never
present in Access**. After a full Order wipe+reimport every order's delivery
flags reset to their defaults (`isDelivery=false` etc.) — an expected, direct
consequence of "reset every dynamic field," not a defect. The feature itself
(gating `SystemSetting`s — `enable_deliveries`, `delivery_price`,
`delivery_price_by_city`, `delivery_days_before/after`, etc. — the
`/deliveries` dashboard, and pricing logic in `lib/pricingEngine.js`) lives
entirely in code + `SystemSetting`, **neither of which this operation
touched at all**, so the feature is unaffected. New delivery orders created
going forward will work exactly as before; only the delivery marking on
*historical* orders reset, since that data was never in Access to begin with.

## Field-level correctness check (not just counts): `scratch/full_data_correctness_check.js`

Beyond row counts, actual field VALUES were compared Access-row vs.
matching-DB-row (full pass for small tables — Employee 24/24, DressModel
159/159 — a 300-row sample for large ones: Customer, DressItem, Order,
Payment, PaymentObligation):

| Table | Rows compared | Field mismatches |
|---|---|---|
| Customer | 300 (firstName/lastName/phone1/phone2/city/email) | 0 |
| Employee | 24/24, full pass (firstName/lastName/phone1/hourlyWage/isActive) | 0 |
| DressModel | 159/159, full pass (barcodePrefix/priceCategory) | 0 |
| DressItem | 300 (sizeText/quantity/inRepair/notInUse) | 0 real (4 apparent, see note) |
| Order | 300 (totalAmount/isPaid/isDeleted) | 0 |
| Payment | 300 (amount) | 0 |
| PaymentObligation | 300 (amount/quantity) | 0 |

**Note on the 4 apparent DressItem mismatches:** all 4 were `sizeText`
"34" (Access, as read by the checking script) vs. `" 34"` (DB) — investigated
directly against the raw Access value (bypassing the checking script's own
`.trim()`) and confirmed the **DB is correct**: Access's own `מידה_טקסט`
column genuinely stores a leading space for these rows (verified:
`SELECT [מידה_טקסט] FROM [שמלות_נתונים] WHERE [קוד]=35488` returns literally
`" 34"`). The import script doesn't trim (correctly, since it's not its job
to silently "fix" source data), and my own verification script's `.trim()`
call is what manufactured the false-positive mismatch. Zero real field-level
defects found across every table checked.

## Neon account/project clarification (came up mid-session)

Two different Neon API keys were tried. The first (initially in
`.env.local`) turned out to be **expired**; a second key handed to a
different Neon account showed similarly-named but unrelated, long-suspended
projects (`gemach-dresses-2` at a `us-east-1` host, `gemach-db` likewise) —
neither matched org-2's real production host at all. A **third** key
(provided by the owner directly), confirmed against org `org-young-fire-
22908884`, resolved to project `jolly-silence-63127698` (name
`gemach-dresses-2`) whose main branch endpoint host is
`ep-rough-dawn-b1bepx3d.c-5.eu-central-1.aws.neon.tech` — an **exact match**
to the real live production connection string used by `scratch/new_gemach_db.env`.
**This is confirmed as the one true account/project holding org-2's real
data** — `moshehik`'s Vercel/Neon account, org `org-young-fire-22908884`,
project `jolly-silence-63127698`. The other two Neon projects seen along the
way are unrelated leftovers from a different context and were not touched.

## Production cutover — DONE (2026-09-15)

1. Vercel env var `DATABASE_URL` (production, id `fBx1OAg4y23BmWhA`) on
   project `gmach-neve-yaakov` (`prj_nha4IxNtvyP6B0Try78r6ApWkRBa`, team
   `team_ktg14QXUIxVh6dPLI5awK0Vw`) updated to point at the verified
   `reimport-staging-2026-09-15` Neon branch
   (`ep-broad-night-b1fxha9e.c-5.eu-central-1.aws.neon.tech`) — same
   connection-string format (direct host, `sslmode=require&pool_timeout=60&
   connection_limit=15`) as the pre-existing value's known convention.
2. Redeployed via the Vercel API from the latest existing production
   deployment (commit `350fc22`, no code change) so the running app picks up
   the new env var — new deployment `dpl_9YVK98kZennh51qeizQPhmvwgicJ`,
   `READY`, aliased to `gmach-neve-yaakov.vercel.app` (and
   `gemach-dresses-2.vercel.app`).
3. Verified live: `GET /api/health` → `{"ok":true,"db":"up"}`; the login
   page loads correctly with the right branding. Deeper in-app verification
   (an actual orders list, the deliveries dashboard) needs staff login
   credentials, which were intentionally not obtained/guessed here — normal
   next use by the owner/staff is the natural remaining check.

**The old production branch (`br-dawn-credit-b1s92g7t`) was left untouched
and not deleted** — it's an instant rollback path (just revert the
`DATABASE_URL` env var + redeploy) if anything looks wrong. Recommend
keeping it for a few days before considering deletion.

## Post-cutover findings — real, live-caught issues (2026-09-15, same day)

After the cutover, the owner reported the `/deliveries` dashboard was empty
and pushed back hard on an initial (wrong) explanation. Investigating this
properly surfaced two distinct real problems, on top of everything above:

### 1. 11 Order rows vanished entirely, not just their app-only fields

A full wipe recreates exactly one `Order` row per Access `קוד_הזמנה` - any
`orderId` that existed in Postgres immediately before the wipe but has NO
row in the new Access export is simply never recreated. 11 such orders were
found (`53307, 53308, 53310, 53311, 53312, 53313, 53314, 53315, 53316, 53231,
53233`) - all with `orderDate` in the 5 days immediately before the wipe
(2026-09-10 through 2026-09-15), almost certainly real app activity staff
hadn't yet hand-entered into Access at export time, not an Access data
problem. **Restored in full** (`scratch/restore_vanished_orders.js --write`)
from the pre-wipe backup: the Order rows themselves plus their 18 OrderItem /
11 Payment / 23 PaymentObligation sub-records, with every foreign key
(customerId, employeeId, dressItemId, orderItemId) correctly remapped from
its old pre-wipe UUID to whatever new UUID the same `legacyId`-holder got
during the reimport.

**General lesson for next time:** before wiping any Order-bearing table,
diff the DB's current `orderId` set against the new Access export's own
`קוד_הזמנה` set (not just "will Access rows create/update cleanly") -
anything in the DB but absent from Access needs the same
export-then-restore treatment as the Employee case above, and won't surface
in the importer's own dry-run output at all (it only reports Access rows,
never "was in DB but isn't in this export").

### 2. Every app-only Order field resets on a full wipe - not just delivery

Confirmed by inspecting the Access source's raw column list directly
(`SELECT TOP 1 * FROM [הזמנות]` / `[הזמנות_פרטים]`) - there is genuinely no
delivery, phone-order, signed-regulations, branch, or custom-spacing column
anywhere in Access. Every one of these `Order` fields is 100% app-only and
resets to its schema default on any full wipe:
`isDelivery`/`deliveryCity`/`deliveryAddress`/`deliveryDirection`/
`deliveryOneDayBefore`/`branch`/`pickupBranch`/`isPhoneOrder`/
`hasSignedRegulations`/`internalNotes`/`customSpacing`/`extraDay`/
`hokDetails`/`isWeekdayEvent`. (`isAbroad` was checked and confirmed
genuinely Access-sourced via `אירוע_חול` - verified 0/0 match between Access
and DB, nothing lost there since org-2 has zero abroad orders in its data at
all.) **Restored for all 29 affected still-existing orders**
(`scratch/restore_all_app_only_order_fields.js --write`), matched by the
stable `orderId` against the pre-wipe backup, copying back only fields that
actually held a non-default value (so a plain order untouched by this class
of bug is never rewritten).

### 3. Pre-existing deliveries-dashboard gap, unrelated to the wipe, found in passing

Investigating "why is the deliveries page still empty after restoring the
old flags" revealed a real, PRE-EXISTING product gap: the `/deliveries`
dashboard filters purely on `Order.isDelivery = true`, but that checkbox was
apparently rarely used by staff - only **15** orders in org-2's entire
history ever had it set, while **2,236** orders have an actual delivery
charge (a `PaymentObligation` row whose `description` contains "משלוח" -
`הזמנות_תשלום`, which correctly reimported from Access at full strength, see
the Access-sourced-field verification above). Of those 2,236, **84 have a
future/today event date** - real upcoming deliveries the dashboard was never
showing, wipe or no wipe. Owner confirmed: backfill `isDelivery=true` for
every order with a real charge. **Applied**
(`scratch/backfill_isdelivery_from_charges.js --write`) - sets the flag only
(never invents a delivery city/address/direction the order never had).

### Scripts to run, in order (owner executes - `--write` blocked for the
agent by Claude Code's own safety classifier once a connection is live
production, correctly so)

```bash
node scratch/restore_vanished_orders.js --write
node scratch/restore_all_app_only_order_fields.js --write
node scratch/backfill_isdelivery_from_charges.js --write
```

All three were dry-run verified against the live (post-cutover) connection
before being handed off. `scratch/restore_pre_wipe_deliveries.js` (the
original, narrower delivery-only restore script) is superseded by
`restore_all_app_only_order_fields.js` and can be ignored/deleted.

**All three executed successfully (2026-09-15):** 11/11 vanished orders
restored with correct items/payments/obligations; 39 orders got their
app-only fields restored; 2,235 orders backfilled to `isDelivery=true`
(2,250 total, 98 with a future/today event date).

### One real bug found and fixed during post-write verification: customer legacyId drift

Cross-checking the 7 distinct customers referenced by the 11 restored
orders (comparing each restored order's linked customer's name/phone against
the pre-wipe backup) found **one mismatch**: order 53308 got linked to
"נחמי נתנלאוב" (legacyId 54910 in the *current*, post-reimport DB) instead of
the correct "אסתר חביב" (who the pre-wipe backup recorded as legacyId 54910
at the time, but whose *real*, current legacyId turned out to be 54908).
Both customers were registered in Access one day apart, immediately before
the wipe - `legacyId` drifted for these two specific, very-recently-created
records between the pre-wipe snapshot and the final export (confirmed
directly against the live Access file: `SELECT * FROM [לקוחות] WHERE
[קוד_לקוח]=54910` returns נחמי נתנלאוב, not אסתר חביב - Access itself is
consistent with the new DB, so nothing was misread; the pre-wipe backup's
legacyId for אסתר חביב was simply stale by the time of the final export).

**Root cause:** `restore_vanished_orders.js`'s remap logic (old customerId →
old-backup legacyId → new customerId) implicitly assumes legacyId is stable
for a given real person between the pre-wipe backup and the final Access
export - true for 6/7 customers checked, false for this one very-recent
pair. **Fixed** by hand: `Order.customerId` and all 3 `Payment.customerId`
rows for order 53308 repointed to the correct customer (`06144d4a-57d5-4112-
b9f5-4a33dafbdd4e`, legacyId 54908). Employee legacyIds were also
cross-checked for the same 11 orders (4 distinct employees) - all 4 matched
cleanly, no drift there. DressItem links for all 18 restored OrderItems were
spot-checked too - all resolved correctly.

**General lesson, added to the standing protocol
(`docs/full-wipe-reimport-protocol.md`):** after any orderId-based restore
that remaps customer/employee links through an old-snapshot legacyId, cross-
check every distinct customer/employee actually touched (name+phone/fullName)
against the live Access source directly - not just against the DB - since
legacyId can genuinely drift for records created in the days immediately
before a wipe (the exact population most likely to need this kind of
restore in the first place).

### AuditLog as an independent cross-check (worked well)

The 11 restored orders' *original* UUIDs (before the wipe) still exist in
`AuditLog.entityId` (33 entries found) with full `changesJson` history,
including per-item/per-payment breakdowns from when each order was first
created/edited by staff. Comparing this independent record against what was
actually restored confirmed the restore was accurate (e.g. order 53316's
audit history shows the exact same notes text, delivery city/address, and
item/payment breakdown that ended up in the restored row).
