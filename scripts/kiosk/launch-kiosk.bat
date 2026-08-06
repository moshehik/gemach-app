@echo off
REM ============================================================================
REM  launch-kiosk.bat
REM
REM  Launches the customer-facing dress catalog (app/customer-interface) in a
REM  real OS-level kiosk window: no address bar, no tabs, no window chrome,
REM  and Alt+Tab / Windows-key app switching disabled by Chrome/Edge itself
REM  while the window is focused.
REM
REM  This is meant to be the ONLY thing that runs on the customer-facing
REM  machine. See KIOSK.md in the repo root for full setup + exit instructions.
REM ============================================================================

REM --- 1. Set this to the real URL of the app on the customer-facing machine ---
REM     Use the deployed/production URL if this machine reaches it over the
REM     network, or a local dev/start URL if the app runs on this same machine.
set KIOSK_URL=https://gemach-app-uyh4-beryl.vercel.app/customer-interface

REM --- 2. Isolated browser profile for the kiosk session -----------------------
REM     Keeps this separate from any personal Chrome/Edge profile on the
REM     machine (no shared history/bookmarks/passwords), and resets any state
REM     (autofill, cached forms, etc.) if the folder is deleted.
set KIOSK_PROFILE=%LOCALAPPDATA%\GemachKioskProfile

REM --- 3. Locate a browser -------------------------------------------------------
set BROWSER=
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set BROWSER=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe
if "%BROWSER%"=="" if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe
if "%BROWSER%"=="" if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe

if "%BROWSER%"=="" (
  echo Could not find Chrome or Edge in the usual install locations.
  echo Edit this file and set BROWSER= to the full path of chrome.exe or msedge.exe.
  pause
  exit /b 1
)

REM --- 4. Launch in kiosk mode ---------------------------------------------------
REM   --kiosk                    real OS-level kiosk: fullscreen, no chrome, no Alt+Tab target
REM   --user-data-dir=...        isolated profile, see above
REM   --no-first-run             skip the "welcome" / default-browser screens
REM   --noerrdialogs             suppress crash/restore-session dialogs
REM   --disable-infobars         no "Chrome is being controlled..." banners
REM   --disable-session-crashed-bubble   no "restore pages?" prompt after a bad shutdown
REM   --overscroll-history-navigation=0  disable swipe-to-navigate-back gesture
REM   --disable-pinch            disable pinch-to-zoom (touchscreen kiosks)
"%BROWSER%" --kiosk "%KIOSK_URL%" --user-data-dir="%KIOSK_PROFILE%" --no-first-run --noerrdialogs --disable-infobars --disable-session-crashed-bubble --overscroll-history-navigation=0 --disable-pinch
