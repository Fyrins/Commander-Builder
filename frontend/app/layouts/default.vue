<script setup lang="ts">
const colorMode = useColorMode()
const { user, logout } = useAuth()
const router = useRouter()

const navItems = [
  { to: '/', label: 'Inventaire' },
  { to: '/commanders', label: 'Mes commandants' },
  { to: '/compare', label: 'Comparateur' },
  { to: '/edhrec', label: 'EDHREC' },
]

function toggleColorMode() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

async function handleLogout() {
  await logout()
  await router.push('/login')
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <header class="border-b border-slate-200 dark:border-slate-800">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
        <div class="flex flex-wrap items-center gap-6">
          <NuxtLink to="/" class="text-lg font-semibold tracking-tight">
            MTG Commander Builder
          </NuxtLink>
          <nav class="flex flex-wrap gap-1">
            <NuxtLink
              v-for="item in navItems"
              :key="item.to"
              :to="item.to"
              class="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              active-class="!bg-slate-900 !text-white dark:!bg-slate-100 dark:!text-slate-900"
            >
              {{ item.label }}
            </NuxtLink>
          </nav>
        </div>

        <div class="flex items-center gap-3">
          <button
            type="button"
            class="rounded-md p-2 text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800"
            :aria-label="colorMode.value === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'"
            @click="toggleColorMode"
          >
            <svg v-if="colorMode.value === 'dark'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-5 w-5">
              <circle cx="12" cy="12" r="4.5" />
              <path stroke-linecap="round" d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-5 w-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11Z" />
            </svg>
          </button>

          <span v-if="user" class="hidden text-sm text-slate-500 sm:inline dark:text-slate-400">{{ user.email }}</span>
          <button
            v-if="user"
            type="button"
            class="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            @click="handleLogout"
          >
            Déconnexion
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-4 py-6">
      <slot />
    </main>
  </div>
</template>
