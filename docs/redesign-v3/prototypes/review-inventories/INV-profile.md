# Functional inventory: `/profile` ("הפרופיל שלי")

Source: checkout of origin/main at `scratchpad/main`. All paths relative to that root.
Files in scope: `app/profile/page.js` (313 lines, single client component, no layout.js of its own), `app/api/me/profile/route.js`, `app/api/employees/[id]/password/route.js`, `app/api/settings/route.js` (GET), `lib/apiCache.js` (`invalidate`), `app/components/UserMenu.js` (entry point), `app/layout.js` (global login gate).
Not used by this page (despite the brief): `/api/me` (GET/PATCH), `/api/me/design-prefs`, `/api/me/shifts`, theme/palette UI, PIN entry, trusted-device management — see F-40..F-43.

## 1. Gates / access

- **F-01** No page-specific gate: there is no `app/profile/layout.js`, no `PageGate`, and no `page:*` catalog item for profile (grep of `lib/permissionsMetadata.js` for "profile" = no hits). The only page-level gate is the global login screen in `app/layout.js:279` (`showLogin = requireLogin && !isAuthenticated && !isPublicKiosk && !isPunchClock`), i.e. it depends on the `require_login` SystemSetting.
- **F-02** Data-level gate: `GET /api/me/profile` identifies the employee ONLY from the verified auth cookie (`getVerifiedAuthCookie`, `app/api/me/profile/route.js:11-14`); no id parameter, so an employee can only ever read/update their own row (comment lines 6-9).
- **F-03** Lookup matches `id = token` OR `legacyId = token` only if the token is all digits (`route.js:16-22`).
- **F-04** No cookie / no employee → 401 `{error:'Unauthorized'}` (`route.js:50-52`); inactive employee (`isActive=false`) → 403 `{error:'Inactive employee'}` (`route.js:53-55`). Same checks on PUT (`route.js:66-72`).
- **F-05** Client treats 401 or 403 as "not logged in" (`page.js:39-41`) and renders the not-logged-in card (F-30). So when `require_login` is off and the visitor is anonymous, the page renders but shows only that message.
- **F-06** Entry point: user-menu dropdown item "הפרופיל שלי" → `router.push('/profile')` (`app/components/UserMenu.js:170-177`). Also referenced as a how-to route in `lib/howToGuide.js:130-134`.

## 2. Network calls

- **F-07** `GET /api/settings` on mount (`page.js:26-34`), raw `fetch` (not the shared cache). Public route (`app/api/settings/route.js:15-36`), returns all SystemSetting rows except `BRAND_LOGO`/`backup_requested_at`, secrets masked. Page only reads `show_employee_profile_image`. Errors swallowed (`.catch(() => {})`).
- **F-08** `GET /api/me/profile` on mount (`page.js:36-50`). Response fields (`route.js:24-43`, `isActive` stripped at line 56): `id, firstName, lastName, fullName, phone1, phone2, email, emailSuffix, city, street, houseNum, joinDate, profileImage, receiveEmailAlerts, department{name}`. If body has `error` it is not stored (profile stays null → not-logged-in card). 500 → `{error:'Internal Server Error'}`.
- **F-09** `PUT /api/me/profile` on form submit (`page.js:57-78`), body = the ENTIRE `profile` state object as JSON (incl. `id`, `joinDate`, `department`, `emailSuffix`).
  - Server whitelist (`route.js:78-85`): string-typed `firstName, lastName, fullName, phone1, phone2, email, emailSuffix, city, street, houseNum, profileImage`; boolean `receiveEmailAlerts`. Everything else ignored. Non-string (e.g. `null`) values are skipped, not cleared.
  - Response `{success:true, id}`; errors 401/403/500 `{error}`.
  - No server-side validation of any field (format, length, email, phone, image size/type).
- **F-10** `POST /api/employees/{profile.id}/password` (`page.js:80-103`), body `{oldPassword, newPassword}`. Server (`app/api/employees/[id]/password/route.js`):
  - `checkAuth()` (no role) → 401 "יש להתחבר למערכת" (lines 13-15).
  - missing newPassword → 400 "יש להזין סיסמה חדשה" (24-26); length < 4 → 400 "הסיסמה החדשה קצרה מדי" (27-29).
  - session employee must equal `id` → else 403 "ניתן לשנות רק את הסיסמה של המשתמש המחובר" (34-38).
  - 404 "עובד לא נמצא" (41-43).
  - old password required unless `mustResetPassword && !oldPassword` (51); missing → 400 "יש להזין סיסמה ישנה"; wrong → 401 "הסיסמה הישנה אינה נכונה" (52-59).
  - On success: bcrypt hash of new password, `pinHash` = hash of last 4 chars of new password (trusted-device PIN), `mustResetPassword=false` (61-71). Returns `{success:true}`. 500 "שגיאת שרת".
