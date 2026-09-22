// Builds the React SPA bundle into public/static/app.js — Vercel serves
// public/ directly as static output (see vercel.json), no further bundling.
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
