# PageVisitLog stored credentials in plaintext (fixed 2026-09-24)

## What happened
The global `window.fetch` interceptor in `app/layout.js` records every `/api/*` call to
`PageVisitLog`. When the URL had no query string it stored the request **body** as
`requestQuery` (up to 4000 chars, no redaction), and `app/management/history/page.js`
displayed it. So bodies of `/api/login`, `/api/auth/verify-pin`, `/api/attendance`,
`/api/employees/:id/password`, `/api/orders/:id` (with `authPin`), etc. - passwords and
PINs - were stored and shown in plaintext.

Verified 2026-09-24 against the TEST DB (read-only SELECTs, no values printed): 294 of
~9,900 rows with a body matched credential-like keys (`password`, `newPassword`, `pin`,
`authPin`, ...), e.g. 98 `/api/login`, 16 `/api/attendance`, `/api/auth/verify-pin`,
`/api/employees/*/password`, `/api/auth/forgot-password`. PROD of both orgs is assumed to
be affected the same way (same code, same table) - not queried.

## Fix (code)
- `app/layout.js` interceptor: never records the body for auth endpoints (login/logout,
  `/api/auth/*`, attendance, `POST /api/history`, employee password endpoints,
  agent-login); on all other endpoints sensitive JSON keys / query params are replaced by
  `[מוסתר]` before queueing.
- `lib/redactSensitive.js` + `app/api/log-visit/route.js`: server-side redaction on write
  (also covers old cached clients and `app/print/*` beacons); `pageUrl` query params too.
- `app/api/history/route.js`: rows are redacted on read (so already-stored rows are never
  returned to the browser), and the `requestQuery` text search excludes auth/secret rows
  so search can't be used as an oracle to guess stored credentials.
- Key matching: contains `pass`/`secret`/`token`/`authorization`/`otp`, exactly `code`, or
  ends with `pin`/`pinhash`/`pincode`/`authcode`/`smscode`/`verificationcode`... `barcode`
  and `mappingId` are deliberately NOT matched.

## Purge of existing rows (NOT run on PROD)
`scripts/redact_visit_log_secrets.js` - dry-run by default, needs `--db-env` and
`--expect-host` (aborts if the DB host doesn't match, one org per run), uses raw `pg`
UPDATEs (PageVisitLog is not audited; no AuditLog rows).

1. Deploy the code fix first (otherwise new credentials keep arriving).
2. Per org: dry-run, review counts, then `--apply` with the owner's explicit approval.
   - org1: `--db-env PROD_DATABASE_URL --expect-host <org1 neon host>`
   - org2: export org2's URL into a var, `--expect-host <org2 neon host>`
3. Neon backups/branches taken earlier still contain the old rows.

## Treat as exposed - rotate
Anything typed into a login / PIN / punch-clock / password-change / delete-history form
while the old code ran was stored in cleartext and visible to anyone with access to the
history screen or the DB. Rotate: employee passwords, employee PINs (incl. punch-clock
codes and the PIN used for order authorization), any admin/data-explorer PIN. The purge
does not undo exposure.
