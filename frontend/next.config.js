/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable static export for production deployment
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  reactStrictMode: true
}

module.exports = nextConfig
