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
