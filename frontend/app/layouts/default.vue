<script setup lang="ts">
const colorMode = useColorMode()
const { user, logout } = useAuth()
const router = useRouter()
const route = useRoute()

const navItems = [
  { to: '/inventaire', label: 'Inventaire' },
  { to: '/commanders', label: 'Mes commandants' },
  { to: '/compare', label: 'Comparateur' },
  { to: '/decks', label: 'Decks' },
]

// Menu mobile (hamburger) : replié par défaut, se ferme à chaque navigation.
const mobileOpen = ref(false)
watch(() => route.path, () => { mobileOpen.value = false })

function toggleColorMode() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

async function handleLogout() {
  mobileOpen.value = false
  await logout()
  await router.push('/login')
}
</script>

<template>
  <div class="min-h-screen">
    <header class="header">
      <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div class="flex items-center gap-6">
          <NuxtLink to="/inventaire" class="flex items-center gap-2.5">
            <AppSigil class="h-7 w-7 shrink-0" />
            <span class="brand">Commander Builder</span>
          </NuxtLink>
          <!-- Nav inline : desktop uniquement -->
          <nav class="hidden gap-1 sm:flex">
            <NuxtLink
              v-for="item in navItems"
              :key="item.to"
              :to="item.to"
              class="nav-link"
              active-class="nav-link--active"
            >
              {{ item.label }}
            </NuxtLink>
          </nav>
        </div>

        <div class="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            class="btn btn--ghost p-2"
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

          <!-- Desktop : pseudo + Déconnexion -->
          <span v-if="user" class="hidden text-sm sm:inline" style="color: var(--ink-text-muted)">{{ user.username }}</span>
          <button
            v-if="user"
            type="button"
            class="btn btn--secondary max-sm:hidden"
            @click="handleLogout"
          >
            Déconnexion
          </button>

          <!-- Mobile : hamburger -->
          <button
            type="button"
            class="btn btn--ghost p-2 sm:hidden"
            :aria-label="mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'"
            :aria-expanded="mobileOpen"
            aria-controls="mobile-nav"
            @click="mobileOpen = !mobileOpen"
          >
            <svg v-if="!mobileOpen" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" class="h-5 w-5">
              <path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" class="h-5 w-5">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Panneau mobile déroulant -->
      <div v-if="mobileOpen" id="mobile-nav" class="mobile-nav sm:hidden">
        <nav class="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="nav-link block"
            active-class="nav-link--active"
          >
            {{ item.label }}
          </NuxtLink>
          <button
            v-if="user"
            type="button"
            class="btn btn--secondary mt-2 w-full justify-center"
            @click="handleLogout"
          >
            Déconnexion
          </button>
        </nav>
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-4 py-6">
      <slot />
    </main>

    <footer class="footer mx-auto max-w-6xl px-4 py-8 text-center">
      <p class="footer__legal">
        Commander Builder is unofficial Fan Content permitted under the Fan Content Policy. Not
        approved/endorsed by Wizards. Portions of the materials used are property of Wizards of
        the Coast. ©Wizards of the Coast LLC.
      </p>
      <p class="mt-1 footer__credits">Données cartes et images fournies par Scryfall — statistiques de popularité par EDHREC.</p>
    </footer>
  </div>
</template>

<style scoped>
.header {
  border-bottom: 1px solid var(--ink-border);
  background-color: color-mix(in srgb, var(--ink-bg) 82%, transparent);
  backdrop-filter: blur(8px);
  position: sticky;
  top: 0;
  z-index: 20;
}

.brand {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1.15rem;
  letter-spacing: 0.02em;
  color: var(--ink-text);
}

.nav-link {
  border-radius: 0.375rem;
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--ink-text-muted);
  transition: color 150ms ease-out, background-color 150ms ease-out;
}
.nav-link:hover {
  color: var(--ink-text);
  background-color: var(--ink-panel-alt);
}
.nav-link--active {
  color: var(--gold);
  background-color: var(--ink-panel-alt);
  box-shadow: inset 0 0 0 1px var(--gold-border);
}

/* Panneau mobile : prolonge la barre, mêmes bordure/fond translucides. */
.mobile-nav {
  border-top: 1px solid var(--ink-border);
  background-color: color-mix(in srgb, var(--ink-bg) 92%, transparent);
}
.mobile-nav .nav-link {
  padding: 0.6rem 0.75rem;
  font-size: 0.95rem;
}

.footer__legal {
  font-size: 0.7rem;
  letter-spacing: 0.03em;
  color: var(--ink-text-muted);
  max-width: 46rem;
  margin-inline: auto;
}
.footer__credits {
  font-size: 0.72rem;
  color: var(--ink-text-muted);
  opacity: 0.85;
}
</style>
