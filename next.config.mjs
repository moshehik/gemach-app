/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@prisma/client', 'prisma'],

  // עמדות ברשת המקומית ניגשות לשרת דרך ה-IP של המחשב ולא דרך localhost.
  // בלי זה Next 16 חוסם (403) משאבי dev כמו ה-websocket של רענון חי.
  allowedDevOrigins: ['10.0.0.2', '10.0.0.2:3000', 'localhost:3000', '127.0.0.1', '127.0.0.1:3000'],
  // eslint: {
  //   ignoreDuringBuilds: true,
  // },
};

export default nextConfig;
