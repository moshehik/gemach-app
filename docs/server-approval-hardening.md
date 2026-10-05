# Server approval hardening (branch `fix/server-approval-hardening-2026-10-05`)

Status: code complete, **both flags OFF by default** - nothing changes for workers until the owner flips a flag in a gemach.
Tests: `scripts/approval-hardening.test.mjs` (server), `scripts/order-card-tests/approval-tokens.client.test.mjs` (clients).

## 1. The problem (what a logged-in employee could do before)

| # | Finding | Impact |
|---|---|---|
| H1 | The server trusted a CLAIMED approver id: `debtApprovedBy` in `PUT /api/orders/[id]` and `employeeId` in `/api/orders/[id]/debt-approval` only had to belong to an employee holding `feature:debt_approval` - no proof the code was typed. Employee ids are readable (`/api/audit` raw rows, `meta.approverId`, the login/approver picker). | Any employee could write a `DEBT_APPROVED` row under a manager's name and drop an order from `/api/dashboard/debts`. |
| H2 | The manual-charge gate (`feature:manual_charge_add`) only ran when the body said `cardVariant:'a5'`. Stored non-manual lines (price lines, extra-day 50%, delivery) could be soft-deleted by the same body (the recalculation never clears `isDeleted`). | Add / edit / delete charges, or lower the price, with no permission. |
| H3 | `feature:manual_payment_credit_add` was client-only: deleting a payment (`PUT payments[].isDeleted`), changing a stored payment's amount, `POST /api/payments` (cash/transfer/check), marking a credit done (`PUT /api/refunds/[id] isExecuted`). | Money actions with no permission. |
| H4 | The print-menu email path took a client `driveFolderId` and any attachment (only the quick mail had been fixed). | Files to an arbitrary Drive folder; unbounded / executable attachments. |
| H5 | `GET /api/deliveries` needed a login only. | Customer names / addresses for any employee. |
| H6 | `POST /api/orders/events` could be used to flood history. | Forged / mass `ORDER_PRINTED` rows. |

## 2. The design

### 2.1 Signed approval tokens (`lib/approvalTokens.js`)

`POST /api/auth/verify-pin` - after the typed code matched and every level check passed - also returns `approvalToken`:

```
a1.<base64url(payload)>.<base64url(HMAC-SHA256(key, "a1.<payload>"))>
payload = { ap: approverId, k: kind, o: [orderId,...], am?: amount, ac: actorEmployeeId|null, iat, exp: iat+5min, n: nonce }
key     = HMAC-SHA256(AUTH_SECRET, 'gemach/approval-token/v1')      <- distinct domain label
```

* Minted only for `requiredLevel` in {`מאשר הזמנה ללא תשלום` / `feature:debt_approval` -> `debt_approval`, `feature:manual_charge_add` -> `manual_charge`, `feature:manual_payment_credit_add` -> `manual_payment_credit`} and only when the caller names the order(s) (`context.orderId`, `orderId` or `orderIds`, max 100).
* `actor` = the logged-in (verified cookie) employee who asked - a token copied to another session is refused.
* Timing-safe signature compare (same primitives as `lib/authTokens.js`); the key label differs from the session cookie's, so an `auth_session` cookie can never be used as an approval token or the reverse (tested).
* **Single use** per (nonce, order) in process memory (`claimApprovalToken`); a request that fails afterwards hands the claim back (`releaseApprovalClaims`) so the worker is not asked for the code twice; once the money action committed the claim stays spent (`commitApprovalClaims`).
* The code (PIN/password) is never inside a token and tokens / ids / codes are never logged (`[approval] ... accepted without an approval token (kind=..., order=...)` is the only log line and has no secrets; rate limited to once a minute per kind).
* No `AUTH_SECRET` configured = nothing can be signed; the flags then behave as OFF (same legacy fallback as `lib/authTokens.js`, never a lock-out) and one error line says so.

### 2.2 Enforcement (`lib/approvalGate.js`)

Two per-gemach `SystemSetting`s (each gemach has its own DB; absent row = OFF):

