import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/test/**/*.test.ts', 'src/test/**/*.test.tsx'],
    globals: true,
    // The jsdom dependency chain (html-encoding-sniffer@6 -> @exodus/bytes) loads ESM via CJS
    // require(); Node <22.12 disables require(esm) by default, so enable it explicitly via
    // worker execArgv to keep local (Node 22.11) and CI (Node 22 latest, flag on by default
    // with no side effects) behavior consistent.
    poolOptions: {
      forks: {
        execArgv: ['--experimental-require-module'],
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
