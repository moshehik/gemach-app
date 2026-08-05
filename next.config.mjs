/** @type {import('next').NextConfig} */
const nextConfig = {
  // puppeteer-core and @sparticuz/chromium (used by app/api/pdf/route.js, lib/pdf.js) are
  // already in Next's own built-in serverExternalPackages default list as of Next 16, but
  // are listed explicitly here too - same as @prisma/client/prisma below - so PDF
  // generation doesn't silently break if that built-in list ever changes.
  serverExternalPackages: ['@prisma/client', 'prisma', 'puppeteer-core', '@sparticuz/chromium'],

  // עמדות ברשת המקומית ניגשות לשרת דרך ה-IP של המחשב ולא דרך localhost.
  // בלי זה Next 16 חוסם (403) משאבי dev כמו ה-websocket של רענון חי.
  allowedDevOrigins: ['10.0.0.2', '10.0.0.2:3000', 'localhost:3000', '127.0.0.1', '127.0.0.1:3000'],
  // eslint: {
  //   ignoreDuringBuilds: true,
  // },
};

export default nextConfig;
