/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3', 'grammy'],
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] },
  },
  async redirects() {
    return [
      // Web
      { source: '/charges/:rest*',    destination: '/owed/:rest*',          permanent: true },
      { source: '/payments/:rest*',   destination: '/received/:rest*',      permanent: true },
      { source: '/deposits',          destination: '/received?tab=guests',  permanent: true },
      { source: '/spendings/:rest*',  destination: '/spent/:rest*',         permanent: true },
      { source: '/members/:rest*',    destination: '/people/:rest*',        permanent: true },
      { source: '/guests/deposits',   destination: '/received?tab=guests',  permanent: true },
      { source: '/guests',            destination: '/people?tab=guests',    permanent: true },
      { source: '/info',              destination: '/handbook',             permanent: true },
      { source: '/dashboard/history', destination: '/history',              permanent: true },
      // Mini
      { source: '/mini/charges/:rest*',    destination: '/mini/owed/:rest*',          permanent: true },
      { source: '/mini/payments/:rest*',   destination: '/mini/received/:rest*',      permanent: true },
      { source: '/mini/deposits',          destination: '/mini/received?tab=guests',  permanent: true },
      { source: '/mini/spendings/:rest*',  destination: '/mini/spent/:rest*',         permanent: true },
      { source: '/mini/members/:rest*',    destination: '/mini/people/:rest*',        permanent: true },
      { source: '/mini/guests/deposits',   destination: '/mini/received?tab=guests',  permanent: true },
      { source: '/mini/guests',            destination: '/mini/people?tab=guests',    permanent: true },
      { source: '/mini/info',              destination: '/mini/handbook',             permanent: true },
    ];
  },
};
export default nextConfig;
