import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  // Relative asset paths, so the built game runs from any address: the
  // demo at https://cribexe.com (GitHub Pages; once under /crib.exe/), and
  // itch.io later.
  base: './',
  // Reachable from other devices on the local network, so the UI can be
  // tested on a phone during development (docs/playable-design.md P3).
  server: { host: true },
  test: {
    environment: 'node',
    include: ['src/engine/**/*.test.ts', 'src/ui/**/*.test.ts'],
    // Many tests play whole runs; GitHub's runners are slower than a dev
    // machine and timed them out at Vitest's 5s default (session 58).
    testTimeout: 30_000,
  },
})
