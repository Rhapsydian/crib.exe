import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import pkg from './package.json' with { type: 'json' }

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  // The game's version, from package.json, for the main menu and bug
  // reports (go-live step 1: 0.9.0 now, 1.0.0 at release).
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
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
    // machine and timed them out at Vitest's 5s default (session 58), and
    // proved more than 2x slower again in session 72 (a 60s test that took
    // 30s here failed there). Keep about 5x a test's local time.
    testTimeout: 120_000,
  },
})
