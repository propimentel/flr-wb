/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable static export for production deployment
  output: process.env.NODE_ENV === 'production' ? 'export' : undefined,
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  reactStrictMode: true,
  
  // API proxy for development
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:4000/api/:path*'
      }
    ]
  }
}

module.exports = nextConfig
