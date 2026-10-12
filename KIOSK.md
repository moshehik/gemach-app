# Customer kiosk screen (`/customer-interface`)

`app/customer-interface/page.js` is meant to run unsupervised on a machine an
employee hands to a customer to browse the dress catalog. Two layers of
protection exist, and it's important to understand what each one actually
covers:

## Layer 1 — in-app lock (already built, browser-level)

When an employee presses the lock button ("תפיסת מסך ללקוח"), the page:

- requests browser Fullscreen (`document.documentElement.requestFullscreen()`)
- sets `isLocked = true`, which makes the "חזור למערכת" / "חיפוש חדש" header
  buttons open a code-request modal instead of navigating/acting
- re-opens that same code modal automatically if fullscreen is exited (e.g.
  the customer presses Esc) via a `fullscreenchange` listener
- blocks the right-click context menu while locked (a customer opening
  "Inspect"/"View source" from a context menu is a bigger hole than the
  header buttons ever were)
- only unlocks on a correct employee login (`employeeId` + password against
  `/api/login`); "ביטול" on that modal closes the modal but does **not**
  unlock the screen

This layer is entirely inside the browser tab/page. It cannot stop:
- **Alt+F4** (closes the browser window/tab)
- **Alt+Tab** or the **Windows key** (switches away from the browser entirely)
- closing the browser via the taskbar, or a customer plugging in a keyboard
  shortcut you didn't anticipate

Those are OS-level actions a web page has no permission to intercept. That's
what Layer 2 is for.

## Layer 2 — OS-level kiosk mode (for the physical customer-facing machine)

[`scripts/kiosk/launch-kiosk.bat`](scripts/kiosk/launch-kiosk.bat) launches
Chrome or Edge with the `--kiosk` flag, which is a real OS-level kiosk
window: no address bar, no tabs, no window chrome, and — while that window
has focus — Alt+Tab has nothing else to switch to and the taskbar/Start menu
are suppressed by the browser itself.

### Setup on the customer-facing machine

