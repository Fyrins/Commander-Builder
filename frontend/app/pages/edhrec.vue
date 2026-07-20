<script setup lang="ts">
import { detectCommanders } from '~~/lib/engine/commanders'
import { isBasicLand, isBasicLandName } from '~~/lib/engine/lands'
import { edhrecSlug } from '~~/lib/engine/slugify'
import type { ResolvedCard } from '~~/lib/engine/types'

interface EdhrecCard {
  name: string
  num_decks: number
  potential_decks: number
  inclusion: number
}

interface EdhrecCardlist {
  header: string
  cards: EdhrecCard[]
}

interface EdhrecResponse {
  commander: string
  cardlists: EdhrecCardlist[]
}

/** Résultat de recherche Scryfall (sous-ensemble utilisé pour l'autocomplétion de commandant). */
interface ScryfallSearchCard {
  name: string
  type_line: string
  image_uris?: { small?: string }
  card_faces?: { image_uris?: { small?: string } }[]
}

interface ScryfallSearchResponse {
  data?: ScryfallSearchCard[]
}

const store = useCollectionStore()
const route = useRoute()

onMounted(() => {
  if (!store.loaded.value) store.loadAll()
})

const prefillSlug = ref<string | null>(typeof route.query.commander === 'string' ? route.query.commander : null)

type InputMode = 'pool' | 'free'
const inputMode = ref<InputMode>('pool')
const selectedOracleId = ref<string | null>(null)

// Recherche de commandant non possédé (autocomplétion Scryfall en direct depuis le navigateur).
const searchTerm = ref('')
const searchResults = ref<ScryfallSearchCard[]>([])
const searchLoading = ref(false)
const searchError = ref('')
const selectedFreeCommander = ref<{ name: string } | null>(null)
let searchDebounce: ReturnType<typeof setTimeout> | undefined

const poolCommanders = computed(() => detectCommanders(store.poolCards.value))

watch([selectedOracleId, selectedFreeCommander, inputMode], () => {
  prefillSlug.value = null
})

function clearPrefill() {
  prefillSlug.value = null
}

const slug = computed(() => {
  if (prefillSlug.value) return prefillSlug.value
  if (inputMode.value === 'pool') {
    const card = poolCommanders.value.find((c) => c.oracleId === selectedOracleId.value)
    return card ? edhrecSlug(card.name) : ''
  }
  return selectedFreeCommander.value ? edhrecSlug(selectedFreeCommander.value.name) : ''
})

/** Miniature d'un résultat de recherche Scryfall (recto uniquement pour les cartes recto-verso). */
function searchResultThumbnail(card: ScryfallSearchCard): string | undefined {
  return card.image_uris?.small ?? card.card_faces?.[0]?.image_uris?.small
}

async function runCommanderSearch(term: string): Promise<void> {
  searchLoading.value = true
  searchError.value = ''
  try {
    const url = `https://api.scryfall.com/cards/search?${new URLSearchParams({
      q: `is:commander ${term}`,
      unique: 'cards',
      order: 'edhrec',
    })}`
    const response = await fetch(url)
    if (response.status === 404) {
      searchResults.value = []
      searchError.value = 'Aucun commandant trouvé.'
      return
    }
    if (!response.ok) {
      searchResults.value = []
      searchError.value = 'Erreur lors de la recherche de commandant.'
      return
    }
    const data = (await response.json()) as ScryfallSearchResponse
    searchResults.value = (data.data ?? []).slice(0, 8)
  } catch {
    searchResults.value = []
    searchError.value = 'Erreur lors de la recherche de commandant.'
  } finally {
    searchLoading.value = false
  }
}

watch(searchTerm, (term) => {
  if (searchDebounce) clearTimeout(searchDebounce)
  const trimmed = term.trim()
  if (!trimmed) {
    searchResults.value = []
    searchError.value = ''
    return
  }
  searchDebounce = setTimeout(() => {
    void runCommanderSearch(trimmed)
  }, 300)
})

function selectCommanderResult(card: ScryfallSearchCard): void {
  selectedFreeCommander.value = { name: card.name }
  searchResults.value = []
  searchTerm.value = ''
  searchError.value = ''
  void store.resolveByNames([card.name])
}

function changeFreeCommander(): void {
  selectedFreeCommander.value = null
  searchTerm.value = ''
  searchResults.value = []
  searchError.value = ''
}

