import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));

/**
 * Plain JavaScript on purpose. Next loads a TypeScript config through the
 * compiler API, and this project is on the TypeScript 7 compiler, which that
 * path does not yet support — `next build` dies with "Cannot read properties
 * of undefined (reading 'fileExists')" before it reaches any of our code.
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  /**
   * The engine under `src/` is Node ESM and imports siblings with a `.js`
   * extension that resolves to a `.ts` file. TypeScript handles that under
   * `moduleResolution: "bundler"`, but the bundler has to be told, or every
   * import inside the workflows fails to resolve at build time.
   */
  webpack: (config) => {
    /**
     * The `@/*` alias is declared in tsconfig, and Next usually reads it from
     * there. It did not resolve inside a dynamic route folder (`app/board/[id]`),
     * so it is stated here as well: one line, and it no longer depends on how
     * the config's paths are parsed.
     */
    config.resolve.alias = { ...config.resolve.alias, '@': ROOT };
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    /**
     * Do not watch what the app WRITES.
     *
     * `.cache` holds the job files, the rendered banners and Mastra's SQLite
     * database, and a run writes to all three — the job file on every single
     * stage event. The dev watcher saw those writes as source changes and
     * recompiled the server mid-run, which throws away the module state the
     * runner lives in; the job then came back as "the server restarted while
     * this was running". The data the app produces is not its source.
     */
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/node_modules/**', '**/.git/**', '**/.next/**', '**/.cache/**', '**/data/**'],
    };
    return config;
  },
  /**
   * Packages Next must require at runtime instead of bundling.
   *
   * Mastra and libsql load native bindings and resolve their own files at
   * runtime, and firebase-admin reaches for gRPC and for optional native
   * transports. A bundler cannot follow any of that and does not need to.
   */
  serverExternalPackages: [
    '@mastra/core', '@mastra/libsql', '@libsql/client', '@ai-sdk/google',
    'firebase-admin', '@google-cloud/firestore', '@grpc/grpc-js',
    /** Both load native binaries: the ONNX runtime and libvips. */
    'onnxruntime-node', 'sharp',
  ],
  /** No ESLint config in this project; the build should not invent one. */
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