1. Copy `scripts/kiosk/launch-kiosk.bat` onto that machine (or point directly
   at it if it's on a shared/network path).
2. Open it in a text editor and set `KIOSK_URL` at the top to wherever this
   app is actually reachable from that machine — the deployed production URL
   if it's remote, or `http://localhost:3000/customer-interface` if the app
   runs on that same machine (in which case make sure `npm run start` — or
   whatever serves it — is also set to launch automatically).
3. Test it by double-clicking the `.bat` file. It should open straight into
   the kiosk screen, fullscreen, with no browser UI.
4. To make it start automatically when the machine boots/logs in, put a
   shortcut to the `.bat` file in the Startup folder:
   `Win+R` → `shell:startup` → drop a shortcut to `launch-kiosk.bat` there.
   (For a more robust setup that can also auto-restart the browser if it
   crashes, use Task Scheduler with a trigger "At log on" instead — same
   idea as the existing `GemachApp-ProdDbBackup` scheduled task described in
   [BACKUPS.md](BACKUPS.md).)
5. In-app, still have the employee press the lock button ("תפיסת מסך
   ללקוח") before handing the machine to the customer — the two layers are
   complementary, not a replacement for each other. Layer 1 stops
   in-page navigation and re-locks on Esc; layer 2 stops Alt+Tab/Windows-key
   window switching.

### Getting OUT of kiosk mode

- **Alt+F4** still closes the kiosk browser window even with `--kiosk` set —
  this is intentional and expected; it's the normal way an employee ends a
  kiosk session. (A customer could technically do this too, same as they
  always could with Esc on the in-app lock — there's no way to prevent an OS
  from honoring Alt+F4 short of dedicated kiosk-mode Windows configuration,
  see below.)
- After Alt+F4 (or if the machine reboots and the Startup shortcut relaunches
  it), just run `launch-kiosk.bat` again to re-enter kiosk mode.
- If the window is ever unresponsive, `Ctrl+Shift+Esc` opens Task Manager
  directly (bypasses the taskbar) to end the browser process.

### What this does NOT cover (out of scope here)

For a fully locked-down public terminal (preventing Alt+F4, Ctrl+Shift+Esc,
USB devices, etc.) you'd want Windows' own **Assigned Access / kiosk mode**
(Settings → Accounts → Other users → Set up a kiosk) or a dedicated kiosk
lockdown product. That's a machine-level Windows configuration decision for
whoever manages the physical customer-facing PC, not something this repo can
set up remotely — this `.bat` script is the practical middle ground: real
OS-level kiosk browsing without administrative lockdown of the whole machine.

## A5 design (2026-10-12)

`/customer-interface` renders `app/components/kiosk/KioskSwitch.js`: the A5 kiosk (`KioskA5.js`) unless the org setting `ui_variant_kiosk` is `legacy`
(then the frozen `app/customer-interface/LegacyKioskPage.js`, the old "Warm-Atelier" skin with its own `kiosk.css`). Approved design:
`תצוגות-עיצוב/עמדת-לקוח.html`. Nothing was removed from the kiosk: lock / fullscreen / employee-approved unlock and print, model search, filters, Hebrew
calendar, the model-orders window, the AI assistant and every `kiosk_*` / `hide_dress_images` setting work as before.

- Flow: splash (`kiosk_splash_screen`, default on; `false` skips it; org name from `gmach_name`; while the screen is locked a minute without touch returns to
  the splash and clears the customer's choices, AI chat and any typed personal details) -> step 1 date -> step 2 model number + size (real sizes from the stock) ->
  step 3 results (tiles by default; list / table / filter panel / zoom / AI / print / lock live in the results bar).
- "מילוי פרטים אישיים" (`KioskRegistration.js`, shared component, `mode="station"|"public"`): shown when `kiosk_customer_self_service` is on. Its single send point is
  `submitRegistration` in `kioskRegistrationApi.js` (POST `/api/public-kiosk/register`, `channel:'kiosk'` for the store kiosk / `'public'` for the public link).
  Explicit yes / no (no default) for terms and marketing, a required privacy checkbox, Enter moves to the next field (`kioskEnterNav.js`), and "צפייה בתקנון" /
  "מדיניות פרטיות" open in a window inside the screen (iframe of `/api/public-terms` and `/privacy`), so the locked kiosk is never left.
- Tests: `node scripts/test_kiosk_logic.mjs`, `node --import ./scripts/business-days-tests/register.mjs scripts/test_kiosk_model_search.mjs`.


## Public link (`/station`) - no login, backend contract (2026-10-12)

`/station` is the customer kiosk reachable from home without logging in. The page itself is built on top of three public endpoints; the
layout (`app/layout.js`, `stationBare`) renders it without the employee shell and exempts it from the `require_login` wall. There is no
middleware allow-list in this repo (middleware.js only forwards the pathname; API auth is per route), so the public routes simply do not call `checkAuth()`.

Settings (all default OFF when the row is missing; org2 "Neve Yaakov" is seeded to true by `scripts/seed_kiosk_public_settings.js --org=2`, dry-run by default):
`kiosk_public_link_enabled`, `kiosk_public_show_inventory`, `kiosk_public_show_registration` (the last two only count while the first is on).

Endpoints (`lib/publicKiosk/*`, rate limited per IP, field allow-lists, never cookie based):
- `GET /api/public-kiosk/config` -> `{enabled:false}` or `{enabled,showInventory,showRegistration,hideImages,registration?}`.
- `GET /api/public-kiosk/models?q=&category=&size=&eventDate=YYYY-MM-DD` -> `{ok,data:[{name,code,priceCategory,sizes:[{size,available?,qty?}],imageUrl?,thumbnailUrl?,inStock?}],categories,sizes,inventory}`.
  Availability keys exist only when `showInventory` is on AND `eventDate` was sent (qty capped at 5).
- `POST /api/public-kiosk/register` -> `{ok:true}` (identical for a new and for an existing customer) or `400 {ok:false,code:'validation',errors,fields}`.
  A new customer is marked in `Customer.officeNotes` (`lib/kioskRegistration.js`); staff see it as a badge in the customer pickers and can list them with
  `GET /api/customers?kioskPending=1`; `POST /api/customers/[id]/kiosk-verify` clears the mark.

Tests (no DB / server): `node scripts/kiosk-public-tests/run.mjs`.

### Public station `/station` (A5, landing-style)

`app/station/page.js` loads the public flags on the server (`loadPublicKioskConfig`, the same allow-list as `GET /api/public-kiosk/config`) and renders
`app/components/kiosk/KioskPublic.js` (inside `A5Page`, no site shell - `stationBare` in `app/layout.js`). It uses only the public API
(`/api/public-kiosk/models`, `/register`) - never `/api/dresses`, `/api/settings`, `/api/employees`, and has no lock / fullscreen / "back to system" / employee code / AI.
`kiosk_public_link_enabled` off = "העמדה אינה זמינה"; `kiosk_public_show_inventory` off = catalog without dates / availability / quantities;
`kiosk_public_show_registration` off = no "מילוי פרטים אישיים" card (on = `KioskRegistration mode="public"`, `config.registration` -> `rules`).


### מדדי המרה (`/admin/station-analytics`)

הקישור הציבורי שולח שלוש ספירות אנונימיות (`POST /api/public-kiosk/event`: `visit` / `availability` / `form_start`, מזהה סשן אקראי ב-`sessionStorage`, בלי IP / User-Agent / PII), והרישום (`/register`) כותב אירוע `register` עם `customerId` פנימי.
הכול נשמר בטבלה `StationEvent` (SQL ידני: `scripts/station_event_table.sql`, **לא הורץ בפרודקשן**; בלעדיה האיסוף מדלג והמסך מסביר). מסך הניהול, ההגדרות המדויקות של "מילאו פרטים" / "סגרו הזמנה", הפרטיות והבדיקות: [docs/station-analytics.md](docs/station-analytics.md).
