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
  // cannot be bundled. Turbopack copies an externalized package into
  // .next/node_modules without its dependencies, and under pnpm's strict
  // layout those dependencies only exist next to the real package inside
  // .pnpm/ - so they stop resolving from the copy and pdf-parse's
  // globalThis.DOMMatrix polyfill silently fails. Listing them here (and as
  // direct dependencies, which hoists them to the top of node_modules) keeps
  // them resolvable at runtime.
  serverExternalPackages: [
    '@inngest/next',
    'pdf-parse',
    'pdfjs-dist',
    '@napi-rs/canvas',
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;