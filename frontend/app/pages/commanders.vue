<script setup lang="ts">
import { detectCommanders } from '~~/lib/engine/commanders'
import { edhrecSlug } from '~~/lib/engine/slugify'

const store = useCollectionStore()

onMounted(() => {
  if (!store.loaded.value) store.loadAll()
})

const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G'] as const
const COLOR_LABELS: Record<string, string> = { W: 'Blanc', U: 'Bleu', B: 'Noir', R: 'Rouge', G: 'Vert' }

const commanders = computed(() => detectCommanders(store.poolCards.value))

const selectedColors = ref<Set<string>>(new Set())

function toggleColor(color: string) {
  const next = new Set(selectedColors.value)
  if (next.has(color)) next.delete(color)
  else next.add(color)
  selectedColors.value = next
}

function resetColors() {
  selectedColors.value = new Set()
}

// Sémantique « couleurs disponibles » : on affiche les commandants dont
// l'identité de couleur tient dans les couleurs cochées (incluses ou moins).
// Les commandants incolores restent visibles (identité vide ⊆ tout).
const filteredCommanders = computed(() => {
  if (selectedColors.value.size === 0) return commanders.value
  return commanders.value.filter((card) =>
    card.colorIdentity.every((color) => selectedColors.value.has(color)),
  )
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="mb-1 text-2xl font-semibold">Mes commandants</h1>
      <p class="text-sm text-muted">
        Cartes légales comme commandant, réellement présentes dans votre pool (collection + decks inclus).
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <span class="text-sm text-muted">Filtrer par couleur :</span>
      <button
        v-for="color in COLOR_ORDER"
        :key="color"
        type="button"
        role="checkbox"
        class="mana-filter text-2xl leading-none transition"
        :class="selectedColors.has(color) ? 'mana-filter--on' : 'mana-filter--off'"
        :aria-checked="selectedColors.has(color)"
        :aria-label="COLOR_LABELS[color]"
        :title="COLOR_LABELS[color]"
        @click="toggleColor(color)"
      >
        <ManaSymbol :code="color" />
      </button>
      <button
        v-if="selectedColors.size"
        type="button"
        class="btn btn--ghost px-2 py-1 text-xs underline"
        @click="resetColors"
      >
        Réinitialiser
      </button>
    </div>

    <p v-if="commanders.length === 0" class="text-sm text-muted">
      Aucun commandant détecté dans votre pool pour l'instant.
    </p>
    <p v-else-if="filteredCommanders.length === 0" class="text-sm text-muted">
      Aucun commandant ne correspond à ce filtre de couleurs.
    </p>

    <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      <NuxtLink
        v-for="card in filteredCommanders"
        :key="card.oracleId"
        :to="{ path: '/decks', query: { commander: edhrecSlug(card.name) } }"
        class="group panel p-2 transition hover:hairline-strong  dark:hover:hairline-strong"
      >
        <img v-if="card.imageNormal" :src="card.imageNormal" :alt="card.name" loading="lazy" class="mb-2 w-full rounded-lg">
        <p class="truncate text-sm font-medium" :title="card.printedName ?? card.name">{{ card.printedName ?? card.name }}</p>
        <ColorPips :colors="card.colorIdentity" />
      </NuxtLink>
    </div>
  </div>
</template>
