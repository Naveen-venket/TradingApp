import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Same relative paths (/api/yahoo, /api/nse) that the deployed app
      // hits on Vercel — see api/yahoo/[...path].ts and api/nse/[...path].ts.
      // Here in local dev, Vite's proxy does the job instead of a real
      // serverless function.
      "/api/yahoo": {
        target: "https://query1.finance.yahoo.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yahoo/, ""),
      },
      "/api/nse": {
        target: "https://archives.nseindia.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nse/, ""),
      },
    },
  },
})
