// Builds the React SPA bundle into public/static/app.js.
// Run BEFORE the worker build (see package.json "build" script) so the
// Cloudflare Pages build output (dist/) picks up the freshly built bundle
// when @hono/vite-build copies public/ into dist/.
import { defineConfig } from 'vite'

export default defineConfig({
  publicDir: false,
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  build: {
    outDir: 'public/static',
    emptyOutDir: false,
    rollupOptions: {
      input: 'client/main.tsx',
      output: {
        entryFileNames: 'app.js',
        chunkFileNames: 'app-[hash].js',
        assetFileNames: '[name][extname]',
      },
    },
  },
})
