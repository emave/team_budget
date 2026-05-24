/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3', 'grammy'],
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] },
  },
};
export default nextConfig;
