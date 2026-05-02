import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3025',
        changeOrigin: false,
        ws: false,
      },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          markdown: ['react-markdown', 'remark-gfm', 'rehype-highlight'],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'cozza-ai',
        short_name: 'cozza-ai',
        description: 'Personal cockpit AI for Viture Beast XR',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        lang: 'it',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'],
        // Heavy lazy-loaded chunks: cached on first use, NOT precached, so
        // the install bundle stays slim on mobile networks.
        globIgnores: [
          '**/mermaid*',
          '**/cytoscape*',
          '**/architectureDiagram*',
          '**/wardley*',
          '**/katex*',
        ],
        maximumFileSizeToCacheInBytes: 1_500_000,
        navigateFallback: '/index.html',
        // Auto-activate the new SW immediately so installed PWAs always get
        // the latest bundle on next load. Without this, mobile users would
        // sit on a stale cached version until they manually clear caches.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          // Lazy chunks: cache on first fetch
          {
            urlPattern: /\/assets\/(mermaid|cytoscape|architectureDiagram|wardley|katex)[^/]*\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'lazy-chunks-cache',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
