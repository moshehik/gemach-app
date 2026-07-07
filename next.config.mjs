/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@prisma/client', 'prisma'],
  outputFileTracingIncludes: {
    '/api/**/*': ['./prisma/dev.db'],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
