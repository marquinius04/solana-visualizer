import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// In development:  run `vercel dev` (port 3000) instead of `vite` directly.
// `vercel dev` serves BOTH the Vite frontend AND the /api/* serverless functions
// on the same port, which is the recommended workflow.
//
// This proxy is only used as a fallback if you ever run plain `vite` separately.
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills(), // Fixes "Buffer is not defined" in browser
  ],
  server: {
    port: 5173,
    proxy: {
      // Forward /api/* to vercel dev on port 3000 when running `vite` standalone
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})