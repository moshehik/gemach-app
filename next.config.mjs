/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@prisma/client', 'prisma'],

  // עמדות ברשת המקומית ניגשות לשרת דרך ה-IP של המחשב ולא דרך localhost.
  // בלי זה Next 16 חוסם (403) משאבי dev כמו ה-websocket של רענון חי.
  allowedDevOrigins: ['10.0.0.2'],

  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
