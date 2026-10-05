# Server-side PDF (`POST /api/pdf`) - what was changed and how to verify it on a Vercel preview (2026-10-05)

Status: **NOT verified on Vercel.** Everything below was done from a Windows machine; Vercel's Linux runtime (Amazon Linux 2023, Node 24)
cannot be run here. This document says what is known, what is a guess, and exactly how to find out.

## 1. What is known

* Production audit: all 6 logged `/api/pdf` calls since 2026-08-24 (both gemachs) returned a **172-byte JSON error after 4-6 s**. Zero
  `ORDER_PDF_DOWNLOADED` rows ever.
* `app/api/pdf/route.js` has returned `{ error: 'יצירת ה-PDF נכשלה', detail: <err.message> }` on a render failure since 2026-08-06
  (`cde71b47`). The Hebrew `error` is 54 bytes of JSON with an empty detail, so `detail` was about **120 bytes**.
* That size matches puppeteer's launch-failure message almost exactly: `Failed to launch the browser process:  Code: NNN\n\nstderr:\n<last lines>\n\nTROUBLESHOOTING: https://pptr.dev/troubleshooting\n`
  (= 168 bytes of JSON for "Code: 127" with empty stderr). The message comes from `@puppeteer/browsers` `launch.js` (`waitForLineOutput`).
* The 4-6 s fits "cold function inflates `chromium.br` (190 MB uncompressed, measured here: 1.8 s on a fast SSD) and then the process dies".
  A missing `bin/` directory would instead throw `The input directory "..." does not exist. If you are using a bundler ...` (~250 chars) after
  well under a second of work - that does **not** fit 120 bytes. So the old "bin not traced into the function" theory is the least likely one.
  (The `outputFileTracingIncludes` entry for `/api/pdf` was already there and matches Next 16.2.10's matcher: `collect-build-traces.js`
  normalises `app/api/pdf/route` to `/api/pdf` and applies the glob from `process.cwd()`.)
