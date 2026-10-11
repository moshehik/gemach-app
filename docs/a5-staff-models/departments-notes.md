# Departments (`/admin/departments`) - notes

Variant screen `departments` (programmer = new by default, everyone may switch for themselves; old page = `app/admin/departments/LegacyDepartmentsPage.js`, byte-identical to main 15dc7a0d, test-pinned). Files: `app/components/departments/{DepartmentsSwitch,DepartmentsA5,departmentsLogic}.js` + `departments.css`, print builder `departmentsDoc` in `app/components/a5-print/pkSpecsAdmin.js` (registry id `departments-employees`, surface `a5-departments`). **No server change at all**: same APIs (`GET/POST /api/departments`, `PUT/DELETE /api/departments/[roleId]`) with their own gates and rules. Tests: `scripts/test_a5_departments.mjs` (14). Fidelity: `departments-fidelity.md`.

## Data and rules (unchanged, server is the authority)
* List = `GET /api/departments` (any signed-in employee; `_count.employees` = ALL employees pointing at the department, inactive included - the same number the delete guard uses). Employee names for the details and the print come from `GET /api/employees?slim=1` (active employees only, loaded in parallel; if it fails the list still works and shows only counts).
* Create = `POST` (head management / programmer): number >= 0 (default = max + 1 like the old page) + name; the server refuses duplicate names (409 "כבר קיימת מחלקה בשם...") and duplicate numbers (409). Rename = `PUT` (name only; the number is the key and never changes). Delete = `DELETE`: refused for system roles 1 / 2 (409) and for departments with employees (409, with the count); the client mirrors both rules (`deleteBlock`, constants asserted equal to the route) for a better UX but always shows the server's text on a failure, and the server stays the only authority.
* Not a permissions screen: department permissions live in `/admin/permissions`; the old page did not show them, so neither does this one.
* The old "settings that store departments by name are not updated on rename" warning is kept as the sub-line of the rename dialog.

## Decisions
* Inline table editing (old page) -> dark dialogs (owner rule: dark dialogs only, no `alert` / `customConfirm`); every server message is shown inside the dialog (create / rename) or as a toast (delete).
* The "תפקיד מערכת" badge -> icon + word (no pills); delete is disabled for system roles, muted with a tooltip when employees block it.
* Default sort = department number (as the old page).
* Print / PDF "מחלקות ועובדים": a row per department (number, name, active employees, "+N לא פעילים" only when present); data comes from the on-screen list so the filter / sort are respected. Surface key `page:admin` (the page is under `/admin`; the data is not secret to anyone who passes the page gate).

## Verified live on TEST (writes, then restored)
Create "בדיקת L1" (97), rename, delete through the dialogs; duplicate-name error shown in the dialog; delete of a department with 24 employees -> the server wording toast; system role button disabled. TEST DB ended as it started (6 departments). Security matrix (minted sessions): GET 401 anonymous / deactivated, 200 any signed-in; POST / PUT / DELETE 401 for secretary / seamstress / branch manager, reachable for head management / programmer; page = no-access card for everyone below head management.

## Gotchas
* The employee-count in the row is all employees (inactive too); the names list is active only - the difference is shown as "ועוד N לא פעילים".
* `/api/employees?slim=1` also returns service accounts (same as the count) - nothing to filter in the UI.
