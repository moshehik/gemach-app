/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@prisma/client', 'prisma'],

  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
