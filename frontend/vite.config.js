import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: process.env.VITE_HOST || 'localhost',
    port: parseInt(process.env.VITE_PORT) || 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_HOST || 'http://localhost:3000',
        changeOrigin: true,
      },
      '/health': {
        target: process.env.VITE_API_HOST || 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  }
})