| Flag | OFF (default) | ON |
|---|---|---|
| `approval_tokens_required` | `debtApprovedBy` / `employeeId` accepted exactly as today (+ deprecation log). A valid `debtApprovalToken`/`approvalToken` is preferred and the approver is read FROM it. | A debt approval is accepted **only** with a valid token (kind `debt_approval`, this order, this actor, unexpired, unused); the approver is taken from the token, never from the body. A bare id = 403 `APPROVAL_TOKEN_REQUIRED`; a bad token = 403 `APPROVAL_TOKEN_INVALID`. The approver must still hold `feature:debt_approval` **now** (re-checked at use time). |
| `approval_permissions_enforced` | Only today's rules (the a5 manual-charge gate with the typed code). | Server-side: manual charge on **any** body (H2), soft-deleting a stored non-manual obligation line (H2), deleting / changing the amount of a stored payment in an order PUT (H3), `POST /api/payments` with a non-credit method (H3), `PUT /api/refunds/[id]` marking a credit done or undoing it (H3). Allowed when the logged-in employee holds the permission, **or** a valid token of that kind for this order accompanies the request (its approver re-checked), **or** (manual charge only) the typed `manualChargeApproverId/Pin` of an authorised approver (today's new-card flow). Otherwise 403 with `code`, `approvalKind`. |

Kinds <-> permissions: `debt_approval` = `feature:debt_approval`; `manual_charge` = `feature:manual_charge_add`; `manual_payment_credit` = `feature:manual_payment_credit_add` (also covers payment deletion, credit execution and manual payments - the owner decided on one key, 2026-10-05).

Not gated even when enforced: **credit-card payment rows that carry a charge receipt** (below), new payment rows inside an order PUT, note edits, restoring a deleted payment, unchanged "echo" saves (a body that sends everything back as it was changes nothing).

**Credit-card rows (review finding 1).** The word `אשראי` in `paymentMethod` is free text, so it no longer un-gates anything: a card-labelled `POST /api/payments` without proof is gated exactly like cash. The proof is a **charge receipt** (`lib/chargeReceipts.js`): `POST /api/nedarim` signs one (`c1.<payload>.<HMAC>`, its own key domain, 60-minute life) ONLY after Nedarim answered success, and returns it as `chargeReceipt` next to the old fields. The receipt is bound to the order id sent with the charge, the exact charged amount (+-0.01), the logged-in employee, and is single use per server instance. `POST /api/payments` accepts a card-labelled row only with a receipt that matches all of those; the two card flows (new order card `usePaymentActions.chargeCard`, legacy `ModernPaymentsManager`) now send `orderId` to `/api/nedarim` and the receipt on to `/api/payments`. A card row without a valid receipt falls back to the normal rule (permission or `approvalToken`), so a stale tab that does not send the receipt gets the manager-code prompt instead of a silent failure; if even that fails the clients already keep the charged payment as a local row that the next order PUT saves (new rows inside an order PUT are not gated). The receipt never contains card data and is never written to the DB. `AUTH_SECRET` missing = no receipts and no enforcement (same legacy fallback as the tokens).

### 2.3 Request fields

| Request | Token field |
|---|---|
| `PUT /api/orders/[id]` | `debtApprovalToken` (only with `debtApprovedBy`), `manualChargeApprovalToken`, `paymentApprovalToken` |
| `POST/DELETE /api/orders/[id]/debt-approval` | `approvalToken` (the approver comes from it) |
| `POST /api/payments` | `approvalToken` (manual rows) / `chargeReceipt` (card rows, from `POST /api/nedarim`) |
| `PUT /api/refunds/[id]` | `approvalToken` (stripped before the DB write). A credit with **no order** (`Refund.orderId` null) is approved with a token bound to the documented sentinel `NO_ORDER_ID = 999999999` (`lib/approvalTokens.js`, mirrored as `NO_ORDER_APPROVAL_ID` in `lib/approvalTokenStore.js`): the refunds page asks verify-pin for that id; it is only ever minted for the `manual_payment_credit` kind and only on its own, so a token for real orders can never unlock a no-order credit and the reverse. Breadth: one such approval covers any single no-order credit execution inside its 5 minutes, once. |

Error bodies carry `approvalKind` (`debt_approval` / `manual_charge` / `manual_payment_credit`); every client re-asks for exactly that approval once and resends (up to 3 times), so a token that expired mid-edit costs one extra code entry, not a failed save.

### 2.4 Clients (all updated; each works as before when the flags are OFF)

