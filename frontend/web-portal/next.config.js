/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',  // required for Docker multi-stage build
  // Leaflet uses window — suppress SSR for map components via dynamic()
  webpack: (config) => {
    config.resolve.alias['leaflet$'] = 'leaflet/dist/leaflet-src.esm.js';
    return config;
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000/ws',
    NEXT_PUBLIC_FABRIC_MODE: process.env.NEXT_PUBLIC_FABRIC_MODE || 'mock',
    NEXT_PUBLIC_MAP_CENTER_LAT: process.env.NEXT_PUBLIC_MAP_CENTER_LAT || '28.5706',
    NEXT_PUBLIC_MAP_CENTER_LNG: process.env.NEXT_PUBLIC_MAP_CENTER_LNG || '77.5413',
    NEXT_PUBLIC_MAP_ZOOM: process.env.NEXT_PUBLIC_MAP_ZOOM || '12',
  },
};

module.exports = nextConfig;
