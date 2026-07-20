import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: false,

  modules: ['@nuxtjs/color-mode', '@vite-pwa/nuxt'],

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()],
  },

  colorMode: {
    classSuffix: '',
  },

  runtimeConfig: {
    public: {
      // En dev, le devProxy nitro route /api vers Symfony ; en prod, même origine ou domaine API.
      apiBase: '/api',
    },
  },

  nitro: {
    devProxy: {
      '/api': {
        target: 'http://127.0.0.1:8000/api',
        changeOrigin: true,
      },
    },
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'MTG Deck Builder Companion',
      short_name: 'MTG Builder',
      description:
        'Importez votre collection Magic, découvrez vos commandants jouables et complétez vos decks Commander.',
      theme_color: '#0f172a',
      background_color: '#0f172a',
      display: 'standalone',
      icons: [{ src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
      runtimeCaching: [
        {
          // Scans de cartes Scryfall : cache long côté client
          urlPattern: /^https:\/\/cards\.scryfall\.io\/.*/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'scryfall-images',
            expiration: { maxEntries: 2000, maxAgeSeconds: 60 * 60 * 24 * 30 },
          },
        },
      ],
    },
    client: {
      installPrompt: true,
    },
  },
})