- **F-11** After successful profile save the client calls `invalidate(['/api/me'])` (`page.js:68`) to flush the shared client cache prefix `/api/me` (also matches `/api/me/profile`), so UserMenu etc. refetch names. (The global fetch interceptor in `lib/apiCache.js:~177-207` would also default-invalidate `/api/me` for a non-GET to `/api/me/...`.)

## 3. Layout, sections, fields

- **F-12** Page header (`page.js:146-161`): h1 "הפרופיל שלי"; description "פרטים אישיים, אבטחה והעדפות תצוגה של המשתמש המחובר" + neutral badge with `department.name` when present; back button (icon-only, title "חזרה") → `router.back()`.
- **F-13** One form card (`<form className="card card-pad">`, `page.js:163`) with a `form-grid`. No sub-cards/tabs/section headings.
- Fields (all text inputs have `autoComplete="new-password"` to suppress browser autofill; none have `required`, `maxLength`, `pattern`, or masks):
  - **F-14** שם פרטי — `firstName`, text, editable (`168`).
  - **F-15** שם משפחה — `lastName`, text, editable (`173`).
  - **F-16** שם מלא — `fullName`, text, editable, independent of first/last (not auto-composed) (`178`).
  - **F-17** תאריך כניסה לארגון — `joinDate`, read-only (`disabled`), shown via `toLocaleDateString('he-IL')` (Gregorian only), "—" when empty; calendar icon (`182-186`).
  - **F-18** טלפון 1 — `phone1`, text, phone icon, editable, no format validation (`190-194`).
  - **F-19** טלפון 2 — `phone2`, same (`197-202`).
  - **F-20** מייל — `email`, `type="email"` (browser validates format on submit only when non-empty), mail icon (`205-211`).
  - **F-21** עיר — `city` (`214-216`); **F-22** רחוב — `street` (`219-221`); **F-23** מספר בית — `houseNum` (text) (`224-226`).
  - **F-24** `emailSuffix` is fetched and round-tripped but has no UI field (not displayed/editable).
  - **F-25** סיסמא לשעון נוכחות — disabled password input showing literal "********" + button "שינוי סיסמא" that opens the inline change-password panel (`232-240`). Label calls it "punch-clock password" though it is the login password (see F-45).
  - **F-26** Inline change-password panel (`242-269`), shown when `showChangePassword`: "סיסמא ישנה" and "סיסמא חדשה" password inputs, each with an eye toggle (title "הצג סיסמה", same icon both states); buttons "ביטול" (hides panel, clears both inputs) and "אשר שינוי" (F-31). No confirm-new-password field, no strength meter, no client length check.
  - **F-27** תמונת פרופיל (העלאת קובץ) — only when `showProfileImage` (`272-295`): 56px round preview when `profileImage` starts with `data:image`, else `.avatar.lg` with initials (first letters of first+last name, `page.js:142`); upload-zone label "גרור/י תמונה לכאן או לחצ/י לבחירה" / hint "PNG או JPG · עד 5MB"; hidden `<input type="file" accept="image/*">`; "הסר" button (danger-ghost) shown when `profileImage` is truthy → sets `profileImage=''`.
  - **F-28** קבלת התראות למייל — checkbox `receiveEmailAlerts` (`297-302`).
  - **F-29** Submit button "שמירת פרטים" (large primary), label "שומר..." and disabled while saving (`305-309`).

## 4. Actions

- **F-31** Change password: client check only that new password is non-empty → alert "יש להזין סיסמא חדשה" (`81-84`). On success: panel closes, inputs cleared, alert "הסיסמא שונתה בהצלחה"; on failure alert server `message` or "שינוי הסיסמה נכשל"; network error alert "שגיאה בשינוי הסיסמה". Independent of the main Save button (takes effect immediately). No confirmation dialog.
- **F-32** Save profile: submits full state (F-09). Success → `invalidate(['/api/me'])` + alert "הפרטים נשמרו בהצלחה!"; server error → alert `data.error` (English strings like "Unauthorized"/"Internal Server Error") or "שגיאה בשמירת נתונים"; network error → "שגיאה בשמירת נתונים" (`57-78`). No confirmation dialog; page does not re-fetch after saving.
- **F-33** Upload image: `FileReader.readAsDataURL` → stores base64 data URL into `profile.profileImage` in local state only; persisted only when Save is clicked (`105-114`). No size check (despite "עד 5MB" hint), no type check beyond `accept`, no resize/compression. Drag-and-drop is advertised but there are no drop handlers — the zone is a `<label>` for the hidden input, so only click works.
- **F-34** Remove image: sets `profileImage=''` locally; persisted on Save (empty string is a string, so the server writes `''`).
- **F-35** Back: `router.back()`.
- **F-36** No logout, no email-verification, no PIN change, no trusted-device management on this page.

