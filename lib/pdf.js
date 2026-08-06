// Server-side HTML -> PDF rendering via headless Chromium (Puppeteer). This is the single
// PDF-generation mechanism for the app now - see app/api/pdf/route.js for the route that
// exposes it. It replaces three previously-inconsistent, client-side, image-based
// mechanisms (app/lib/htmlToPdf.js's html-to-image+jsPDF, and html2pdf.js used inline in
// app/print/alterations/page.js) - neither produced real, paginated, selectable-text PDFs;
// both rasterized the DOM to a PNG and embedded that single image into a PDF.
//
// Two Chromium sources, chosen by environment:
// - On Vercel/AWS Lambda (serverless): @sparticuz/chromium's bundled, Linux-only Chromium
//   binary, launched via puppeteer-core (no full Chromium download needed in the function
//   bundle - Vercel's serverless function bundle limit is 5GB as of 2026-06-30, which
//   comfortably fits the ~40MB brotli-compressed binary, so the full package is used here
//   rather than the -min variant that needs a separately-hosted binary download).
// - Locally (this app is developed on Windows, but this also covers macOS/Linux dev
//   machines): @sparticuz/chromium's binary is Linux-only and won't execute here, so
//   puppeteer-core is pointed at a real, locally installed Chrome/Edge instead - see
//   findLocalChromeExecutable() below.
//
// The browser instance is a singleton reused across invocations within the same server
// process - free on `next dev` (one long-lived process) and helps warm Vercel serverless
// invocations skip the ~1-2s Chromium launch. Every call path here also has to work
// correctly on a cold invocation with no prior browser, since Vercel does not guarantee
// warm reuse between invocations.

import fs from 'fs';

const IS_SERVERLESS = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

const LOCAL_CHROME_CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROME_PATH,
  // Windows
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  // macOS
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  // Linux
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean);

function findLocalChromeExecutable() {
  for (const candidate of LOCAL_CHROME_CANDIDATES) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // keep checking the rest of the candidates
    }
  }
  return null;
}

let browserPromise = null;

async function launchBrowser() {
  const puppeteer = (await import('puppeteer-core')).default;

  if (IS_SERVERLESS) {
    const chromium = (await import('@sparticuz/chromium')).default;
    return puppeteer.launch({
      args: await puppeteer.defaultArgs({ args: chromium.args, headless: 'shell' }),
      defaultViewport: { width: 1240, height: 1754, deviceScaleFactor: 1 },
      executablePath: await chromium.executablePath(),
      headless: 'shell',
    });
  }

  const executablePath = findLocalChromeExecutable();
  if (!executablePath) {
    throw new Error(
      'לא נמצא דפדפן Chrome/Edge מותקן מקומית ליצירת PDF. התקן Google Chrome או Microsoft Edge, ' +
      'או הגדר את משתנה הסביבה PUPPETEER_EXECUTABLE_PATH לנתיב קובץ ההרצה שלו.'
    );
  }
  // dumpio forwards Chrome's own stdout/stderr into this process's, which as a side
  // effect keeps those pipes actively drained. Without it, on this Windows setup Chrome's
  // stderr can fill its pipe buffer and block before puppeteer reads the "DevTools
  // listening on..." readiness line, which puppeteer's Windows fallback then misreports as
  // "The browser is already running for <dir>" even on a freshly created, unused profile
  // directory - confirmed by reproducing the failure locally and seeing it disappear once
  // dumpio was enabled.
  return puppeteer.launch({ executablePath, headless: true, dumpio: true });
}

// Returns a shared, already-launched browser instance. A rejected launch is not cached -
// the next call gets to retry with a fresh launch instead of failing forever until restart.
async function getBrowser() {
  if (!browserPromise) {
    browserPromise = launchBrowser().catch((err) => {
      browserPromise = null;
      throw err;
    });
  }
  const browser = await browserPromise;
  // A previously-returned browser can have died since (e.g. a warm serverless instance's
  // Chromium process got killed underneath us) - detect that and relaunch rather than
  // failing every request until the whole function cold-starts again.
  if (!browser.connected) {
    browserPromise = null;
    return getBrowser();
  }
  return browser;
}

/**
 * Renders either a raw HTML string or an absolute URL to a PDF buffer using a real
 * headless-browser print pipeline (real text, real pagination via @page CSS) - not a
 * rasterized image embedded in a single-page PDF like the old client-side mechanisms.
 *
 * @param {object} opts
 * @param {string} [opts.html] - Full HTML document string to render via page.setContent().
 * @param {string} [opts.url] - Absolute URL to render via page.goto() (e.g. this app's own
 *   /print/alterations page). Exactly one of html/url must be given.
 * @param {string} [opts.cookieHeader] - Raw `Cookie:` header value to forward to the page
 *   before navigating, so an auth-cookie-gated page (checkAuth() in lib/auth.js) renders the
 *   real data instead of a 401, exactly as it would in the caller's own browser tab.
 * @param {boolean} [opts.landscape=false]
 * @param {string} [opts.format='A4']
 * @returns {Promise<Buffer>}
 */
export async function renderPdf({ html, url, cookieHeader, landscape = false, format = 'A4' } = {}) {
  if (!html && !url) {
    throw new Error('renderPdf requires either html or url');
  }

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    if (url && cookieHeader) {
      const target = new URL(url);
      const cookies = cookieHeader
        .split(';')
        .map((pair) => {
          const idx = pair.indexOf('=');
          if (idx === -1) return null;
          return {
            name: pair.slice(0, idx).trim(),
            value: pair.slice(idx + 1).trim(),
            domain: target.hostname,
            path: '/',
          };
        })
        .filter(Boolean);
      if (cookies.length) await page.setCookie(...cookies);
    }

    if (html) {
      await page.setContent(html, { waitUntil: 'networkidle0' });
    } else {
      // 60s and not less: the alterations report's backing query can take 45s+ on a
      // cold hit for a month-wide range, and networkidle0 only settles after it returns.
      // Matches the route's maxDuration = 60.
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
      // The print pages fetch their data client-side after mount (app/print/order,
      // app/print/alterations) - they mark data-print-ready="true" on their root
      // container once loading+rendering is actually done. networkidle0 alone can fire a
      // tick before React finishes committing that last render, so wait for the explicit
      // marker too (best-effort: if a page doesn't set it for some reason, fall back to
      // whatever networkidle0 already gave us rather than failing the whole request).
      await page.waitForSelector('[data-print-ready="true"]', { timeout: 15000 }).catch(() => {});
    }

    const pdfOptions = {
      format,
      landscape,
      printBackground: true,
      preferCSSPageSize: true,
    };
    // Only the html path (no @page CSS defined in that markup) needs an explicit margin -
    // the actual print pages define their own @page margin and preferCSSPageSize respects
    // it, so setting margin here too would silently override that CSS-defined margin.
    if (html) {
      pdfOptions.margin = { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' };
    }

    return await page.pdf(pdfOptions);
  } finally {
    await page.close().catch(() => {});
  }
}
