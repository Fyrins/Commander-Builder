<script setup lang="ts">
import { buildPool } from '~~/lib/engine/inventory'
import { parseDecklist } from '~~/lib/engine/parse-decklist'
import { scoreDecklist } from '~~/lib/engine/scoring'
import type { DecklistEntry, PoolItem, ResolvedCard } from '~~/lib/engine/types'

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

/** Tente de valoriser les cartes manquantes non résolues localement (nom seul), une seule fois par nom. */
const attemptedNames = new Set<string>()
watch(
  result,
  async (newResult) => {
    if (!newResult) return
    const namesToTry = newResult.unresolvedEntries
      .map((entry) => entry.name)
      .filter((name) => !attemptedNames.has(name.toLowerCase()))
    if (namesToTry.length === 0) return
    namesToTry.forEach((name) => attemptedNames.add(name.toLowerCase()))
    await store.resolveByNames(namesToTry)
  },
  { immediate: true },
)

function thumbnailFor(name: string) {
  return store.lookup.value.byName(name)
}

// Récupère l'édition la moins chère pour chaque carte manquante résoluble,
// afin de chiffrer la complétion au prix le plus bas plutôt qu'à l'édition
// de la decklist.
watch(
  () => result.value?.missing,
  async (missing) => {
    if (!missing?.length) return
    const oracleIds = missing
      .map((item) => thumbnailFor(item.name)?.oracleId)
      .filter((id): id is string => Boolean(id))
    await store.fetchCheapest(oracleIds)
  },
  { immediate: true },
)

interface MissingWithPrice {
  name: string
  needed: number
  owned: number
  missingQty: number
  unitPrice: string | null | undefined
  subtotal: number | null
  cheapestSet: string | null
}

const missingWithPrices = computed<MissingWithPrice[]>(() => {
  if (!result.value) return []
  return result.value.missing.map((item) => {
    const card = thumbnailFor(item.name)
    const cheapest = store.cheapestFor(card?.oracleId)
    const missingQty = item.needed - item.owned
    // Prix le plus bas toutes éditions ; repli sur l'édition résolue si inconnu.
    const unitPrice = cheapest?.priceEur ?? card?.priceEur
    const subtotal = unitPrice ? Number(unitPrice) * missingQty : null
    return {
      name: item.name,
      needed: item.needed,
      owned: item.owned,
      missingQty,
      unitPrice,
      subtotal,
      cheapestSet: cheapest?.setCode ?? null,
    }
  })
})

const estimatedCost = computed(() => {
  let total = 0
  let withoutPrice = 0
  for (const item of missingWithPrices.value) {
    if (item.subtotal !== null) total += item.subtotal
    else withoutPrice += 1
  }
  return { total, withoutPrice }
})

// Modal de détail carte : une seule instance par page.
const selectedCard = ref<ResolvedCard | null>(null)

