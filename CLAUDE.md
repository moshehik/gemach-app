# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

A Next.js (App Router) management system for a "gemach" (גמ"ח) — a free-loan society that lends out wedding/event dresses. It tracks customers, employees, dress inventory (models + physical items), rental orders, payments/refunds, price lists, work shifts, and internal messaging. UI and data are Hebrew, RTL.

## Commands

Run from `gemach-app/` (this is the actual app root; the parent folder contains unrelated legacy Access-migration scratch files and is not part of the app).

```bash
npm run dev      # next dev --webpack
npm run build     # prisma generate && next build --webpack
npm run start
npm run lint      # eslint
```

There is no automated test suite (no Jest/Vitest configured). Verification is done by running one-off scripts (see below) or manually through the dev server. `eslint.config.mjs` ignores `*.js` at the repo root, `scripts/**`, and `scratch/**` — these are ad-hoc/throwaway scripts, not part of the linted app.

The repo root is cluttered with many one-off `check_*.js`, `fix_*.js`, `test_*.js`, `migrate_*.js`, `scratch_*.js` scripts used historically for data migration/debugging against the DB directly. They aren't part of the app runtime — don't treat them as source of truth for current behavior, and don't add new throwaway scripts there; prefer `scratch/` (gitignored) for anything temporary.

## Architecture

### Dual/offline database mode
[app/lib/prisma.js](app/lib/prisma.js) exports a `Proxy` that routes every Prisma call to either a "prod" or "test" Postgres client based on the `.active-db` file (or `globalForPrisma.activeDbMode`) — toggled via `/app/api/admin/database`. There is also an `IS_OFFLINE_MODE` env flag that swaps in a locally generated `@prisma/local-client` (SQLite, schema is [prisma/schema.local.prisma](prisma/schema.local.prisma) — `prisma/schema-sqlite.prisma` is an unrelated, stale, unused file despite the similar name, don't confuse the two) for working without internet. Always import the shared client from `@/app/lib/prisma` — never instantiate `PrismaClient` directly.

The local client isn't generated automatically by `npm install`/`npm run build` (that would make Vercel builds depend on a `SQLITE_URL` env var they don't need) — run `npm run generate:offline` once on any machine that will actually use offline mode (needs `SQLITE_URL` in `.env`), then `npm run offline:db-push` to create the local SQLite tables. Rows written offline get reconciled back into Postgres by [lib/offlineSync.js](lib/offlineSync.js) — a simple delta sync keyed by each model's `updatedAt`, upserting by `id` (both schemas use the same UUIDs, so no id remapping is needed) with last-write-wins conflict handling. It runs automatically once per process on server startup whenever `IS_OFFLINE_MODE` is not `'true'` (see `syncOfflineChangesIfAny` in `app/lib/prisma.js`), and can also be triggered on demand from `/admin/database` ("סנכרון נתוני אופליין") without restarting the server. Currently covers `Employee`, `Customer`, `DressModel`, `DressItem`, `Order`, `OrderItem`, `Payment`, `PaymentObligation` (`SYNCED_MODELS` in `lib/offlineSync.js`) — extend that list if other models start being written while offline.

### Automatic audit logging
The same Prisma client wraps every model's `create`/`update`/`delete` in a query extension that writes an `AuditLog` row (entity type/id, diffed `changesJson`, and the acting `employeeId` pulled from the `auth_token` cookie). `AuditLog`, `PageVisitLog`, and `Shift` are excluded to avoid recursive/noisy logging. Because of this, bulk data fixes are usually better done through raw SQL or scripts than through Prisma writes, to avoid flooding the audit log.

### Data model ([prisma/schema.prisma](prisma/schema.prisma))
Core entities and relations:
- `Customer` → `Order` → `OrderItem` → `DressItem` → `DressModel` (a `DressModel` is a dress design; `DressItem` is a physical, barcoded unit of that design; `OrderItem` links a rented unit to an order and tracks its own rental lifecycle: `isTaken`/`isReturned`/`returnedOk`/dates).
- `Order` → `Payment` / `Refund` / `PaymentObligation` (obligations are the itemized charges derived from `PriceList`/`PriceRule`; payments/refunds settle them).
- `Employee` → `Shift` (punch clock), `Department` (role), `Notification` (internal messaging with per-recipient read/archive state via `NotificationTag`).
- Almost every model has `legacyId` (unique) — a carry-over ID from the original Microsoft Access database this system replaced, used to cross-reference during/after migration. Most models also have soft-delete (`isDeleted`) rather than hard deletes.

### Business logic lives in `lib/`, not in routes
- [lib/pricingEngine.js](lib/pricingEngine.js) — recalculates `PaymentObligation`s for an order; explicitly ports logic from the legacy Access VBA module `שמלות_תשלום_רישום`.
- [lib/inventory.js](lib/inventory.js) — dress item availability/overlap logic, including `addDaysSkippingWeekends` for rental-period spacing between bookings.
- [lib/orderStatus.js](lib/orderStatus.js) — derives an order's Hebrew status string (`הוחזר`, `הושכר חלקי`, `מחוק`, etc.) from its items' taken/returned flags — this is the source of truth for order status, don't duplicate the logic in components.
- [lib/hebrewDate.js](lib/hebrewDate.js) and the `@hebcal/core`/`hebcal` deps — Hebrew calendar conversions, used throughout order/event dates alongside Gregorian dates (`Order.eventDate` + `eventDateHebrew`).
- [lib/ai/gemini.js](lib/ai/gemini.js) — Gemini API integration backing the AI search/chat features (`AIChatSession`, `AISearchBar`, `AIFloatingWidget`); keys come from `GEMINI_API_KEYS` in `.env.local`.

### Routing/structure conventions
- App Router: pages under `app/<feature>/`, matching API routes under `app/api/<feature>/route.js`.
- Path alias `@/*` maps to the repo root (`jsconfig.json`).
- Shared client code lives in `app/lib/` (Next-coupled: `prisma.js`, `nedarim.js`) and `lib/` (framework-agnostic business logic) — check both when looking for a utility.
- Print views are separate routes under `app/print/` (e.g. `app/print/order`, `app/print/alterations`) rendered standalone for printing, not modals.
- Auth is a simple cookie (`auth_token` = employee UUID) gated by the `require_login` `SystemSetting`; see [lib/auth.js](lib/auth.js). `SystemSetting` (key/value rows) drives various runtime toggles — check there before assuming a feature is hardcoded.

### ID display rule (from AGENTS.md)
When referencing entities (Orders, Customers, Dress Models, etc.) in code, UI, or communication with the user, always use the human-readable short ID (`orderId`, `legacyId`, `barcodePrefix`), never the internal UUID `id` — except where a route genuinely requires the UUID (e.g. `/customers/[id]` uses the UUID; `/orders/[id]` uses the numeric `orderId`).

## Backups
Neon's built-in point-in-time restore (7-day window) is the first line of defense but never leaves Neon. [scripts/backup_prod_db.js](scripts/backup_prod_db.js) adds a second, independent layer — a nightly compressed logical SQL dump written to `backups/` (gitignored), scheduled via a Windows Task Scheduler job (`GemachApp-ProdDbBackup`, daily 03:30). See [BACKUPS.md](BACKUPS.md) for what each layer covers, retention/rotation, the restore command, and how to verify the nightly job actually ran.

## Customer kiosk screen
`app/customer-interface/page.js` is handed to customers unsupervised to browse the dress catalog. The in-app lock (fullscreen + code-gated header buttons + re-lock on Esc/fullscreen-exit + blocked right-click context menu) only covers the browser tab — it can't stop Alt+Tab, the Windows key, or closing the browser window. [scripts/kiosk/launch-kiosk.bat](scripts/kiosk/launch-kiosk.bat) launches the screen in real OS-level `--kiosk` mode for the physical customer-facing machine. See [KIOSK.md](KIOSK.md) for setup and how to exit kiosk mode.
