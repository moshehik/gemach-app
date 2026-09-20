# Neve Yaakov email complaint - 2026-09-17/18 (fixes 2026-09-20)

Source: forwarded email "בעניין התוכנה" (Rivka Levi -> Ahuvi Pinkel -> Moshe). 5 items.

| # | Item | Status | Doc | Switch |
|---|---|---|---|---|
| 1 | Wrong-dress barcode accepted (critical) | fixed | 01-barcode-mismatch.md | `enforce_rental_barcode_match` |
| 2 | Search by model + size | already fixed (PR #95) | - | - |
| 3 | Deliveries by event date + bag page (event date, "bag _ of _", notes) | fixed | 03-deliveries-by-event-date.md | `deliveries_select_by_event_date` |
| 4 | "Page X of Y" on order print | fixed | 02-edit-unlock-and-print-page-numbers.md | - |
| 5 | Item edit / size change dead-end (critical) | fixed (unlock); 50% rule open | 02-edit-unlock-and-print-page-numbers.md | - |

Both switches: default false, row created in both PROD DBs, ON in Neve Yaakov only.

## Live verification (merged branch, TEST DB, port 3114)
- Barcode: switch off -> mismatch accepted (old behaviour); on -> 409 with expected/scanned; matching barcode passes. 33/33 unit cases.
- Deliveries (days 2/1, event 1.10): off -> shown on 29.9 out / 2.10 return; on -> shown on 1.10 with dispatchDates {out 29.9, return 2.10}.
- Edit: with `enable_alterations=false` the reopen button is present on an old item (before: absent).
- Print: real PDF via `/api/pdf`: "page 1 of 2", "page 2 of 2".
