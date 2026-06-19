/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Leaflet uses window — suppress SSR for map components via dynamic()
  webpack: (config) => {
    config.resolve.alias['leaflet'] = 'leaflet/dist/leaflet-src.esm.js';
    return config;
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000/ws',
    NEXT_PUBLIC_FABRIC_MODE: process.env.NEXT_PUBLIC_FABRIC_MODE || 'mock',
  },
};

module.exports = nextConfig;
