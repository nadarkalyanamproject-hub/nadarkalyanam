import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@nadar-kalyanam/ui', '@nadar-kalyanam/schemas'],
  async redirects() {
    return [
      // The Matches category pages moved to Search (/search?category=<slug>);
      // old links and bookmarks land on the same category there.
      {
        source: '/matches/:category',
        destination: '/search?category=:category',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
