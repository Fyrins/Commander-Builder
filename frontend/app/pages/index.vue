<script setup lang="ts">
import type { ApiDeck } from '~/composables/useCollectionStore'
import type { CollectionRow } from '~~/lib/engine/types'

const store = useCollectionStore()

onMounted(() => {
  if (!store.loaded.value) store.loadAll()
})

const searchQuery = ref('')

const filteredRows = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return store.collectionRows.value
  return store.collectionRows.value.filter((row) => row.name.toLowerCase().includes(query))
})

const stats = computed(() => {
  const rows = store.collectionRows.value
  const total = rows.reduce((sum, row) => sum + row.quantity, 0)
  const oracleIds = new Set<string>()
  for (const row of rows) {
    const card = store.lookup.value.byScryfallId(row.scryfallId)
    oracleIds.add(card?.oracleId ?? `name:${row.name.toLowerCase()}`)
  }
  return { total, unique: oracleIds.size }
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

const colorBreakdown = computed(() => {
  const buckets: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, multi: 0, colorless: 0 }
  for (const row of store.collectionRows.value) {
    const card = store.lookup.value.byScryfallId(row.scryfallId)
    const identity = card?.colorIdentity ?? []
    if (identity.length === 0) buckets.colorless += row.quantity
    else if (identity.length === 1 && identity[0] in buckets) buckets[identity[0]] += row.quantity
    else buckets.multi += row.quantity
  }
  return buckets
})

const maxBucketValue = computed(() => Math.max(1, ...Object.values(colorBreakdown.value)))

function cardOf(row: CollectionRow) {
  return store.lookup.value.byScryfallId(row.scryfallId)
}

async function handleToggleInclude(deck: ApiDeck) {
  await store.toggleDeckInclude(deck)
}

async function handleDelete(deck: ApiDeck) {
  if (!confirm(`Supprimer le deck « ${deck.name} » ?`)) return
  await store.deleteDeck(deck)
}
</script>

<template>
  <div class="space-y-8">
    <div v-if="store.loading.value" class="space-y-2 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <p class="text-sm text-slate-600 dark:text-slate-300">
        Résolution des cartes… {{ store.progress.value.done }}/{{ store.progress.value.total }}
      </p>
      <ProgressBar
        :percent="store.progress.value.total ? (store.progress.value.done / store.progress.value.total) * 100 : 0"
      />
    </div>

    <section v-if="!store.loading.value && store.collectionRows.value.length === 0">
      <h1 class="mb-2 text-2xl font-semibold">Bienvenue</h1>
      <p class="mb-6 text-slate-600 dark:text-slate-400">
        Importez votre collection ManaBox et vos decklists pour commencer.
      </p>
      <ImportPanel />
    </section>

    <template v-else>
      <section>
        <h1 class="mb-4 text-2xl font-semibold">Inventaire</h1>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <p class="text-sm text-slate-500 dark:text-slate-400">Total de cartes</p>
            <p class="text-2xl font-semibold">{{ stats.total }}</p>
          </div>
          <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <p class="text-sm text-slate-500 dark:text-slate-400">Cartes uniques</p>
            <p class="text-2xl font-semibold">{{ stats.unique }}</p>
          </div>
        </div>

        <div class="mt-4 space-y-2 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <p class="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Répartition par identité de couleur</p>
          <div v-for="color in COLOR_ORDER" :key="color" class="flex items-center gap-3">
            <span class="w-20 shrink-0 text-xs text-slate-500 dark:text-slate-400">{{ COLOR_LABELS[color] }}</span>
            <div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                class="h-full rounded-full transition-all duration-300"
                :style="{ width: `${(colorBreakdown[color] / maxBucketValue) * 100}%`, backgroundColor: COLOR_VARS[color] }"
              />
            </div>
            <span class="w-10 shrink-0 text-right text-xs text-slate-500 dark:text-slate-400">{{ colorBreakdown[color] }}</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="w-20 shrink-0 text-xs text-slate-500 dark:text-slate-400">Multicolore</span>
            <div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                class="h-full rounded-full bg-gradient-to-r from-amber-300 to-fuchsia-400 transition-all duration-300"
                :style="{ width: `${(colorBreakdown.multi / maxBucketValue) * 100}%` }"
              />
            </div>
            <span class="w-10 shrink-0 text-right text-xs text-slate-500 dark:text-slate-400">{{ colorBreakdown.multi }}</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="w-20 shrink-0 text-xs text-slate-500 dark:text-slate-400">Incolore</span>
            <div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                class="h-full rounded-full bg-slate-400 transition-all duration-300"
                :style="{ width: `${(colorBreakdown.colorless / maxBucketValue) * 100}%` }"
              />
            </div>
            <span class="w-10 shrink-0 text-right text-xs text-slate-500 dark:text-slate-400">{{ colorBreakdown.colorless }}</span>
          </div>
        </div>
      </section>

      <section>
        <h2 class="mb-3 text-lg font-semibold">Mes decks</h2>
        <p v-if="store.decks.value.length === 0" class="text-sm text-slate-500 dark:text-slate-400">
          Aucun deck importé pour l'instant.
        </p>
        <ul v-else class="space-y-2">
          <li
            v-for="deck in store.decks.value"
            :key="deck.id"
            class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-800"
          >
            <div>
              <p class="font-medium">{{ deck.name }}</p>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ deck.items.length }} entrée(s)
                <span v-if="deck.isOwnedDeck"> · deck possédé</span>
              </p>
            </div>
            <div class="flex items-center gap-3">
              <label class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  :checked="deck.includeInPool"
                  class="rounded border-slate-400"
                  @change="handleToggleInclude(deck)"
                >
                Inclure dans mon pool
              </label>
              <button
                type="button"
                class="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
                @click="handleDelete(deck)"
              >
                Supprimer
              </button>
            </div>
          </li>
        </ul>
      </section>

      <section>
        <h2 class="mb-3 text-lg font-semibold">Importer / mettre à jour</h2>
        <ImportPanel />
      </section>

      <section>
        <h2 class="mb-3 text-lg font-semibold">Collection</h2>
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Rechercher une carte…"
          class="mb-3 w-full max-w-sm rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >

        <div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table class="w-full text-sm">
            <thead class="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th class="px-3 py-2">Carte</th>
                <th class="px-3 py-2">Set</th>
                <th class="px-3 py-2">Foil</th>
                <th class="px-3 py-2 text-right">Qté</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, index) in filteredRows"
                :key="`${row.scryfallId}-${index}`"
                class="border-t border-slate-200 dark:border-slate-800"
              >
                <td class="px-3 py-2">
                  <div class="flex items-center gap-3">
                    <CardHoverImage :small="cardOf(row)?.imageSmall" :normal="cardOf(row)?.imageNormal" :alt="row.name" />
                    <span>{{ row.name }}</span>
                  </div>
                </td>
                <td class="px-3 py-2 uppercase text-slate-500 dark:text-slate-400">{{ row.setCode }}</td>
                <td class="px-3 py-2">
                  <span
                    v-if="row.foil"
                    class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                  >
                    Foil
                  </span>
                </td>
                <td class="px-3 py-2 text-right">{{ row.quantity }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="filteredRows.length === 0" class="p-4 text-center text-sm text-slate-500 dark:text-slate-400">
            Aucune carte ne correspond à la recherche.
          </p>
        </div>
      </section>
    </template>
  </div>
</template>
