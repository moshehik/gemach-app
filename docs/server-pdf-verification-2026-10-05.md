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
* Fonts: the Lambda image has **no Hebrew font**. The pack ships only Open Sans (Latin/Greek/Cyrillic). The report HTML
  (`app/api/orders/[id]/email/route.js`) `@import`s David Libre / Frank Ruhl Libre from Google Fonts; `lib/pdf.js` allows exactly those two hosts
  in html mode. If the function cannot reach Google Fonts the PDF would be produced with empty boxes instead of Hebrew.

## 2. Most probable defect (a guess - ranked)

1. **Chromium starts and dies immediately (exit 127 / signal) on the Vercel host.** Candidate mechanisms, all of which the new launcher either removes
   or makes visible:
   * the child not seeing `LD_LIBRARY_PATH=/tmp/al2023/lib` (we now pass `env` to `puppeteer.launch` explicitly);
   * `chromium.executablePath()` returning early because `/tmp/chromium` exists while the companion archives (`al2023`, `swiftshader`, `fonts`)
     were never/partially extracted - a warm instance, an interrupted first extraction, or two concurrent first requests (we now re-inflate missing
     companions and delete a truncated `/tmp/chromium`);
   * a read-only/missing `HOME` (we pass a writable one);
   * the GPU path (`--use-gl=angle --enable-unsafe-swiftshader --in-process-gpu` together with `--single-process`) crashing at start; a PDF needs no
     WebGL (we call `chromium.setGraphicsMode = false`);
   * the flag set itself (we retry once with a minimal Lambda-safe set before giving up).
2. A host/runtime incompatibility we cannot fix from the app (CPU feature, seccomp, ...). The new error detail will show it (`exit=`, `signal=`,
   `missingLibs=`), and the A5 card no longer depends on it (section 4).
3. Hebrew glyphs missing (not a launch failure - a quality failure that only shows once the launch works): see 5.

None of these is proven. The change is: make the launch as robust as the package allows, **and make the next failure self-explanatory**.

## 3. What changed

| File | Change |
|---|---|
| `lib/pdfServerless.js` (new) | Serverless launcher: stage-tagged errors; deletes a truncated `/tmp/chromium`; re-inflates missing `al2023`/`swiftshader`/`fonts` companions; `setGraphicsMode=false`; explicit child `env` (`LD_LIBRARY_PATH`, `FONTCONFIG_PATH`, writable `HOME`); `--disable-dev-shm-usage`; `dumpio` (Chromium's stderr goes to the function log); one retry with minimal flags (`FALLBACK_ARGS`); on total failure a probe runs the binary directly (`--version` exit code/signal/stderr, `LD_TRACE_LOADED_OBJECTS=1` -> missing libraries) and the error message carries an environment fingerprint. Launch timeouts 20 s + 15 s (inside the route's 60 s). |
| `lib/pdf.js` | Uses the launcher; `import('puppeteer-core')` failures and every later step (`new-page`, `set-content`/`goto`, `print-pdf`) tag `err.pdfStage`. Local (Windows/macOS/Linux) behaviour unchanged - verified: a local Chrome render still returns `%PDF`. |
| `app/api/pdf/route.js` | 500 body is now `{ error, detail, stage }` (same first key, additive; `detail` capped at 1500 chars, message only, no stack). One structured `console.error('[pdf] generation failed', {stage, mode, htmlChars, message})` + the stack, so Vercel runtime logs show the cause. |
| `app/lib/pdfClient.js` | The thrown error is `"<Hebrew error> (<stage>: <first line of detail, <=160 chars>)"`; `error.detail` (full), `error.stage`, `error.status` are attached. Every caller that shows `e.message` now shows the real reason. |
| `app/components/order-card/parts/OcExports.js` + `ocDocsActions.js` (`openOrderPrintFallback`) | A5 order card "הורדה": if the server PDF fails, `/print/order?orderId=<id>&type=order` opens in a new tab (the page auto-opens the browser print dialog -> "שמירה כ-PDF") and a Hebrew toast says so. If the popup is blocked (the call happens seconds after the click) the toast offers a click-to-open button. `downloadOrderPdf` still rejects on failure, so nothing is logged as `ORDER_PDF_DOWNLOADED` for a failed download. Excel export untouched. |
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
   * **Failure:** status 500 and a JSON body `{error, detail, stage}`. **Copy the whole body** - `detail` ends with an environment fingerprint, e.g.
     `node=v24.x vercel=1 exec=AWS_Lambda_nodejs24.x chromium=199908472B libnss3=ok swiftshader=ok fonts=ok --version="..." exit=127 missingLibs=libXXX.so`.
2. **curl variant** (cookie copied from the browser's DevTools, `auth_token`/`auth_session`):
   `curl -s -X POST https://<preview-url>/api/pdf -H 'Content-Type: application/json' -H 'Cookie: <cookies>' -d '{"html":"<h1>hi</h1>"}' -o out.pdf -w '%{http_code} %{size_download}\n'; head -c 8 out.pdf` -> expect `200`, `%PDF-1.`.
   (Vercel Deployment Protection may require the bypass cookie/header on previews.)
3. **Runtime logs** (Vercel dashboard -> project -> Logs -> filter path `/api/pdf`, or `vercel logs <deployment-url>`): search for
   `[pdf] generation failed` (one JSON line with `stage` + `message`) followed by the stack, and for lines from Chromium itself (`dumpio`)
   such as `DevTools listening on ...` (launch OK) or loader/crash messages. **Hobby keeps logs for about an hour - read them right after the test.**
4. **In the app (A5 order card):** open an order, press "הורדה". If the server PDF works, a file `הזמנה <id>.pdf` downloads and an
   `ORDER_PDF_DOWNLOADED` row appears in the order history. If it does not, a new tab opens `/print/order?...` and the print dialog appears
   (pop-ups must be allowed, otherwise the toast shows an "פתיחת דף הדפסה" button).
5. **Hebrew check** (only after step 1 succeeds): download a real order PDF and open it - Hebrew must be real glyphs (David Libre / Frank Ruhl Libre),
   not boxes. If boxes: Google Fonts was not reachable from the function; see section 5.
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
* **Hebrew font robustness:** a PDF that renders with boxes would be a silent quality bug. If Google Fonts is slow/blocked from the function, bundle an OFL Hebrew font
  (Heebo / Noto Sans Hebrew / David Libre `.ttf`) under `/fonts` in the repo (`fonts.conf` of the pack already scans `/var/task/fonts`), add it to
  `outputFileTracingIncludes` for `/api/pdf`, and name it in the report CSS. Not done: needs a font file the owner approves and downloads (no redistributable Hebrew font is in the repo or `node_modules`).
* `page.setContent(..., { waitUntil: 'networkidle0' })` in html mode waits for the Google Fonts requests; if they hang it fails after 30 s (then the card falls back to the print page).
* Function memory: Hobby fixes it (2 GB with Fluid compute); the package recommends >= 1.6 GB. No `vercel.json` change was made.
* Warm instances reuse one Chromium (singleton in `lib/pdf.js`); under concurrent requests on one instance Chromium in `--single-process` mode can be fragile - if
  intermittent `Target closed` errors appear after the first success, serialise `renderPdf` calls (a small promise queue) - not done because it is speculative.