## 5. States / messaging

- **F-30** Loading: header "הפרופיל שלי" + "טוען נתונים..." (`116-125`). Not-logged-in / no profile (incl. fetch errors and 500): card "כדי לצפות בפרופיל האישי יש להתחבר למערכת עם המשתמש שלך." (`127-140`).
- **F-37** All feedback is via native `window.alert` (no toast, no inline errors). Settings fetch failure is silent (image section stays visible by default).

## 6. SystemSettings / org dependence

- **F-38** `show_employee_profile_image` (category "תצוגה"; metadata `lib/settingsMetadata.js:200,266`): value `'false'` hides the whole image section; any other value or missing row → shown (default `true`, `page.js:22-24,30-31`). Same key also gates the image on the admin employee card (`app/employees/[id]/page.js:39-47,582`). Per-org value lives in each org's DB (no hardcoded org logic on this page).
- **F-39** `require_login` (indirect, via global layout F-01 and `checkAuth()` in the password route): when off, anonymous visitors reach the page but get the not-logged-in card; password route `checkAuth()` passes but then fails the session-equals-id check (403).

## 7. Permissions-dependent parts

- **F-40** None. No role, department or `PERMISSION_CATALOG` check anywhere in the page or its APIs; every active logged-in employee sees and edits the identical form. Sensitive fields (wage, role, AI, isActive, notes, shifts) are deliberately excluded (route comment `route.js:8-9`).

## 8. Dialogs

- **F-41** No modal dialogs. Change-password is an inline expandable card inside the form (F-26). Only native `alert()` popups (F-31/F-32). No `confirm()` before save, remove image, or password change.

## 9. Notable / possibly buggy

- **F-42** Design/theme prefs are NOT on this page: comment `page.js:228-230` says the old palette picker was removed; personal design prefs live on `/display-settings` via `/api/me/design-prefs` (which stores JSON in `Employee.themeColor`, `route.js:37-38`). The page description still promises "העדפות תצוגה".
- **F-43** `/api/me` GET/PATCH (also can toggle `receiveEmailAlerts`) and `/api/me/shifts` are not called by this page.
- **F-44** Password change button is `type="button"` inside the form, so it does not submit the form; unsaved profile edits remain unsaved.
- **F-45** Label "סיסמא לשעון נוכחות" is misleading: the endpoint changes the login password (and re-derives trusted-device `pinHash` from its last 4 chars).
- **F-46** `mustResetPassword` path: server allows empty old password when `mustResetPassword` is true, but the page UI still presents the old-password field (user can leave it empty). The LoginScreen has its own forced-reset flow (`app/components/LoginScreen.js:48,158`).
- **F-47** Image stored as full base64 data URL in `Employee.profileImage` with no size cap client or server side; large photos bloat the row and the PUT body. Upload hint "עד 5MB" is not enforced; drag-drop not implemented (F-33).
- **F-48** Preview only renders when the value starts with `data:image`; any other stored value (e.g. an old URL) shows initials, yet "הסר" still appears.
- **F-49** Whole state is PUT, including `emailSuffix` (hidden) — harmless (unchanged round-trip); `null` fields are skipped server-side so a field can't be set back to null, only to `''`.
- **F-50** No validation of phone/email/name; required-ness not enforced — an employee can blank their own first/last name.
- **F-51** Server error messages from PUT are English ("Unauthorized", "Internal Server Error") and shown raw in the Hebrew alert.
- **F-52** Eye toggle icon/title does not change when the password is visible.
- **F-53** Settings fetched via raw `fetch('/api/settings')` (full settings list) rather than the shared `fetchSharedJson` cache.
- **F-54** `lib/howToGuide.js:133` tells users "פרופיל אישי" is a quick link on the home page; the only entry found is the UserMenu dropdown (no `/profile` reference in `app/page.js`).
- **F-55** `joinDate` shown Gregorian only (no Hebrew date, unlike most dates in the app).
- **F-56** Profile edits are auto-audited by the Prisma audit extension (Employee update) — including base64 `profileImage` in `changesJson`; password/pinHash are masked per CLAUDE.md.
