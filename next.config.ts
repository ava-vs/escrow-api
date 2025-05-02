/** @type {import('next').NextConfig} */
const nextConfig = {
  // Note: output: 'standalone' removed due to symlink permissions issues on Windows
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        search: ''
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
        search: ''
      }
    ]
  },
  // Required for Swagger UI to work with React 19
  transpilePackages: [
    'swagger-ui-react',
    'swagger-client',
    'react-syntax-highlighter',
    'react-inspector',
    'react-copy-to-clipboard',
    'react-debounce-input'
  ],
  // Experimental options for Next.js
  experimental: {
    // instrumentationHook option removed - no longer needed in Next.js 15+
  },
  
  // Configure CORS headers for API routes
  async headers() {
    return [
      {
        // matching all API routes
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization" },
        ]
      }
    ];
  }
};

export default nextConfig;
