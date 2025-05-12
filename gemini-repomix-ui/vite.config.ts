import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/repochat/',
  server: { // Add server configuration
    proxy: {
      // Proxy requests starting with /api (or choose another prefix)
      // to your backend server running on port 8003
      '/api': { // You can choose any prefix, e.g., '/backend-api'
        target: 'http://localhost:8003', // Target your backend server
        changeOrigin: true, // Recommended for virtual hosted sites
        // Optional: rewrite path if needed (but usually not if backend uses the same path)
        //rewrite: (path) => path.replace(/^\/api/, ''), // Remove /api prefix if backend doesn't expect it
      }
    }
  }
})
