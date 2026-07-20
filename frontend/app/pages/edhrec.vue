<script setup lang="ts">
import { detectCommanders } from '~~/lib/engine/commanders'
import { isBasicLand, isBasicLandName } from '~~/lib/engine/lands'
import { parseDecklist } from '~~/lib/engine/parse-decklist'
import { scoreDecklist } from '~~/lib/engine/scoring'
import { edhrecSlug } from '~~/lib/engine/slugify'
import type { DecklistEntry, ResolvedCard } from '~~/lib/engine/types'

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

/** Deck moyen réel EDHREC (proxy `/api/edhrec/average/{slug}`) : liste de lignes `"N Nom"`. */
interface EdhrecAverageResponse {
  commander: string
  decklist: string[]
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

const averageData = ref<EdhrecAverageResponse | null>(null)
const averageError = ref('')
const averageLoading = ref(false)
const averagePricesLoading = ref(false)

/** Entrées parsées du deck moyen réel (`parseDecklist`), directement exploitables par `scoreDecklist`. */
const averageEntries = computed<DecklistEntry[]>(() => {
  if (!averageData.value) return []
  return parseDecklist(averageData.value.decklist.join('\n')).entries
})

/** Charge en parallèle les cardlists de la page commandant et le vrai deck moyen EDHREC (deux GET
 *  distincts, sans écriture, donc sans risque de conflit). Les résolutions de prix qui suivent sont
 *  en revanche faites en séquence (jamais deux `resolveByNames` en vol en même temps) : l'API
 *  (`POST /api/cards/resolve`) écrit `resolved_at` en base et deux appels concurrents sur des cartes
 *  qui se recoupent provoquent des deadlocks MySQL (`SQLSTATE[40001]`). */
watch(
  slug,
  async (newSlug) => {
    edhrecData.value = null
    edhrecError.value = ''
    averageData.value = null
    averageError.value = ''
    if (!newSlug) return

    edhrecLoading.value = true
    averageLoading.value = true
    const [cardlistsResult, averageResult] = await Promise.allSettled([
      $fetch<EdhrecResponse>(`/api/edhrec/${newSlug}`, { credentials: 'include' }),
      $fetch<EdhrecAverageResponse>(`/api/edhrec/average/${newSlug}`, { credentials: 'include' }),
    ])
    edhrecLoading.value = false
    averageLoading.value = false

    if (cardlistsResult.status === 'fulfilled') {
      edhrecData.value = cardlistsResult.value
    } else {
      const status = (cardlistsResult.reason as { response?: { status?: number } })?.response?.status
      edhrecError.value = status === 404 ? 'Commandant introuvable sur EDHREC.' : 'Erreur lors de la récupération des données EDHREC.'
    }

    if (averageResult.status === 'fulfilled') {
      averageData.value = averageResult.value
    } else {
      const status = (averageResult.reason as { response?: { status?: number } })?.response?.status
      averageError.value = status === 404 ? 'Deck moyen introuvable sur EDHREC.' : 'Erreur lors de la récupération du deck moyen EDHREC.'
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

    if (averageData.value) {
      const names = Array.from(new Set(averageEntries.value.map((entry) => entry.name)))
      if (names.length > 0) {
        averagePricesLoading.value = true
        try {
          await store.resolveByNames(names)
        } finally {
          averagePricesLoading.value = false
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

/** Taux d'inclusion (max toutes catégories confondues) par nom de carte, tel qu'affiché sur la page
 *  commandant EDHREC. Sert uniquement à annoter la liste de priorités d'achat — sans influence sur
 *  la complétion ni le budget, qui sont désormais calculés sur le vrai deck moyen. */
const inclusionByName = computed(() => {
  const map = new Map<string, number>()
  if (!edhrecData.value) return map
  for (const list of edhrecData.value.cardlists) {
    for (const card of list.cards) {
      const key = card.name.toLowerCase()
      const existing = map.get(key)
      if (existing === undefined || card.inclusion > existing) {
        map.set(key, card.inclusion)
      }
    }
  }
  return map
})

/** Nom du commandant tel qu'il apparaît dans le deck moyen (toujours la première ligne côté EDHREC). */
const averageCommanderName = computed(() => averageEntries.value[0]?.name ?? null)

function thumbnailFor(name: string) {
  return store.lookup.value.byName(name)
}

function priceFor(name: string): string | null | undefined {
  return thumbnailFor(name)?.priceEur
}

/** Score de complétion du deck moyen réel par rapport au pool (collection + decks inclus), tous
 *  éditions confondues. Les terrains de base sont gérés par le moteur (toujours possédés). */
const averageScore = computed(() => {
  if (averageEntries.value.length === 0) return null
  return scoreDecklist(averageEntries.value, store.pool.value, store.lookup.value, { allowOtherEditions: true })
})

const completion = computed(() => averageScore.value?.percent ?? 0)

interface PriorityItem {
  name: string
  inclusion: number | null
  isCommander: boolean
}

/** Manquantes du deck moyen, triées par taux d'inclusion EDHREC décroissant (croisé avec les
 *  cardlists déjà chargées ; sans correspondance → affichée sans %). */
const priorityPurchases = computed<PriorityItem[]>(() => {
  const missing = averageScore.value?.missing ?? []
  return missing
    .filter((card) => card.needed - card.owned > 0)
    .map((card) => ({
      name: card.name,
      inclusion: inclusionByName.value.get(card.name.toLowerCase()) ?? null,
      isCommander: averageCommanderName.value !== null && card.name.toLowerCase() === averageCommanderName.value.toLowerCase(),
    }))
    .sort((a, b) => (b.inclusion ?? -1) - (a.inclusion ?? -1))
    .slice(0, 10)
})

/** Budget pour compléter le deck moyen : somme des prix × quantité manquante (needed - owned) des
 *  cartes absentes du deck moyen réel, plus la mention du coût du commandant s'il figure lui-même
 *  parmi les manquantes (il est naturellement dans le deck moyen : `1 <commandant>`). */
const budgetToComplete = computed(() => {
  let total = 0
  let withoutPrice = 0
  let commanderCost: number | null = null

  const missing = averageScore.value?.missing ?? []
  for (const card of missing) {
    const qty = card.needed - card.owned
    if (qty <= 0) continue

    const price = priceFor(card.name)
    if (price) {
      const cost = Number(price) * qty
      total += cost
      if (averageCommanderName.value !== null && card.name.toLowerCase() === averageCommanderName.value.toLowerCase()) {
        commanderCost = cost
      }
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
      <button type="button" class="btn btn--ghost px-2 py-1 text-xs underline" @click="clearPrefill">
        Changer
      </button>
    </div>

    <template v-else>
      <div class="flex gap-2">
        <button
          type="button"
          class="btn"
          :class="inputMode === 'pool' ? 'btn--primary' : 'btn--secondary'"
          @click="inputMode = 'pool'"
        >
          Un de mes commandants
        </button>
        <button
          type="button"
          class="btn"
          :class="inputMode === 'free' ? 'btn--primary' : 'btn--secondary'"
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
          <span v-if="!commanderOwned" class="badge badge--neutral">Non possédé</span>
          <button type="button" class="btn btn--ghost px-2 py-1 text-xs underline" @click="changeFreeCommander">
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
    <p v-if="averageLoading" class="text-sm text-slate-500 dark:text-slate-400">Chargement du deck moyen…</p>
    <p v-if="averageError" class="text-sm text-red-600 dark:text-red-400">{{ averageError }}</p>

    <template v-if="averageData">
      <p v-if="averagePricesLoading || pricesLoading" class="text-sm text-slate-500 dark:text-slate-400">Récupération des prix…</p>

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
            <p class="font-medium">Complétion du deck moyen</p>
            <p class="text-sm text-slate-500 dark:text-slate-400">
              {{ averageScore?.ownedCount ?? 0 }} / {{ averageScore?.total ?? 0 }} cartes du vrai deck moyen EDHREC déjà possédées.
            </p>
            <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Budget pour le compléter :
              <span class="font-semibold text-slate-900 dark:text-white">{{ formatEur(budgetToComplete.total.toFixed(2)) }}</span>
              <span v-if="budgetToComplete.commanderCost !== null" class="ml-1 text-xs text-slate-400 dark:text-slate-500">
                (dont commandant : {{ formatEur(budgetToComplete.commanderCost.toFixed(2)) }})
              </span>
              <span v-if="budgetToComplete.withoutPrice > 0" class="ml-1 text-xs text-slate-400 dark:text-slate-500">
                ({{ budgetToComplete.withoutPrice }} carte{{ budgetToComplete.withoutPrice > 1 ? 's' : '' }} sans prix)
              </span>
            </p>
            <a
              :href="`https://edhrec.com/average-decks/${slug}`"
              target="_blank"
              rel="noopener"
              class="mt-1 inline-block text-xs text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline dark:text-slate-500 dark:hover:text-slate-300"
            >
              Source : deck moyen sur EDHREC
            </a>
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
              <span v-else-if="card.inclusion !== null" class="text-xs text-slate-500 dark:text-slate-400">{{ Math.round(card.inclusion * 1000) / 10 }}% des decks</span>
              <span v-else class="text-xs text-slate-400 dark:text-slate-500">—</span>
              <span class="text-right text-xs font-medium text-slate-600 dark:text-slate-300">{{ formatEur(priceFor(card.name)) }}</span>
            </li>
          </ul>
        </div>
      </section>
    </template>

    <template v-if="edhrecData">
      <section v-for="(list, index) in edhrecData.cardlists" :key="list.header" class="space-y-3">
        <div>
          <h2 class="text-lg font-semibold">{{ list.header }}</h2>
          <p v-if="index === 0" class="text-xs text-slate-500 dark:text-slate-400">
            Recommandations par catégorie (catalogue EDHREC) — sans influence sur la complétion ni le budget ci-dessus.
            <a
              :href="`https://edhrec.com/commanders/${slug}`"
              target="_blank"
              rel="noopener"
              class="underline-offset-2 hover:text-slate-700 hover:underline dark:hover:text-slate-300"
            >
              Source : page commandant sur EDHREC
            </a>
          </p>
        </div>
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
            <span class="badge" :class="isOwned(card.name) ? 'badge--owned' : 'badge--missing'">
              {{ isOwned(card.name) ? 'Possédée' : 'Manquante' }}
            </span>
          </li>
        </ul>
      </section>
    </template>

    <CardDetailModal :card="selectedCard" :open="selectedCard !== null" @close="selectedCard = null" />
  </div>
</template>
