# Open items — A5 staff screens + security rounds (state at 2026-10-11)

Everything in `README.md` / `security-audit.md` is merged and deployed on both gemachs (main `eb2987fd`). This file lists only what is **still open**, so a later session can pick it up without re-reading the whole audit. Nothing below is a regression; each item says what it is, why it was left, and the first step.

## Security
| # | Item | Why open | First step |
|---|---|---|---|
| S1 | **No brute-force limit on the manager code** (the code that approves manager-only actions). | Needs an owner decision on lockout behaviour (attempts, window, per-employee vs per-IP, how a manager gets unlocked). | Decide the policy, then add a counter next to the verify route; reuse the pattern of any existing login limiter if one exists. |
| S2 | **AI money data is prompt-only for users without `feature:ai_financial_data`.** The R4b table allow-list (`lib/ai/sqlTablePolicy.js`) is table-level; a standard-tier user can still ask the chat for amounts in `Payment` / `Order.totalAmount`. | Today `feature:ai` is held only by head management + programmers (main gemach 4 employees, Neve 9, measured 2026-10-11), so nobody is exposed yet. It matters the day `feature:ai` is granted to an ordinary employee. | Before granting `feature:ai` to a non-manager: either drop `Payment`, `PaymentObligation`, `Refund` from the standard tier, or add column-level rules for `Order.totalAmount`. |
| S3 | **R4b live check not done.** The allow-list was verified with 53 unit checks and by replaying the 59 recorded AI statements (0 false blocks), but not through the real routes with live Gemini. | Cost / time; the replay covers the tables real questions used. | Run `scripts/ai-reliability/suites/core.mjs` + `replay.mjs` (README in that folder) against TEST. If a legitimate question is blocked (generic "שגיאה בביצוע חיפוש חכם"), add the table to the right tier in `lib/ai/sqlTablePolicy.js`. |

## Performance / UX
| # | Item | First step |
|---|---|---|
| P1 | PDF render timeout (~30 s) for very large tables under load (`/api/pdf` surface mode). History prints are already capped at 1500 rows. | Measure the slowest print (orders / customers full list); consider a lower cap or streaming. |
| P2 | The models list loads the whole catalog client-side and pages in the browser. Fine at today's size, grows with the catalog. | Move to server paging (`/api/dresses?page&limit` already exists) when the catalog passes a few thousand models. |
| P3 | Very wide tables scroll sideways at 1440 px. | Decide per table which columns to hide below a width. |

## Rollout decisions (owner)
| # | Item | State |
|---|---|---|
| R1 | Org-level `ui_variant_*` settings for the new screens were **not** written. Every active employee can choose the new design for themselves; default stays old for everyone except the programmer. | Written prod rows: `shell` / `home` = `legacy`, `new_order` = `a5` on both orgs. To make the new design the default for a screen, set `ui_variant_<id>='a5'` per org (identity-check the DB first; see the Neve / main DB rules in memory). |
| R2 | `/employees` also needs `ui_variant_attendance='a5'` for non-programmers (shared page). | Same as R1. |

## Housekeeping
* Old open PRs not from this work: #218 (untrack desktop.ini), #188 (redact request bodies in PageVisitLog — a security fix worth a look), #177 (new-order redirect hang), #229 (logout tooltip). Check each against current `main` by diff before merging (see "verify branch diff, not commit count").
* Prod runs recorded 2026-10-11: secret scrub (`scripts/scrub_logged_secrets.js`, both DBs, re-check = 0) and `AuditLog_createdAt_idx` + `EmailLog_sentAt_idx` (both DBs, valid). Re-running either is safe (idempotent).
