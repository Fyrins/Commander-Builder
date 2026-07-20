<script setup lang="ts">
import { detectCommanders } from '~~/lib/engine/commanders'
import { edhrecSlug } from '~~/lib/engine/slugify'

const store = useCollectionStore()

onMounted(() => {
  if (!store.loaded.value) store.loadAll()
})

const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G'] as const
const COLOR_LABELS: Record<string, string> = { W: 'Blanc', U: 'Bleu', B: 'Noir', R: 'Rouge', G: 'Vert' }
const COLOR_VARS: Record<string, string> = {
  W: 'var(--mtg-white)',
  U: 'var(--mtg-blue)',
  B: 'var(--mtg-black)',
  R: 'var(--mtg-red)',
  G: 'var(--mtg-green)',
}

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

const filteredCommanders = computed(() => {
  if (selectedColors.value.size === 0) return commanders.value
  const wanted = Array.from(selectedColors.value)
  return commanders.value.filter((card) => wanted.every((color) => card.colorIdentity.includes(color)))
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="mb-1 text-2xl font-semibold">Commandants</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400">
        Cartes légales comme commandant, réellement présentes dans votre pool (collection + decks inclus).
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <span class="text-sm text-slate-500 dark:text-slate-400">Filtrer par couleur :</span>
      <button
        v-for="color in COLOR_ORDER"
        :key="color"
        type="button"
        class="h-7 w-7 rounded-full border-2 transition"
        :class="selectedColors.has(color) ? 'border-slate-900 dark:border-white' : 'border-transparent opacity-50 hover:opacity-80'"
        :style="{ backgroundColor: COLOR_VARS[color] }"
        :aria-pressed="selectedColors.has(color)"
        :title="COLOR_LABELS[color]"
        @click="toggleColor(color)"
      />
      <button
        v-if="selectedColors.size"
        type="button"
        class="text-xs text-slate-500 underline hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        @click="resetColors"
      >
        Réinitialiser
      </button>
    </div>

    <p v-if="commanders.length === 0" class="text-sm text-slate-500 dark:text-slate-400">
      Aucun commandant détecté dans votre pool pour l'instant.
    </p>
    <p v-else-if="filteredCommanders.length === 0" class="text-sm text-slate-500 dark:text-slate-400">
      Aucun commandant ne correspond à ce filtre de couleurs.
    </p>

    <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      <NuxtLink
        v-for="card in filteredCommanders"
        :key="card.oracleId"
        :to="{ path: '/edhrec', query: { commander: edhrecSlug(card.name) } }"
        class="group rounded-xl border border-slate-200 p-2 transition hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600"
      >
        <img v-if="card.imageNormal" :src="card.imageNormal" :alt="card.name" loading="lazy" class="mb-2 w-full rounded-lg">
        <p class="truncate text-sm font-medium" :title="card.printedName ?? card.name">{{ card.printedName ?? card.name }}</p>
        <ColorPips :colors="card.colorIdentity" />
      </NuxtLink>
    </div>
  </div>
</template>
