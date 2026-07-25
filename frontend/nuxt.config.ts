import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: false,

  app: {
    head: {
      title: 'Commander Builder',
      htmlAttrs: { lang: 'fr' },
      link: [
        { rel: 'icon', href: '/favicon.ico', sizes: '32x32' },
        { rel: 'icon', type: 'image/svg+xml', href: '/icons/icon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
      meta: [
        { name: 'theme-color', content: '#0f0c08' },
      ],
    },
  },

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
      // Clé de site hCaptcha (publique). Défaut = clé de TEST hCaptcha (widget
      // qui passe toujours) ; surcharger en prod via NUXT_PUBLIC_HCAPTCHA_SITE_KEY.
      hcaptchaSiteKey: '10000000-ffff-ffff-ffff-000000000001',
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
      name: 'Commander Builder',
      short_name: 'Commander Builder',
      lang: 'fr',
      description:
        'Importez votre collection Magic, découvrez vos commandants jouables et complétez vos decks Commander.',
      theme_color: '#0f0c08',
      background_color: '#0f0c08',
      display: 'standalone',
      icons: [
        { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        { src: 'icons/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
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
        // Les symboles de mana ne sont plus hotlinkés : servis depuis public/mana/
        // et précachés via globPatterns (**/*.svg).
      ],
    },
    client: {
      installPrompt: true,
    },
  },
})
