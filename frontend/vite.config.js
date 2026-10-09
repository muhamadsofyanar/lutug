import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-icon.svg', 'robots.txt'], // Add other assets if needed
      manifest: {
        name: 'InsyaRah OS',
        short_name: 'InsyaRah',
        description: 'Personal & Multi-Business Operating System',
        theme_color: '#0f172a',
        background_color: '#020617',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}']
      }
    })
  ],
  // IMPORTANT: Jika deploy di subdirectory (misal ruanglegalitas.com/app),
  // ubah base menjadi '/app/'. Jika di root domain, biarkan '/' atau hapus baris ini.
  base: './', 
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          utils: ['@tanstack/react-query', 'xlsx', 'jspdf', 'jspdf-autotable'],
          charts: ['recharts', 'react-force-graph-2d'],
          markdown: ['react-markdown']
        }
      }
    }
  },
  server: {
    host: true, // Listen on all local IPs
    proxy: {
      '/backend': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      '/public': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