* New order card: `OcApproval` returns `approvalToken`; `lib/approvalTokenStore.js` keeps it per (level, order) for 4.5 minutes; `orderCardFlows.putOrder` attaches tokens and retries on `approvalKind`; `usePaymentActions` sends it with `POST /api/payments` / `PUT /api/refunds/{id}`.
* Legacy order page (`LegacyOrderPage.js`; its frozen-hash test was updated on purpose), `ModernPaymentsManager`, refunds page (one token for a whole multi-order approval, single use per order), `mocAuth.verifyPin(.., {orderId|orderIds})`. The two debt prompts used `requiredLevel:'עובד'` (no permission check) and now ask for the debt level with the order id.
* Helpers: `lib/approvalClient.js` (`requestApproval`, `sendWithApproval`), `lib/approvalTokenStore.js`.

### 2.5 The safe items (live immediately, no flag)

* **H1 (visibility) - COSMETIC ONLY, not a defence**: `/api/audit` replaces other employees' ids (row `employeeId`, `meta.approverId`) with an opaque marker for everyone below head management; names (`employeeName`, `approverName`) are resolved first and every history screen only tests `log.employeeId` for truthiness, so nothing visible changes. Raw employee ids are **still returned** by other endpoints - `GET /api/orders/[id]/history`, `GET /api/audit/order-item/*` and `GET /api/employees` (the approver picker) - so a determined employee can still learn a manager's id. The hiding only removes the easiest source and keeps the screens unchanged. The real fix for H1 is the signed token (a known id is useless without the typed code once `approval_tokens_required` is ON), not the hiding.
* **H4**: the print-menu email ignores any client `driveFolderId` (only `email_drive_folder_id`); extra files are cleaned (max 10, total size, clean name, valid base64, **executables / scripts / svg refused**, mimeType decided by the server from the extension). Ordinary documents (Word, scans...) still go through - the print menu legitimately attaches them.
* **H5**: `/api/deliveries` requires `page:deliveries` or `page:orders` (same as `/api/deliveries/join`).
* **H6**: `/api/orders/events` refuses more than 5000 rows / employee / minute (429 `RATE_LIMITED`). The schedule-day print writes one row per order per page of the document (already sent in chunks of 200 orders per request), so a 150-order day printed as 12 pages is 1800 rows; the first cap of 1000 dropped such history rows silently. Open mode (no login) has one shared `anonymous` bucket, which gets 10000. Repeated identical events are deliberately not collapsed (two prints are two prints; `clientEventId` already makes retries idempotent).

## 3. Rollout per gemach (recommended order)

Both flags live in `SystemSetting`; use `node scripts/set_approval_flags.js` (dry run prints the target DB host and current values; `--apply` needs `--expect-host=` to match - the host check exists because a settings script once wrote one gemach's rules into the other's PROD). Or the admin settings page (the two keys are in the "כללי" tab once the row exists).

1. Deploy the branch (flags OFF). Check the deprecation line in the logs only if you want evidence of which screens still send bare ids (none should: all clients send tokens).
2. In the gemach to harden, **verify by hand** in the browser: approve a debt on save / exit in the order card (new + legacy), approve debts from `/refunds` (select several orders), then flip `approval_tokens_required=true`. Repeat the same actions. Workers see no new prompt unless a token has expired (5 minutes) - except the exit-after-save prompt in step 3.
3. **Known extra prompt with `approval_tokens_required=true` (review finding 3).** A debt token is single use. When a worker approves the debt on **save** and then **exits the card in the same session**, the exit sends the approver id again; the first token is already spent, so the server answers 403 and the card asks for the manager code once more (legacy `LegacyOrderPage` exit, and the new card's exit after `oc.approveDebt`). With the flag OFF nothing changes. This was left as is on purpose: letting one token cover save + exit would mean a reusable token (a captured token could approve twice), which is the weaker design. Announce it to workers before flipping the flag; it is one extra code entry, never a failed save.
4. For `approval_permissions_enforced=true`: flip it **only for a gemach whose order card is the new one** (`ui_variant_order_card='a5'`). With the legacy card a worker without the permission is not blocked dead: the legacy page now re-asks for the manager's code (`sendWithApproval`) when the server answers 403 + `approvalKind` - but that is a new prompt in a flow that had none, so announce it. Check: delete a payment, add a manual payment, mark a credit done, add / delete a manual charge - once as an employee WITHOUT the permission (expect the code prompt) and once WITH it (expect no prompt).
5. **Rollback** for either flag: set it to `false` (setting cache ~30 s). Nothing else needs to change; the tokens simply stop being required.

## 4. Threat model (what is and is not defended)

Defended (when the flags are ON): forging an approval by naming a manager's id (H1); replaying a captured token (single use in the instance, 5-minute life); using a token for another order / another action kind / another session / another gemach (HMAC with that gemach's `AUTH_SECRET`); using a debt token to delete a payment; an approver whose permission was revoked inside the 5 minutes; direct API calls without `cardVariant` (H2); soft-deleting priced lines (H2); manual money actions without permission (H3).

