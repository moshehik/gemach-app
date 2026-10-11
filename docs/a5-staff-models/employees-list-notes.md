# Employees list (`/employees`) - decisions, data sources, gotchas

Branch `feature/a5-staff-models-2026-10-09`. Files: `app/components/employees-list/{EmployeesListA5,EmployeesSwitch,employeesLogic}.js` + `employees-list.css`,
`app/employees/LegacyEmployeesListPage.js` (frozen = `app/employees/page.js` of main 51eae39f, byte-identical, test-pinned), new thin `app/employees/page.js`,
`app/api/employees/presence/route.js`, shared kit `app/components/a5-list/`.

## How `/employees` is decided now (two variant screens on one route)
* `attendance` (existing, 4.10.2026) decides the OLD page with the OLD attendance tab: `attendance='legacy'` => `LegacyEmployeesListPage` (which itself wraps `LegacyEmployeesPage` in `VariantFrame attendance`). `employees_list` is not even consulted.
* `attendance='a5'` => `employees_list` decides: `a5` -> new list (its "נוכחות" tab goes to `/employees/attendance`), `legacy` -> the frozen old list page (its `EmployeesPage`, no attendance tab inside) with the corner swap icon `employees_list`.
* Default per role: programmer = new, everyone else = old (until the owner sets `ui_variant_employees_list='a5'`; **no settings/DB were touched**). To show the new list to everyone the org also needs `ui_variant_attendance='a5'` - otherwise the legacy attendance page wins. This is documented in `lib/uiVariantScreens.js`, `docs/page-variant-switch-2026-10-04.md` and `EmployeesSwitch.js`.
* The old list's features are all kept: AI search (`/api/ai/smart-search`, pageContext `employees`), statistics (`StatisticsModal`), "עובד חדש", sort, active/inactive filter (now a filter group), row -> card.

## Data sources
* List: `fetchSharedJson('/api/employees?all=true', { ttl: TTL.STATIC })` (same URL as the old page, so the prefetcher in `app/lib/prefetchRoutes.js` still warms it). Department = `department.name` (include), phone = `phone1`, code = `legacyId` else the first 5 chars of the id (never a UUID), password flag = `needsPasswordReset`.
* **"Connected now" and "last entry"** - there is NO such column. New read-only route `GET /api/employees/presence` (gate: `getAttendanceViewer().isManager` = head management / programmer, fail-closed; no schema change, no writes) derives both from `Shift`:
  * `lastEntry` = `MAX(entryTime)` over non-deleted shifts (`prisma.shift.groupBy`).
  * `connected` = the employee's latest OPEN shift (`exitTime=null`, not deleted; `pickLatestOpenShift` from `lib/openShift.js`) that started less than 16h ago - the same plausibility rule as the "במשמרת" clock of the top menu (`shiftClockInfo` / `MAX_PLAUSIBLE_SHIFT_MS`), so a forgotten old Access shift does not show "connected" forever. `shiftMinutes` = elapsed.
  * The page loads it once and refreshes every 60s while the tab is visible. Shown: marker "מחובר" (tooltip "מחובר עכשיו · במשמרת H:MM שעות"), filter option "מחוברים עכשיו" (hidden while nobody is connected - the zero-count rule), detail row "משמרת".
  * We deliberately did NOT use `PageVisitLog` / sessions: "connected" in the mock means clocked in, which is what the shift clock shows everywhere else.
* AI results (`/api/ai/smart-search`) come back as raw Employee rows without `department`: the department name is resolved from a `roleId -> name` map built from the full list.

## Gotchas
* `EXPORT_HOOK` (exported from `EmployeesListA5.js`) is the stage-2 hook for the designed print / PDF sheets ("רשימת עובדים", `printList` in `employees.js` of the mock). Until then Excel/PDF/print use `runListExport` (`app/components/a5-list/exportList.js`: real xlsx via `lib/xlsxExport`, PDF via `/api/pdf`, print window). The old list had no export at all, so no regression and no `exportMaxRows` approval flow is applied (add it if the owner wants the same limit as `ExportButtons`).
* Quick actions in the expanded row: "איפוס סיסמה" and the mail icon open the employee card (both need manager approval that already lives in the card - `EcApprovalDialog`, `EcMail`); the print icon is a toast until stage 2. Open owner question: should these run inline in the list?
* `StatisticsModal` is still the legacy-styled floating window (portal to `body`, not `.dlg-dark`). The mock has no design for it (its stats button is a demo toast). Restyling it dark is a separate item.
* CSS is scoped: `a5-list.css` only inside `.gm-ds :where(.a5l)`, page glue `a5-page.css` only under `.gm-ds.gm-a5`, employees-only markers (`.conn/.pwd/.mk`) in `employees-list.css`. The palette `components.css` is imported by the page (as the other A5 pages do).
* The dev console prints a dev-only hydration warning for `next/dynamic(..., { ssr: false })` + CSS import; the same pattern is used by `EmployeeCardSwitch` / `AdminHubSwitch`. Not introduced here.
