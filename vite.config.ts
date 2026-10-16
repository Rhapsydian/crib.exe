import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  // Reachable from other devices on the local network, so the UI can be
  // tested on a phone during development (docs/playable-design.md P3).
  server: { host: true },
  test: {
    environment: 'node',
    include: ['src/engine/**/*.test.ts'],
  },
})
