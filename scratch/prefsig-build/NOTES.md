# GQ-01b - signed designPrefs_<id> cookie (branch feature/ui-design-prefs-cookie-hmac-2026-10-04)

## Design
- Cookie `designPrefs_<authToken.value>`: `dp1.<base64url(JSON)>.<base64url(HMAC-SHA256)>`.
  - payload `{ v:1, p:{palette,font,density,textScale,customColors,uiVariants}, iat, exp }` (exp = 90 days; value ~300-650 chars).
  - HMAC key = HMAC(AUTH_SECRET, 'gemach/designPrefs-cookie/v1') (domain separation: an `auth_session` token is not a valid prefs cookie).
  - MAC input = `dp1 \n <employeeKey> \n <body>`: bound to the employee (key = verified auth_token value = the cookie-name suffix) and to the format version.
  - `timingSafeEqual`; never throws; no logging of secret/values.
- Invalid anything (absent, legacy unsigned JSON, bad signature, other employee, other version, expired, no AUTH_SECRET) = "no cookie":
  defaults, no error (`readDesignPrefsFromCookie` -> null).
- Only the SERVER writes it, and only from DB (`Employee.themeColor`), never from client input. httpOnly (no client code read it), SameSite=Lax, Secure in prod.
- Legacy unsigned cookies: ignored; `GET /api/me/design-prefs` (called by DesignPrefsSync on every full page load) rebuilds a signed cookie from the DB
  (or deletes the stale one if the DB has nothing for the cookie). Response header `x-design-prefs-cookie: rebuilt` tells the client it was rebuilt;
  if the worker has uiVariants overrides, DesignPrefsSync reloads once per tab session (sessionStorage guard) because that load's SSR used defaults.
- Refresh policy (`planDesignPrefsCookie`): none when valid + same content + more than half life left; set when content differs or half-life passed;
  delete when DB has nothing to put in it.

## Files
- NEW `lib/designPrefsSig.js` (pure ESM core: sign/verify/plan), NEW `app/lib/designPrefsCookie.js` (Next glue: readSignedDesignPrefs, syncDesignPrefsCookie).
- Readers verify: `app/layout.js`, `app/lib/uiVariantServer.js` (the only two readers of the cookie).
- Writers: `app/api/me/design-prefs/route.js` (GET rebuild/refresh, PUT after change), `app/lib/uiVariantRoute.js` (POST /api/me/ui-variant/shell|home|... - the self-switch).
  display-settings and palette save call PUT (pushPrefsToServer) so its response refreshes the cookie; AutoClockSwitch/auto-clock-in never touched this cookie (autoClockIn is not a cookie field).
- Client: `app/lib/designPrefs.js` (removed writeDesignPrefsCookie / readCookieUiVariants), `app/components/DesignPrefsSync.js`, `app/display-settings/page.js` no longer write it.
- Tests: NEW `scripts/test_design_prefs_sig.mjs` (27: sign/verify, tamper, replay on another id, version bump dp2/v2, legacy unsigned, plan decisions, header size, timing-safe, wiring).
  Run and green: test_ui_variant (45), test_ui_variant_self_switch (34), test_page_variant_switch (30), test_menu_logic (105), test_home_css_guard (71), test_shell_endpoints (20), test_login_logic. eslint on touched files: clean.
- `theme_<id>` (display mode) stays client-written/unsigned on purpose: it grants nothing (light/dark/contrast).

## Behavioural changes to know
1. Display-settings no longer updates the SSR cookie instantly: it updates DOM + localStorage immediately and the cookie when the debounced (500ms) PUT returns.
2. Cookie key is now consistently `auth_token` value on both sides (before, DesignPrefsSync used employee.id, the layout used the auth_token value - differed for legacy numeric ids).
3. The cookie only carries DB values; a palette that lived only in a browser's localStorage + legacy cookie is migrated to the DB by DesignPrefsSync's existing one-time migration (PUT) - so nothing is lost, but only if DB prefs are empty.
4. Without AUTH_SECRET (local dev with no env) the cookie is not written/read -> default palette. Prod has the secret (login issues auth_session).

## Risks / rollout
- First page load after deploy for each worker: server-rendered with defaults (legacy cookie ignored), then DesignPrefsSync rebuilds; palette is re-applied client-side on that load (applyPrefsToDom);
  workers with uiVariants overrides get one automatic reload. Expect a one-time palette flash / reload per browser.
- Replay of the worker's OWN older signed cookie stays valid until the next sync overwrites it (max 90 days). It cannot give anything the DB never granted to that worker... except if the owner REMOVES an override
  in DB: the old signed cookie keeps it until the next DesignPrefsSync GET (every full page load) replaces it. Display flag only, not a permission boundary (unchanged: PageGate/checkAuth enforce).
- Rotating AUTH_SECRET invalidates all prefs cookies (rebuilt from DB on next load) and, as before, all auth sessions.
- Not browser-verified here (no dev server per instructions): recommend a manual check after deploy: login -> /display-settings change palette -> navigate (palette persists) ; shell toggle for a management user; edit the cookie in devtools -> ignored on next load.
- Deployed to both gemachs (shared code); no settings/DB changes, no DDL.
- Commits made via the repo pre-commit hook also bump app/version.json + package.json (expected).
