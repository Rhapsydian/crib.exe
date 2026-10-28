import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { execSync } from 'node:child_process'
import pkg from './package.json' with { type: 'json' }

// The commit the game was built from, shown on the About page so a
// tester's report says exactly which build they played (the version
// isn't bumped for every fix).
function commit(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  // The game's version, from package.json, for the main menu and bug
  // reports (go-live step 1: 0.9.0 now, 1.0.0 at release).
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __APP_BUILD__: JSON.stringify(commit()) },
  // Relative asset paths, so the built game runs from any address: the
  // demo at https://cribexe.com (GitHub Pages; once under /crib.exe/), and
  // itch.io later.
  base: './',
  // Reachable from other devices on the local network, so the UI can be
  // tested on a phone during development (docs/archive/playable-design.md P3).
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
