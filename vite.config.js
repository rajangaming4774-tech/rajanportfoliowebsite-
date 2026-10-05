import process from 'node:process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Preview tooling assigns a free port via PORT.
    port: Number(process.env.PORT) || 5174,
    // The project lives in OneDrive, whose sync can hide file changes from the
    // native watcher (the dev server then serves stale code). Polling is reliable.
    watch: { usePolling: true, interval: 300 },
  },
  build: {
    // The physics engine bundles its wasm (~3 MB) and loads only with the 3D world.
    chunkSizeWarningLimit: 3500,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[/\\](react|react-dom|scheduler)[/\\]/, priority: 40 },
            { name: 'rapier', test: /node_modules[/\\]@dimforge/, priority: 30 },
            { name: 'three', test: /node_modules[/\\]three[/\\]/, priority: 20 },
          ],
        },
      },
    },
  },
})