* **Caveat:** puppeteer builds that error message from the recent-log buffer synchronously on the child's `exit` event while stderr lines are
  still delivered asynchronously, so an "empty stderr" in the message does not prove Chromium printed nothing. `Code: 127` (the dynamic
  linker's "cannot load library" exit status) with the loader message not yet delivered is a classic outcome of exactly that race.
* Static checks of the installed package (`@sparticuz/chromium` 149.0.0, Chromium 149.0.7827.22):
  * the extracted ELF needs only `libdl libpthread libnspr4 libnss3 libnssutil3 libm libexpat libgcc_s libc` and GLIBC <= 2.25; the
    nss/nspr/expat libraries ship in `bin/al2023.tar.br` (extracted to `/tmp/al2023/lib`), glibc 2.34 on AL2023 satisfies the rest;
  * the package detects Vercel itself (`VERCEL` + Node >= 20 -> AL2023 mode, prepends `/tmp/al2023/lib` to `LD_LIBRARY_PATH` at import);
  * `tar-fs`, `streamx`, `bare-*` runtime dependencies are installed; the four archives are in `bin/` (65 MB + 15 + 3 + 0.2 MB inflated to
    ~210 MB in `/tmp`, under Vercel's 500 MB `/tmp`).
* Fonts: the Lambda image has no system fonts, but the pack's bundled Open Sans (Regular/Bold/Italic, extracted and checked with fontTools) **does contain the
  Hebrew block** (45 glyphs: all letters, niqqud, shekel sign). The report HTML (`app/api/orders/[id]/email/route.js`) `@import`s David Libre / Frank Ruhl Libre
  from Google Fonts; `lib/pdf.js` allows exactly those two hosts in html mode. If the function cannot reach Google Fonts, Hebrew falls back to Open Sans
  (a sans face instead of the serif design) - ugly-but-readable, no empty boxes.

## 2. Most probable defect (a guess - ranked)

1. **Chromium starts and dies immediately (exit 127 / signal) on the Vercel host.** Candidate mechanisms, all of which the new launcher either removes
   or makes visible:
   * the child not seeing `LD_LIBRARY_PATH=/tmp/al2023/lib` (we now pass `env` to `puppeteer.launch` explicitly);
   * `chromium.executablePath()` returning early because `/tmp/chromium` exists while the companion archives (`al2023`, `swiftshader`, `fonts`)
     were never/partially extracted - a warm instance, an interrupted first extraction, or two concurrent first requests (we now re-inflate missing
     companions and delete a truncated `/tmp/chromium`);
   * a read-only/missing `HOME` (we pass a writable one);
   * the GPU path (`--use-gl=angle --enable-unsafe-swiftshader --in-process-gpu` together with `--single-process`) crashing at start; a PDF needs no
     WebGL (attempt 1 uses `chromium.setGraphicsMode = false`);
   * the flag set itself: attempt 2 deliberately differs from attempt 1 - **graphics on and without `--single-process`** (the rest of the README flag set unchanged).
     Reading the two outcomes: attempt 2 starts -> the single-process/GPU-off combination was the cause (and the PDF just works, slower to start); both die alike ->
     the binary / libraries / host are at fault and the diagnostics below say which.
2. A host/runtime incompatibility we cannot fix from the app (CPU feature, seccomp, ...). The new error detail will show it (`exit=`, `signal=`,
   `missingLibs=`), and the A5 card no longer depends on it (section 4).
3. Wrong Hebrew face (not a launch failure - a fidelity issue that only shows once the launch works): see 5.

None of these is proven. The change is: make the launch as robust as the package allows, **and make the next failure self-explanatory**.

## 3. What changed

| File | Change |
|---|---|
| `lib/pdfServerless.js` (new) | Serverless launcher: stage-tagged errors; deletes a `/tmp/chromium` whose size is not exactly the 149.0.0 binary (199,908,472 B, table `PACK`, re-measured against `node_modules` by the test) and re-inflates any companion archive (`al2023` libs, `swiftshader`, `fonts`) whose LAST file is missing/wrong-sized; explicit child `env` (`LD_LIBRARY_PATH`, `FONTCONFIG_PATH`, writable `HOME`); `--disable-dev-shm-usage`; `dumpio` (Chromium's stderr goes to the function log); attempt 1 = README flags, graphics off; attempt 2 = graphics on, no `--single-process`. Launch timeouts 15 s each. **Only after both fail**, a bounded probe runs (`--version` 3 s; the loader's `LD_TRACE_LOADED_OBJECTS` trace 3 s only if `--version` failed; a real `chromium --headless --no-sandbox --disable-gpu --dump-dom about:blank` start 5 s) and the error detail is `[fingerprint] \|\| attempt1: ... \|\| attempt2: ...`, fingerprint FIRST, total <= 1500 chars. Worst case (extract ~6 s + 2x15 s + 11 s probes) stays under the route's `maxDuration = 60`. |
| `lib/pdf.js` | Uses the launcher; `import('puppeteer-core')` failures and every later step (`new-page`, `set-content`/`goto`, `print-pdf`) tag `err.pdfStage`. Local (Windows/macOS/Linux) behaviour unchanged - verified: a local Chrome render still returns `%PDF`. |
| `app/api/pdf/route.js` | 500 body is now `{ error, detail, stage }` (same first key, additive; `detail` capped at 1500 chars, message only, no stack). One structured `console.error('[pdf] generation failed', {stage, mode, htmlChars, message})` + the stack, so Vercel runtime logs show the cause. |
| `app/lib/pdfClient.js` | The thrown error is `"<Hebrew error> (<stage>: <first line of detail, <=300 chars>)"` (the fingerprint is first, so exit/signal/missing libs survive the cut); `error.detail` (full), `error.stage`, `error.status` are attached. Every caller that shows `e.message` now shows the real reason. |
| `app/components/order-card/parts/OcExports.js` + `ocDocsActions.js` (`openOrderPrintFallback`) | A5 order card "הורדה": if the server PDF fails, `/print/order?orderId=<id>&type=order` opens in a new tab (the page auto-opens the browser print dialog -> "שמירה כ-PDF") and a Hebrew toast says so. Only for a server PDF failure (`e.stage` set or `e.status >= 500`); report-HTML fetch failures / expired session / offline keep their own error toast. The popup call happens seconds after the click and can be blocked, so the toasts last longer (`ui.toast(..., { ms })`: 9 s, or 15 s with a click-to-open button when blocked) - a blank tab opened at click time was rejected as too intrusive (focus steal on every download). `downloadOrderPdf` still rejects on failure, so nothing is logged as `ORDER_PDF_DOWNLOADED` for a failed download. Excel export untouched. |
| `next.config.mjs` | Added the same `@sparticuz/chromium/bin/**/*` tracing include for `/api/admin/email-test` (the only other route that calls `renderPdf`). `serverExternalPackages` and the `/api/pdf` include were already correct. |
| `scripts/pdf-tests/server-pdf.test.mjs` | Guards: tracing include for **every** route importing `lib/pdf`, externals, `--webpack` build, Node range, archives present, pure launcher helpers, fake-puppeteer retry/error paths, route/client detail plumbing, fallback helper, static checks. |

Not touched (frozen legacy card): `components/orders/OrderPrintMenu.js` / `LegacyOrderPage.js` still call `fetchPdfBase64` for the email-with-PDF flow;
they now simply receive a more informative `e.message` in their (console / alert) error path. They have no "download" button.

## 4. How to verify on a Vercel preview (do this before telling anyone it works)

Prerequisite: a preview deployment of this branch (the lead deploys - nothing was pushed or deployed from here). Use a user whose role has an order
page permission (`PDF_HTML_PAGE_KEYS` in `lib/printAccess.js`).

1. **Browser console on the preview, logged in:**
   ```js
   fetch('/api/pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ html: '<html dir="rtl"><body style="font-family:Arial"><h1>בדיקת PDF - שלום עולם</h1><p>Hello</p></body></html>', filename: 'probe' }) })
   .then(async r => { const b = await r.arrayBuffer(); console.log(r.status, r.headers.get('content-type'), b.byteLength, new TextDecoder().decode(b.slice(0, 8)));
                      if (!r.ok) console.log(new TextDecoder().decode(b)); });
   ```
   * **Success:** `200 application/pdf <several KB> %PDF-1.4`. First call is slow (cold: 5-10 s); run it a second time (warm, should be ~1-2 s).
   * **Failure:** status 500 and a JSON body `{error, detail, stage}`. **Copy the whole body** - `detail` STARTS with a fingerprint, e.g.
     `[start:exit=127 stderr="..." | version:none exit=127 | missingLibs=libXXX.so | chromium=199908472B mode=700 X_OK=yes elf=x64 | companions=ok | tmp=/tmp mount=...:rw,nosuid,... free=..MB | node=v24.x arch=x64 os=... pretty="Amazon Linux 2023" glibc=2.34 | mem=.../...MB cpus=.. | LD_LIBRARY_PATH=... | envKeys=<names only> | ls(/tmp)=... | ls(al2023/lib)=... | ms:extract=.. launch1=.. launch2=..] || attempt1(...): ... || attempt2(...): ...`.
     What to look at first: `start:` (the direct start probe: exit code / signal / stderr), `missingLibs`, `elf=` (x64 expected), `mount=` (a `noexec` flag would explain exit 126/EACCES), `companions=`.
2. **curl variant** (cookie copied from the browser's DevTools, `auth_token`/`auth_session`):
   `curl -s -X POST https://<preview-url>/api/pdf -H 'Content-Type: application/json' -H 'Cookie: <cookies>' -d '{"html":"<h1>hi</h1>"}' -o out.pdf -w '%{http_code} %{size_download}\n'; head -c 8 out.pdf` -> expect `200`, `%PDF-1.`.
   (Vercel Deployment Protection may require the bypass cookie/header on previews.)
3. **Runtime logs** (Vercel dashboard -> project -> Logs -> filter path `/api/pdf`, or `vercel logs <deployment-url>`): search for
   `[pdf] generation failed` (one JSON line with `stage` + `message`) followed by the stack, and for lines from Chromium itself (`dumpio`)
   such as `DevTools listening on ...` (launch OK) or loader/crash messages. **Hobby keeps logs for about an hour - read them right after the test.**
4. **In the app (A5 order card):** open an order, press "הורדה". If the server PDF works, a file `הזמנה <id>.pdf` downloads and an
   `ORDER_PDF_DOWNLOADED` row appears in the order history. If it does not, a new tab opens `/print/order?...` and the print dialog appears
   (pop-ups must be allowed, otherwise the toast shows an "פתיחת דף הדפסה" button).
5. **Hebrew check** (only after step 1 succeeds): download a real order PDF and open it - Hebrew must be real text in David Libre / Frank Ruhl Libre (serif).
   A sans face means Google Fonts was not reachable and Open Sans was used; see section 5.
6. Also try `POST /api/pdf` with `{ "path": "/print/order?orderId=<id>&type=order&downloadPdf=true" }` (path mode, Chromium loads the app's own page with the
   forwarded cookie) - the customer-card, attendance and schedule downloads use it.

## 5. What remains unverified / follow-ups

* That Chromium 149 actually starts on Vercel Node 24 with these settings - **unverified**; confidence that the new launcher fixes it: low-to-moderate
  (~35-45%): it removes several real ways for a silent start failure, but the root cause may be none of them. Confidence that the failure will now be
  **diagnosable in one attempt**: high.
* If step 1 shows `missingLibs=...` for something not in `al2023.tar.br`, or `signal=SIGILL/SIGSEGV`: the pack does not suit the host. Options then, in
  order of effort: pin an older `@sparticuz/chromium` that is known to run on Vercel Node 24 (the reports found online used 143.0.4 + puppeteer-core 24.35 on
  Vercel; 138 was the first release that detects Vercel, 143 added Node 24) - this changes `package.json`/lockfile, so it needs a normal `npm install` by the
  lead; or use `@sparticuz/chromium-min` with the hosted pack
  (`https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar`, same binary, so only useful for bundle-size/extraction problems);
  or an external HTML->PDF service. The browser print-dialog fallback already keeps the A5 card usable meanwhile.
* **Hebrew font fidelity:** if Google Fonts is slow/blocked from the function, Hebrew renders in the pack's Open Sans (readable, but not the serif design). To pin the
  design, bundle an OFL Hebrew font (David Libre / Frank Ruhl Libre `.ttf`) under `/fonts` in the repo (`fonts.conf` of the pack already scans `/var/task/fonts`), add it to
  `outputFileTracingIncludes` for `/api/pdf`. Not done: needs a font file the owner approves and downloads.
* `page.setContent(..., { waitUntil: 'networkidle0' })` in html mode waits for the Google Fonts requests; if they hang it fails after 30 s (then the card falls back to the print page).
* Function memory: Hobby fixes it (2 GB with Fluid compute); the package recommends >= 1.6 GB. No `vercel.json` change was made.
* Warm instances reuse one Chromium (singleton in `lib/pdf.js`); under concurrent requests on one instance Chromium in `--single-process` mode can be fragile - if
  intermittent `Target closed` errors appear after the first success, serialise `renderPdf` calls (a small promise queue) - not done because it is speculative.