const edhrecData = ref<EdhrecResponse | null>(null)
const edhrecError = ref('')
const edhrecLoading = ref(false)
const pricesLoading = ref(false)

watch(
  slug,
  async (newSlug) => {
    edhrecData.value = null
    edhrecError.value = ''
    if (!newSlug) return

    edhrecLoading.value = true
    try {
      edhrecData.value = await $fetch<EdhrecResponse>(`/api/edhrec/${newSlug}`, { credentials: 'include' })
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status
      edhrecError.value = status === 404 ? 'Commandant introuvable sur EDHREC.' : 'Erreur lors de la récupération des données EDHREC.'
    } finally {
      edhrecLoading.value = false
    }

    if (edhrecData.value) {
      const names = Array.from(new Set(edhrecData.value.cardlists.flatMap((list) => list.cards.map((card) => card.name))))
      if (names.length > 0) {
        pricesLoading.value = true
        try {
          await store.resolveByNames(names)
        } finally {
          pricesLoading.value = false
        }
      }
    }
  },
  { immediate: true },
)

/** Index nom (lowercase) → quantité possédée, avec indexation de la face avant seule des cartes recto-verso. */
const ownedNameIndex = computed(() => {
  const map = new Map<string, number>()
  const addEntry = (name: string, qty: number) => {
    const key = name.trim().toLowerCase()
    map.set(key, (map.get(key) ?? 0) + qty)
  }

  for (const data of store.oracleIndex.value.index.values()) {
    const representative = data.printings[0]
    if (!representative) continue
    addEntry(representative.name, data.quantity)
    const slashIndex = representative.name.indexOf('//')
    if (slashIndex !== -1) {
      addEntry(representative.name.slice(0, slashIndex).trim(), data.quantity)
    }
  }

  return map
})

/** Un terrain de base est toujours considéré comme possédé (pool de terrains de base supposé suffisant). */
function isLandCard(cardName: string): boolean {
  if (isBasicLandName(cardName)) return true
  const card = thumbnailFor(cardName)
  return card ? isBasicLand(card) : false
}

function isOwned(cardName: string): boolean {
  if (isLandCard(cardName)) return true
  return ownedNameIndex.value.has(cardName.trim().toLowerCase())
}

/** Commandant en cours (uniquement pertinent pour la recherche « Rechercher un commandant »). */
const currentCommanderName = computed(() => {
  if (prefillSlug.value) return null
  if (inputMode.value === 'free') return selectedFreeCommander.value?.name ?? null
  return null
})

const commanderOwned = computed(() => (currentCommanderName.value ? isOwned(currentCommanderName.value) : true))

const allCardsFlat = computed(() => {
  if (!edhrecData.value) return []
  const map = new Map<string, { name: string; inclusion: number }>()
  for (const list of edhrecData.value.cardlists) {
    for (const card of list.cards) {
      const key = card.name.toLowerCase()
      const existing = map.get(key)
      if (!existing || card.inclusion > existing.inclusion) {
        map.set(key, { name: card.name, inclusion: card.inclusion })
      }
    }
  }
  return Array.from(map.values())
})

const completion = computed(() => {
  const cards = allCardsFlat.value
  const totalWeight = cards.reduce((sum, card) => sum + card.inclusion, 0)
  if (totalWeight === 0) return 0
  const ownedWeight = cards.reduce((sum, card) => sum + (isOwned(card.name) ? card.inclusion : 0), 0)
  return Math.round((ownedWeight / totalWeight) * 1000) / 10
})

interface PriorityItem {
  name: string
  inclusion: number
  isCommander?: boolean
}

const priorityPurchases = computed<PriorityItem[]>(() => {
  const list: PriorityItem[] = allCardsFlat.value
    .filter((card) => !isOwned(card.name))
    .sort((a, b) => b.inclusion - a.inclusion)
    .slice(0, 10)

  if (currentCommanderName.value && !commanderOwned.value) {
    return [{ name: currentCommanderName.value, inclusion: 1, isCommander: true }, ...list]
  }
  return list
})

function thumbnailFor(name: string) {
  return store.lookup.value.byName(name)
}

function priceFor(name: string): string | null | undefined {
  return thumbnailFor(name)?.priceEur
}

