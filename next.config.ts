/** @type {import('next').NextConfig} */
const nextConfig = {
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
  // Avoid issues with @babel/core
  experimental: {
    instrumentationHook: false
  }
};

export default nextConfig;
