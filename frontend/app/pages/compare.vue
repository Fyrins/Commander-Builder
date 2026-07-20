<script setup lang="ts">
import { buildPool } from '~~/lib/engine/inventory'
import { parseDecklist } from '~~/lib/engine/parse-decklist'
import { scoreDecklist } from '~~/lib/engine/scoring'
import type { DecklistEntry, PoolItem } from '~~/lib/engine/types'

const store = useCollectionStore()

onMounted(() => {
  if (!store.loaded.value) store.loadAll()
})

type Mode = 'deck' | 'paste'
const mode = ref<Mode>('deck')
const selectedDeckId = ref<number | null>(null)
const pasteText = ref('')
const allowOtherEditions = ref(false)
const excludeFromPool = ref(false)

const selectedDeck = computed(() => store.decks.value.find((deck) => deck.id === selectedDeckId.value) ?? null)

const showExcludeToggle = computed(() => Boolean(selectedDeck.value?.isOwnedDeck && selectedDeck.value?.includeInPool))

const parsedPaste = computed(() => parseDecklist(pasteText.value))

const entries = computed<DecklistEntry[]>(() => {
  if (mode.value === 'deck' && selectedDeck.value) {
    return selectedDeck.value.items.map((item) => ({
      quantity: item.quantity,
      name: item.nameRaw,
      setCode: item.setCode ?? undefined,
      collectorNumber: item.collectorNumber ?? undefined,
      foil: item.foil,
    }))
  }
  return parsedPaste.value.entries
})

const pasteErrors = computed(() => (mode.value === 'paste' ? parsedPaste.value.errors : []))

const comparisonPool = computed<PoolItem[]>(() => {
  if (!(mode.value === 'deck' && excludeFromPool.value && selectedDeck.value)) {
    return store.pool.value
  }
  const deckInputs = store.decks.value.map((deck) => ({
    name: deck.name,
    include: deck.id === selectedDeck.value!.id ? false : deck.includeInPool,
    entries: deck.items.map((item) => ({
      quantity: item.quantity,
      name: item.nameRaw,
      setCode: item.setCode ?? undefined,
      collectorNumber: item.collectorNumber ?? undefined,
      foil: item.foil,
    })),
  }))
  return buildPool(store.collectionRows.value, deckInputs)
})

const hasEntries = computed(() => entries.value.length > 0)

const result = computed(() => {
  if (!hasEntries.value) return null
  return scoreDecklist(entries.value, comparisonPool.value, store.lookup.value, {
    allowOtherEditions: allowOtherEditions.value,
  })
})

function thumbnailFor(name: string) {
  return store.lookup.value.byName(name)
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="mb-1 text-2xl font-semibold">Comparateur</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400">
        Vérifiez le taux de complétion d'une decklist par rapport à votre pool (collection + decks inclus).
      </p>
    </div>

    <div class="flex gap-2">
      <button
        type="button"
        class="rounded-md px-3 py-1.5 text-sm font-medium"
        :class="mode === 'deck' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'border border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'"
        @click="mode = 'deck'"
      >
        Un de mes decks
      </button>
      <button
        type="button"
        class="rounded-md px-3 py-1.5 text-sm font-medium"
        :class="mode === 'paste' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'border border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'"
        @click="mode = 'paste'"
      >
        Coller une decklist
      </button>
    </div>

    <div v-if="mode === 'deck'" class="space-y-3">
      <select
        v-model="selectedDeckId"
        class="w-full max-w-sm rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
      >
        <option :value="null" disabled>Choisir un deck…</option>
        <option v-for="deck in store.decks.value" :key="deck.id" :value="deck.id">{{ deck.name }}</option>
      </select>

      <label v-if="showExcludeToggle" class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        <input v-model="excludeFromPool" type="checkbox" class="rounded border-slate-400">
        Exclure ce deck de mon pool pour la comparaison
      </label>
    </div>

    <div v-else class="space-y-2">
      <textarea
        v-model="pasteText"
        rows="10"
        placeholder="1 Sol Ring&#10;1 Command Tower&#10;1 Atraxa, Praetors' Voice (C16) 1"
        class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
      />
      <ul v-if="pasteErrors.length" class="max-h-32 overflow-y-auto rounded-md bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
        <li v-for="(err, index) in pasteErrors" :key="index">{{ err }}</li>
      </ul>
    </div>

    <label class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
      <input v-model="allowOtherEditions" type="checkbox" class="rounded border-slate-400">
      Inclure les autres éditions
    </label>

    <section v-if="result" class="space-y-6 rounded-xl border border-slate-200 p-6 dark:border-slate-800">
      <div class="flex flex-wrap items-center gap-6">
        <div
          class="relative flex h-32 w-32 items-center justify-center rounded-full"
          :style="{ background: `conic-gradient(#10b981 ${result.percent}%, rgba(148,163,184,0.3) ${result.percent}% 100%)` }"
        >
          <div class="absolute inset-2 flex items-center justify-center rounded-full bg-white dark:bg-slate-950">
            <span class="text-2xl font-semibold">{{ result.percent }}%</span>
          </div>
        </div>
        <div>
          <p class="text-lg font-medium">{{ result.ownedCount }} / {{ result.totalNonLand }} cartes possédées</p>
          <p class="text-sm text-slate-500 dark:text-slate-400">Terrains de base exclus du calcul.</p>
        </div>
      </div>

      <div v-if="result.unresolvedEntries.length" class="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
        <p class="mb-1 font-medium">Cartes non résolues (nom introuvable) :</p>
        <ul class="list-inside list-disc">
          <li v-for="(entry, index) in result.unresolvedEntries" :key="index">{{ entry.quantity }}× {{ entry.name }}</li>
        </ul>
      </div>

      <div v-if="result.missing.length">
        <h2 class="mb-3 text-lg font-semibold">Cartes manquantes</h2>
        <ul class="space-y-2">
          <li
            v-for="(item, index) in result.missing"
            :key="index"
            class="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800"
          >
            <CardHoverImage :small="thumbnailFor(item.name)?.imageSmall" :normal="thumbnailFor(item.name)?.imageNormal" :alt="item.name" />
            <div class="flex-1">
              <p class="font-medium">{{ item.name }}</p>
              <p class="text-xs text-slate-500 dark:text-slate-400">{{ item.owned }}/{{ item.needed }} possédée(s)</p>
            </div>
            <span class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
              -{{ item.needed - item.owned }}
            </span>
          </li>
        </ul>
      </div>
      <p v-else class="text-sm text-emerald-600 dark:text-emerald-400">Deck 100% complet !</p>
    </section>

    <p v-else class="text-sm text-slate-500 dark:text-slate-400">
      Sélectionnez un deck ou collez une decklist pour lancer la comparaison.
    </p>
  </div>
</template>
