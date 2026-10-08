/** @type {import('next').NextConfig} */
const nextConfig = {
  // puppeteer-core and @sparticuz/chromium (used by app/api/pdf/route.js, lib/pdf.js) are
  // already in Next's own built-in serverExternalPackages default list as of Next 16, but
  // are listed explicitly here too - same as @prisma/client/prisma below - so PDF
  // generation doesn't silently break if that built-in list ever changes.
  serverExternalPackages: ['@prisma/client', 'prisma', 'puppeteer-core', '@sparticuz/chromium'],

  // @sparticuz/chromium loads its brotli-compressed Chromium binary from bin/ with
  // runtime fs calls, which Vercel's static file tracing can't see - without this the
  // deployed function is missing /var/task/node_modules/@sparticuz/chromium/bin entirely
  // and every PDF request 500s with "The input directory ... does not exist".
  // Every route that calls renderPdf (lib/pdf.js) needs the include - guarded by scripts/pdf-tests/server-pdf.test.mjs.
  // (Inferred 2026-10-05 from the size of the 6 logged production failures: they match "Failed to launch the browser process", i.e. these
  // files were probably in the function and the binary was extracted; see docs/server-pdf-verification-2026-10-05.md. Keep this include regardless.)
  outputFileTracingIncludes: {
    '/api/pdf': ['./node_modules/@sparticuz/chromium/bin/**/*'],
    '/api/admin/email-test': ['./node_modules/@sparticuz/chromium/bin/**/*'],
  },

  // עמדות ברשת המקומית ניגשות לשרת דרך ה-IP של המחשב ולא דרך localhost.
  // בלי זה Next 16 חוסם (403) משאבי dev כמו ה-websocket של רענון חי.
  allowedDevOrigins: ['10.0.0.2', '10.0.0.2:3000', 'localhost:3000', '127.0.0.1', '127.0.0.1:3000'],
  // דף A5 (עמוד הבית החדש) הוא קובץ סטטי ב-public/a5; מגישים אותו גם בכתובת /a5 (וגם /a5?page=dash)
  async rewrites() {
    // /landing = דף הנחיתה (דוגמית עיצוב מונפשת של עמוד הבית, נתוני דמה), קובץ סטטי ב-public/landing
    return [{ source: '/a5', destination: '/a5/index.html' }, { source: '/landing', destination: '/landing/index.html' }];
  },
  // eslint: {
  //   ignoreDuringBuilds: true,
  // },
};

export default nextConfig;
