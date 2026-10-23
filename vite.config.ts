import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Relative base so the build works under any GitHub Pages sub-path (e.g. /uml-editor/).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: { chunkSizeWarningLimit: 1000 },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
