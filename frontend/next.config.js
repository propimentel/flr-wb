/** @type {import('next').NextConfig} */
const nextConfig = {
  // Note: 'output: export' is disabled for development to support API routes
  // Enable for production static builds if needed
  // output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  reactStrictMode: true
}

module.exports = nextConfig
