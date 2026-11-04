import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const requireFromApp = createRequire(fileURLToPath(new URL('./package.json', import.meta.url)))

// Resolve a path relative to this config file.
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

// The desktop renderer references itself via `@/...` and `@hermes/shared`.
// Point those at the live workspace source so the phone runs that UI unmodified.
export default defineConfig(({ command }) => ({
  base: './',
  plugins: [react(), tailwindcss()],
  css: {
    postcss: { plugins: [] },
  },
  resolve: {
    alias: [
      {
        find: '@/debug/dev-only',
        replacement:
          command === 'serve'
            ? r('../desktop/src/debug/dev-only.ts')
            : r('../desktop/src/debug/dev-only.noop.ts'),
      },
      { find: '@', replacement: r('../desktop/src') },
      { find: '@hermes/plugin-sdk', replacement: r('../desktop/src/sdk/index.ts') },
      { find: '@hermes/shared/billing', replacement: r('../shared/src/billing-types.ts') },
      { find: '@hermes/shared/color', replacement: r('../shared/src/color.ts') },
      { find: '@hermes/shared', replacement: r('../shared/src') },
      {
        find: 'driver.js/dist/driver.js.iife.js?raw',
        replacement: `${path.join(path.dirname(requireFromApp.resolve('driver.js')), 'driver.js.iife.js')}?raw`,
      },
      {
        find: 'driver.js/dist/driver.js.iife.js',
        replacement: path.join(path.dirname(requireFromApp.resolve('driver.js')), 'driver.js.iife.js'),
      },
      { find: '~mobile', replacement: r('./src/mobile') },
      { find: '~bridge', replacement: r('./src/bridge') },
    ],
    dedupe: ['react', 'react-dom', 'react-router', '@tanstack/react-query'],
  },
  server: {
    host: '127.0.0.1',
    port: 5180,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 25000,
  },
}))
