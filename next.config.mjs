/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] },
    // Required so better-sqlite3 (native bindings) and grammy load correctly in server components
    serverComponentsExternalPackages: ['better-sqlite3', 'grammy'],
  },
};
export default nextConfig;