Residual risks (documented, accepted):
* Single use is **per serverless instance only** (in-process memory). There is no cross-instance check of any kind - no AuditLog or DB-backed nonce exists (one was considered; it would put a new key into `changesJson` that every history screen would have to hide). A captured token or charge receipt could therefore be used once more on a different instance inside its lifetime (5 minutes / 60 minutes), only by the same session employee, for the same order, kind (and amount, for a receipt) - i.e. it can repeat an approval or card row that really was given.
* A malicious employee who learns a manager's code is a manager for this purpose - tokens prove the code was typed, not by whom.
* The typed-code path of the new card (`manualChargeApproverPin`, `managerPin`, `orderDateApproverPin`, `emailApproverPin`) still sends the code in the PUT body (already verified server-side today); it is unchanged.
* `approval_permissions_enforced` does not gate: payment rows created inside an order PUT, refund creation, `DELETE /api/refunds/[id]`, editing a payment's method/notes. Listed for a possible next round.
* `/api/employees` still lists employee ids (login picker by design).

## 5. Files

`lib/approvalTokens.js`, `lib/chargeReceipts.js`, `lib/approvalGate.js`, `lib/approvalTokenStore.js`, `lib/approvalClient.js`, `lib/eventRateLimit.js`, `lib/orderQuickMail.js` (H4), `lib/history/orderEvents.js` (`detectAutoLineRemovals`, `detectPaymentMoneyChanges`), `app/lib/auditLog.js` (`hideForeignEmployeeIds`), routes: `nedarim` (charge receipt), `auth/verify-pin`, `orders/[id]` (PUT), `orders/[id]/debt-approval`, `orders/[id]/email`, `orders/events`, `payments`, `refunds/[id]`, `audit`, `deliveries`; `scripts/set_approval_flags.js`; settings metadata for the two keys.

## 6. Independent review (2026-10-05) - final status of the 5 findings

| # | Finding | Status |
|---|---|---|
| 1 | `POST /api/payments` un-gated any method containing `אשראי` (free text) | **Fixed.** A card row is un-gated only with a server-signed charge receipt from `POST /api/nedarim` (order + exact amount + employee, single use per instance); otherwise it is gated like cash. Both card clients send the receipt. Tests in `scripts/approval-hardening.test.mjs`. |
| 2 | No-order credits dead-ended with the flag ON; debt batches over 100 orders got no token | **Fixed.** No-order credits use a token bound to the sentinel `NO_ORDER_ID` (manual_payment_credit kind only); the refunds page sends it. Debt batches are split into chunks of at most 100 orders: one code prompt, one signed token per chunk (`verifyPinForOrders`). |
| 3 | Exit after a save re-asks the manager code (the debt token is spent) | **Documented, not changed** (safer option: no reusable token). One extra code entry on exit after a debt-approved save, only with `approval_tokens_required` ON; see rollout step 3. |
| 4 | Print-history rows lost to the 1000/min cap; open mode shares one bucket | **Fixed.** Cap 5000 rows/employee/minute, 10000 for the shared open-mode bucket; the print page already sends chunks of 200 orders per request. |
| 5 | Comment described a non-existent AuditLog nonce; H1 id hiding presented as protection | **Fixed.** The code comment and this document now say single use is per instance only, and that H1 hiding is cosmetic (raw ids still come from `/api/orders/[id]/history`, `/api/audit/order-item/*`, `/api/employees`). |