function openCardDetail(name: string): void {
  const card = thumbnailFor(name)
  if (card) selectedCard.value = card
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="mb-1 text-2xl font-semibold">Comparateur</h1>
      <p class="text-sm text-muted">
        Vérifiez le taux de complétion d'une decklist par rapport à votre pool (collection + decks inclus).
      </p>
    </div>

    <div class="flex gap-2">
      <button
        type="button"
        class="btn"
        :class="mode === 'deck' ? 'btn--primary' : 'btn--secondary'"
        @click="mode = 'deck'"
      >
        Un de mes decks
      </button>
      <button
        type="button"
        class="btn"
        :class="mode === 'paste' ? 'btn--primary' : 'btn--secondary'"
        @click="mode = 'paste'"
      >
        Coller une decklist
      </button>
    </div>

    <div v-if="mode === 'deck'" class="space-y-3">
      <select
        v-model="selectedDeckId"
        class="field max-w-sm"
      >
        <option :value="null" disabled>Choisir un deck…</option>
        <option v-for="deck in store.decks.value" :key="deck.id" :value="deck.id">{{ deck.name }}</option>
      </select>

      <label v-if="showExcludeToggle" class="flex items-center gap-2 text-sm text-muted">
        <input v-model="excludeFromPool" type="checkbox" class="mtg-checkbox">
        Exclure ce deck de mon pool pour la comparaison
      </label>
    </div>

    <div v-else class="space-y-2">
      <textarea
        v-model="pasteText"
        rows="10"
        placeholder="1 Sol Ring&#10;1 Command Tower&#10;1 Atraxa, Praetors' Voice (C16) 1"
        class="field font-mono text-xs"
      />
      <ul v-if="pasteErrors.length" class="max-h-32 overflow-y-auto rounded-md bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
        <li v-for="(err, index) in pasteErrors" :key="index">{{ err }}</li>
      </ul>
    </div>

    <label class="flex items-center gap-2 text-sm text-muted">
      <input v-model="allowOtherEditions" type="checkbox" class="mtg-checkbox">
      Inclure les autres éditions
    </label>

    <section v-if="result" class="space-y-6 panel p-6 ">
      <div class="flex flex-wrap items-center gap-6">
        <div
          class="ring relative flex h-32 w-32 items-center justify-center"
          :style="{ '--ring-target': result.percent }"
        >
          <div class="absolute inset-2 flex items-center justify-center rounded-full surface">
            <span class="stat-value text-2xl font-semibold">{{ result.percent }}%</span>
          </div>
        </div>
        <div>
          <p class="text-lg font-medium">{{ result.ownedCount }} / {{ result.total }} cartes possédées</p>
          <p class="text-sm text-muted">Terrains de base considérés comme possédés.</p>
        </div>
      </div>

      <BasicLandsSummary :entries="entries" />

      <div v-if="result.unresolvedEntries.length" class="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
        <p class="mb-1 font-medium">Cartes non résolues (nom introuvable) :</p>
        <ul class="list-inside list-disc">
          <li v-for="(entry, index) in result.unresolvedEntries" :key="index">{{ entry.quantity }}× {{ entry.name }}</li>
        </ul>
      </div>

      <div v-if="result.missing.length">
        <div class="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 class="text-lg font-semibold">Cartes manquantes</h2>
          <p class="text-sm text-muted">
            Coût au meilleur prix :
            <span class="font-semibold text-strong">{{ formatEur(estimatedCost.total.toFixed(2)) }}</span>
            <span v-if="estimatedCost.withoutPrice > 0" class="ml-1 text-xs text-muted">
              ({{ estimatedCost.withoutPrice }} carte{{ estimatedCost.withoutPrice > 1 ? 's' : '' }} sans prix)
            </span>
          </p>
        </div>
        <ul class="space-y-2">
          <li
            v-for="(item, index) in missingWithPrices"
            :key="index"
            class="flex items-center gap-3 panel px-3 py-2 "
            :class="{ 'cursor-pointer': thumbnailFor(item.name) }"
            :role="thumbnailFor(item.name) ? 'button' : undefined"
            :tabindex="thumbnailFor(item.name) ? 0 : undefined"
            @click="openCardDetail(item.name)"
            @keydown.enter="openCardDetail(item.name)"
          >
            <CardHoverImage :small="thumbnailFor(item.name)?.imageSmall" :normal="thumbnailFor(item.name)?.imageNormal" :alt="item.name" />
            <div class="flex-1">
              <p class="font-medium">{{ item.name }}</p>
              <p class="text-xs text-muted">{{ item.owned }}/{{ item.needed }} possédée(s)</p>
            </div>
            <div class="text-right text-xs text-muted">
              <p>
                {{ formatEur(item.unitPrice) }} / u.
                <span v-if="item.cheapestSet" class="uppercase text-gold">· {{ item.cheapestSet }}</span>
              </p>
              <p class="font-medium text-muted">
                {{ item.subtotal !== null ? formatEur(item.subtotal.toFixed(2)) : '—' }}
              </p>
            </div>
            <span class="badge badge--missing">-{{ item.missingQty }}</span>
          </li>
        </ul>
      </div>
      <p v-else class="text-sm text-emerald-600 dark:text-emerald-400">Deck 100% complet !</p>
    </section>

    <p v-else class="text-sm text-muted">
      Sélectionnez un deck ou collez une decklist pour lancer la comparaison.
    </p>

    <CardDetailModal :card="selectedCard" :open="selectedCard !== null" @close="selectedCard = null" />
  </div>
</template>
