/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'prisma'],
    outputFileTracingIncludes: {
      '/api/**/*': ['./prisma/dev.db'],
    },
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