/** Budget pour compléter le deck moyen : somme des prix des manquantes uniques (1 exemplaire chacune),
 *  plus le commandant non possédé le cas échéant (voir `commanderCost`). */
const budgetToComplete = computed(() => {
  let total = 0
  let withoutPrice = 0
  for (const card of allCardsFlat.value) {
    if (isOwned(card.name)) continue
    const price = priceFor(card.name)
    if (price) total += Number(price)
    else withoutPrice += 1
  }

  let commanderCost: number | null = null
  if (currentCommanderName.value && !commanderOwned.value) {
    const price = priceFor(currentCommanderName.value)
    if (price) {
      commanderCost = Number(price)
      total += commanderCost
    } else {
      withoutPrice += 1
    }
  }

  return { total, withoutPrice, commanderCost }
})

// Modal de détail carte (comparateur / EDHREC) : une seule instance par page.
const selectedCard = ref<ResolvedCard | null>(null)

function openCardDetail(name: string): void {
  const card = thumbnailFor(name)
  if (card) selectedCard.value = card
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="mb-1 text-2xl font-semibold">EDHREC</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400">
        Croisez les cartes les plus jouées avec un commandant sur EDHREC avec votre pool.
      </p>
    </div>

    <div v-if="prefillSlug" class="flex items-center gap-3 rounded-md bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
      <span>Commandant pré-rempli : <strong>{{ prefillSlug }}</strong></span>
      <button type="button" class="text-xs underline hover:text-slate-700 dark:hover:text-slate-200" @click="clearPrefill">
        Changer
      </button>
    </div>

    <template v-else>
      <div class="flex gap-2">
        <button
          type="button"
          class="rounded-md px-3 py-1.5 text-sm font-medium"
          :class="inputMode === 'pool' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'border border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'"
          @click="inputMode = 'pool'"
        >
          Un de mes commandants
        </button>
        <button
          type="button"
          class="rounded-md px-3 py-1.5 text-sm font-medium"
          :class="inputMode === 'free' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'border border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'"
          @click="inputMode = 'free'"
        >
          Rechercher un commandant
        </button>
      </div>

      <select
        v-if="inputMode === 'pool'"
        v-model="selectedOracleId"
        class="w-full max-w-sm rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
      >
        <option :value="null" disabled>Choisir un commandant…</option>
        <option v-for="card in poolCommanders" :key="card.oracleId" :value="card.oracleId">
          {{ card.printedName ?? card.name }}
        </option>
      </select>

      <div v-else class="max-w-sm space-y-2">
        <div v-if="selectedFreeCommander" class="flex flex-wrap items-center gap-2 text-sm">
          <span>Commandant : <strong>{{ selectedFreeCommander.name }}</strong></span>
          <span
            v-if="!commanderOwned"
            class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300"
          >
            Non possédé
          </span>
          <button type="button" class="text-xs underline hover:text-slate-700 dark:hover:text-slate-200" @click="changeFreeCommander">
            Changer
          </button>
        </div>

        <div v-else class="relative">
          <input
            v-model="searchTerm"
            type="text"
            placeholder="Nom du commandant (anglais de préférence)"
            class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >

          <p v-if="searchLoading" class="mt-1 text-xs text-slate-500 dark:text-slate-400">Recherche…</p>
          <p v-else-if="searchError" class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ searchError }}</p>

          <ul
            v-if="searchResults.length"
            class="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800"
          >
            <li v-for="card in searchResults" :key="card.name">
              <button
                type="button"
                class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                @click="selectCommanderResult(card)"
              >
                <img
                  v-if="searchResultThumbnail(card)"
                  :src="searchResultThumbnail(card)"
                  :alt="card.name"
                  class="h-14 w-auto rounded shadow-sm"
                >
                <span class="flex-1">
                  <span class="block font-medium">{{ card.name }}</span>
                  <span class="block text-xs text-slate-500 dark:text-slate-400">{{ card.type_line }}</span>
                </span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </template>

    <p v-if="edhrecLoading" class="text-sm text-slate-500 dark:text-slate-400">Chargement des données EDHREC…</p>
    <p v-if="edhrecError" class="text-sm text-red-600 dark:text-red-400">{{ edhrecError }}</p>

    <template v-if="edhrecData">
      <p v-if="pricesLoading" class="text-sm text-slate-500 dark:text-slate-400">Récupération des prix…</p>

      <section class="space-y-4 rounded-xl border border-slate-200 p-6 dark:border-slate-800">
        <div class="flex flex-wrap items-center gap-6">
          <div
            class="relative flex h-28 w-28 items-center justify-center rounded-full"
            :style="{ background: `conic-gradient(#10b981 ${completion}%, rgba(148,163,184,0.3) ${completion}% 100%)` }"
          >
            <div class="absolute inset-2 flex items-center justify-center rounded-full bg-white dark:bg-slate-950">
              <span class="text-xl font-semibold">{{ completion }}%</span>
            </div>
          </div>
          <div>
            <p class="font-medium">Complétion estimée du deck moyen</p>
            <p class="text-sm text-slate-500 dark:text-slate-400">
              Pondérée par le taux d'inclusion de chaque carte sur EDHREC.
            </p>
            <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Budget pour compléter le deck moyen :
              <span class="font-semibold text-slate-900 dark:text-white">{{ formatEur(budgetToComplete.total.toFixed(2)) }}</span>
              <span v-if="budgetToComplete.commanderCost !== null" class="ml-1 text-xs text-slate-400 dark:text-slate-500">
                (dont commandant : {{ formatEur(budgetToComplete.commanderCost.toFixed(2)) }})
              </span>
              <span v-if="budgetToComplete.withoutPrice > 0" class="ml-1 text-xs text-slate-400 dark:text-slate-500">
                ({{ budgetToComplete.withoutPrice }} carte{{ budgetToComplete.withoutPrice > 1 ? 's' : '' }} sans prix)
              </span>
            </p>
          </div>
        </div>

        <div v-if="priorityPurchases.length">
          <h2 class="mb-3 text-lg font-semibold">À acheter en priorité</h2>
          <ul class="space-y-2">
            <li
              v-for="card in priorityPurchases"
              :key="card.name"
              class="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800"
              :class="{ 'cursor-pointer': thumbnailFor(card.name) }"
              :role="thumbnailFor(card.name) ? 'button' : undefined"
              :tabindex="thumbnailFor(card.name) ? 0 : undefined"
              @click="openCardDetail(card.name)"
              @keydown.enter="openCardDetail(card.name)"
            >
              <CardHoverImage :small="thumbnailFor(card.name)?.imageSmall" :normal="thumbnailFor(card.name)?.imageNormal" :alt="card.name" />
              <span class="flex-1 font-medium">{{ card.name }}</span>
              <span v-if="card.isCommander" class="text-xs font-medium text-slate-500 dark:text-slate-400">Commandant</span>
              <span v-else class="text-xs text-slate-500 dark:text-slate-400">{{ Math.round(card.inclusion * 1000) / 10 }}% des decks</span>
              <span class="text-right text-xs font-medium text-slate-600 dark:text-slate-300">{{ formatEur(priceFor(card.name)) }}</span>
            </li>
          </ul>
        </div>
      </section>

      <section v-for="list in edhrecData.cardlists" :key="list.header" class="space-y-3">
        <h2 class="text-lg font-semibold">{{ list.header }}</h2>
        <ul class="grid gap-2 sm:grid-cols-2">
          <li
            v-for="card in list.cards"
            :key="card.name"
            class="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800"
            :class="{ 'cursor-pointer': thumbnailFor(card.name) }"
            :role="thumbnailFor(card.name) ? 'button' : undefined"
            :tabindex="thumbnailFor(card.name) ? 0 : undefined"
            @click="openCardDetail(card.name)"
            @keydown.enter="openCardDetail(card.name)"
          >
            <span class="flex-1 truncate" :title="card.name">{{ card.name }}</span>
            <span class="text-xs text-slate-500 dark:text-slate-400">{{ Math.round(card.inclusion * 1000) / 10 }}%</span>
            <span v-if="!isOwned(card.name)" class="text-right text-xs font-medium text-slate-600 dark:text-slate-300">
              {{ formatEur(priceFor(card.name)) }}
            </span>
            <span
              class="rounded-full px-2 py-0.5 text-xs font-medium"
              :class="isOwned(card.name)
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'"
            >
              {{ isOwned(card.name) ? 'Possédée' : 'Manquante' }}
            </span>
          </li>
        </ul>
      </section>
    </template>

    <CardDetailModal :card="selectedCard" :open="selectedCard !== null" @close="selectedCard = null" />
  </div>
</template>
