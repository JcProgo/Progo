import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Service worker propio (src/sw.js) en vez de uno auto-generado: necesitamos
      // manejar los eventos `push` y `notificationclick` para los recordatorios.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'PROGO',
        short_name: 'PROGO',
        description: 'Organiza. Ejecuta. Progresa. — plataforma de gestión de negocio y productividad de JC CREW.',
        lang: 'es',
        start_url: '/',
        display: 'standalone',
        background_color: '#0E1318',
        theme_color: '#0E1318',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
