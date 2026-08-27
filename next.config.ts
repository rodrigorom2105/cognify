import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  // pdf-parse is externalized because @napi-rs/canvas is a native module and
  // cannot be bundled.
  serverExternalPackages: [
    '@inngest/next',
    'pdf-parse',
    'pdfjs-dist',
    '@napi-rs/canvas',
  ],

  // pdfjs polyfills globalThis.DOMMatrix from @napi-rs/canvas when running on
  // Node, and only warns if that require() fails - then throws at module scope
  // on `new DOMMatrix()`. File tracing does not follow that runtime require,
  // so the package and its native .node binary never reach the serverless
  // bundle and every PDF job dies with "DOMMatrix is not defined". Pull them
  // in explicitly.
  outputFileTracingIncludes: {
    '/api/inngest': [
      './node_modules/@napi-rs/canvas/**',
      './node_modules/.pnpm/@napi-rs+canvas*/node_modules/@napi-rs/**',
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;