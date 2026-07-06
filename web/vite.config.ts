import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// vite-plugin-pwa is a BUILD/dev dependency only — it adds NO runtime deps to the
// shipped app (the generated service worker is plain Workbox, framework-free).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
      manifest: {
        name: 'Space Race',
        short_name: 'Space Race',
        description: 'A cosmic race to 1,000 light-years — a free space card game.',
        theme_color: '#07071a',
        background_color: '#07071a',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // PRECACHE only the app shell + icons + manifest. Deliberately NOT the
        // heavy media (cards/video ~19MB, card art, sfx, ui rasters) so install
        // stays small/fast — those are runtime-cached on first use below.
        globPatterns: ['**/*.{js,css,html}', 'favicon.svg', 'icon-*.png'],
        globIgnores: ['**/cards/**', '**/sfx/**', '**/ui/**', '**/print-sheet.html'],
        navigateFallback: '/index.html',
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            // big card-play clips — cache on demand, support range/seek requests
            urlPattern: ({ url }) => url.pathname.startsWith('/cards/video/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'card-videos',
              rangeRequests: true,
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/cards/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'card-art', expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/sfx/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'sfx',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/ui/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'ui-art', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      // let the SW run in dev too, so it can be verified against the dev server
      devOptions: { enabled: true, type: 'module' },
    }),
  ],
  server: { port: 5180, open: true },
})
