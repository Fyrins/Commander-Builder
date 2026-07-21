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

/** Entrée du top 60 EDHREC (proxy `/api/edhrec/top`, cache serveur 24 h). */
interface EdhrecTopCommander {
  name: string
  slug: string
  numDecks: number
}

interface EdhrecTopResponse {
  commanders: EdhrecTopCommander[]
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

/** Une ligne de la liste des decks, déjà scorée par rapport au pool de l'utilisateur. */
interface DeckCandidate {
  slug: string
  commanderName: string
  numDecks: number | null
  percent: number
  ownedCount: number
  total: number
  missingBudget: number
  isOwnedCommander: boolean
}

const store = useCollectionStore()
const route = useRoute()
const router = useRouter()

onMounted(() => {
  if (!store.loaded.value) store.loadAll()
})

/** Slug du deck actuellement affiché en fiche détail (`?commander=<slug>`) — absent = vue liste. */
const selectedSlug = computed(() => (typeof route.query.commander === 'string' && route.query.commander ? route.query.commander : null))

function openDeck(slug: string): void {
  router.push({ query: { commander: slug } })
}

function goBackToList(): void {
  router.push({ path: '/decks' })
}

// ---------------------------------------------------------------------------
// File d'attente de résolution — jamais deux `resolveByNames` en vol en même
// temps (deadlocks MySQL connus), y compris entre le classement des decks et
// la fiche détail si les deux se déclenchent à peu près en même temps.
// ---------------------------------------------------------------------------
const resolveMutex = useState<Promise<unknown>>('decks:resolve-mutex', () => Promise.resolve())

async function resolveNamesSafely(names: string[]): Promise<void> {
  const previous = resolveMutex.value
  const run = previous.catch(() => undefined).then(() => store.resolveByNames(names))
  resolveMutex.value = run
  await run
}

// ---------------------------------------------------------------------------
// Vue liste — classement des decks moyens par % de compatibilité avec le pool
// ---------------------------------------------------------------------------
const RANKING_BATCH_SIZE = 5

const rankingState = useState<DeckCandidate[] | null>('decks:ranking', () => null)
const rankingProgress = useState<{ done: number; total: number }>('decks:ranking-progress', () => ({ done: 0, total: 0 }))
const rankingLoading = useState<boolean>('decks:ranking-loading', () => false)
const rankingResolving = useState<boolean>('decks:ranking-resolving', () => false)
const rankingError = useState<string>('decks:ranking-error', () => '')
const averageCache = useState<Map<string, EdhrecAverageResponse>>('decks:average-cache', () => new Map())

/** Calcule (une seule fois par session) le classement des decks candidats :
 *  commandants détectés dans le pool ∪ top 60 EDHREC, dédupliqués par slug.
 *  Fetch des average-decks par lots parallèles de 5, puis UNE résolution de
 *  prix groupée (union de tous les noms), puis scoring local (pur, rapide). */
async function computeRanking(): Promise<void> {
  if (rankingState.value !== null || rankingLoading.value) return
  if (!store.loaded.value) return

  rankingLoading.value = true
  rankingError.value = ''
  try {
    const topResp = await $fetch<EdhrecTopResponse>('/api/edhrec/top', { credentials: 'include' })
    const poolCommanders = detectCommanders(store.poolCards.value)
    const ownedSlugs = new Set(poolCommanders.map((c) => edhrecSlug(c.name)))

    const numDecksBySlug = new Map<string, number | null>()
    for (const commander of poolCommanders) {
      const slug = edhrecSlug(commander.name)
      if (!numDecksBySlug.has(slug)) numDecksBySlug.set(slug, null)
    }
    for (const commander of topResp.commanders) {
      numDecksBySlug.set(commander.slug, commander.numDecks)
    }

    const candidates = [...numDecksBySlug.entries()].map(([slug, numDecks]) => ({ slug, numDecks }))
    rankingProgress.value = { done: 0, total: candidates.length }

    const parsed: { slug: string; numDecks: number | null; entries: DecklistEntry[] }[] = []

    for (let i = 0; i < candidates.length; i += RANKING_BATCH_SIZE) {
      const batch = candidates.slice(i, i + RANKING_BATCH_SIZE)
      const settled = await Promise.allSettled(
        batch.map(async (candidate) => {
          let payload = averageCache.value.get(candidate.slug)
          if (!payload) {
            payload = await $fetch<EdhrecAverageResponse>(`/api/edhrec/average/${candidate.slug}`, { credentials: 'include' })
            averageCache.value.set(candidate.slug, payload)
          }
          return {
            slug: candidate.slug,
            numDecks: candidate.numDecks,
            entries: parseDecklist(payload.decklist.join('\n')).entries,
          }
        }),
      )

      settled.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          parsed.push(result.value)
        } else {
          // 404 (slug EDHREC invalide) ou erreur réseau ponctuelle : ignoré silencieusement.
          console.log(`[decks] deck moyen introuvable pour "${batch[index]!.slug}"`, result.reason)
        }
      })

      rankingProgress.value = { done: Math.min(i + batch.length, candidates.length), total: candidates.length }
    }

    const allNames = new Set<string>()
    for (const item of parsed) {
      for (const entry of item.entries) allNames.add(entry.name)
    }

    rankingResolving.value = true
    try {
      await resolveNamesSafely([...allNames])
    } finally {
      rankingResolving.value = false
    }

    const ranked: DeckCandidate[] = parsed.map((item) => {
      const score = scoreDecklist(item.entries, store.pool.value, store.lookup.value, { allowOtherEditions: true })

      let missingBudget = 0
      for (const card of score.missing) {
        const qty = card.needed - card.owned
        if (qty <= 0) continue
        const price = store.lookup.value.byName(card.name)?.priceEur
        if (price) missingBudget += Number(price) * qty
      }

      return {
        slug: item.slug,
        commanderName: item.entries[0]?.name ?? item.slug,
        numDecks: item.numDecks,
        percent: score.percent,
        ownedCount: score.ownedCount,
        total: score.total,
        missingBudget: Math.round(missingBudget * 100) / 100,
        isOwnedCommander: ownedSlugs.has(item.slug),
      }
    })

    ranked.sort((a, b) => b.percent - a.percent || a.missingBudget - b.missingBudget)
    rankingState.value = ranked
  } catch {
    rankingError.value = 'Erreur lors du calcul du classement des decks.'
  } finally {
    rankingLoading.value = false
  }
}

watch(
  () => [store.loaded.value, selectedSlug.value] as const,
  ([loaded, slug]) => {
    if (loaded && !slug) void computeRanking()
  },
  { immediate: true },
)

/** Vue-modèle des cartes de la liste, avec miniature et identité couleur du commandant. */
const rankingDisplay = computed(() => {
  if (!rankingState.value) return []
  return rankingState.value.map((candidate) => {
    const card = store.lookup.value.byName(candidate.commanderName)
    return {
      ...candidate,
      imageSmall: card?.imageSmall,
      imageNormal: card?.imageNormal,
      colors: card?.colorIdentity ?? [],
    }
  })
})

const filterText = ref('')
const onlyOwnedCommanders = ref(false)

const filteredRanking = computed(() => {
  const term = filterText.value.trim().toLowerCase()
  return rankingDisplay.value.filter((deck) => {
    if (onlyOwnedCommanders.value && !deck.isOwnedCommander) return false
    if (term && !deck.commanderName.toLowerCase().includes(term)) return false
    return true
  })
})

// Recherche libre de commandant (autocomplétion Scryfall) : sélection → ouverture directe de la
// fiche du deck correspondant, même s'il n'apparaît pas dans le classement.
const searchTerm = ref('')
const searchResults = ref<ScryfallSearchCard[]>([])
const searchLoading = ref(false)
const searchError = ref('')
let searchDebounce: ReturnType<typeof setTimeout> | undefined

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
  searchResults.value = []
  searchTerm.value = ''
  searchError.value = ''
  openDeck(edhrecSlug(card.name))
}

// ---------------------------------------------------------------------------
// Fiche deck (vue détail)
// ---------------------------------------------------------------------------
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
 *  distincts, sans écriture, donc sans risque de conflit). Le deck moyen peut déjà être en cache
 *  (calculé par le classement de la liste) : dans ce cas il n'est pas re-fetché. Les résolutions de
 *  prix qui suivent passent par `resolveNamesSafely` : jamais deux résolutions en vol en même temps
 *  (l'API `POST /api/cards/resolve` écrit `resolved_at` en base et deux appels concurrents sur des
 *  cartes qui se recoupent provoquent des deadlocks MySQL `SQLSTATE[40001]`). */
watch(
  selectedSlug,
  async (newSlug) => {
    edhrecData.value = null
    edhrecError.value = ''
    averageData.value = null
    averageError.value = ''
    if (!newSlug) return

    const cachedAverage = averageCache.value.get(newSlug)

    edhrecLoading.value = true
    if (!cachedAverage) averageLoading.value = true

    const fetches: Promise<void>[] = [
      $fetch<EdhrecResponse>(`/api/edhrec/${newSlug}`, { credentials: 'include' })
        .then((data) => {
          edhrecData.value = data
        })
        .catch((error: unknown) => {
          const status = (error as { response?: { status?: number } })?.response?.status
          edhrecError.value = status === 404 ? 'Commandant introuvable sur EDHREC.' : 'Erreur lors de la récupération des données EDHREC.'
        })
        .finally(() => {
          edhrecLoading.value = false
        }),
    ]

    if (cachedAverage) {
      averageData.value = cachedAverage
    } else {
      fetches.push(
        $fetch<EdhrecAverageResponse>(`/api/edhrec/average/${newSlug}`, { credentials: 'include' })
          .then((data) => {
            averageData.value = data
            averageCache.value.set(newSlug, data)
          })
          .catch((error: unknown) => {
            const status = (error as { response?: { status?: number } })?.response?.status
            averageError.value = status === 404 ? 'Deck moyen introuvable sur EDHREC.' : 'Erreur lors de la récupération du deck moyen EDHREC.'
          })
          .finally(() => {
            averageLoading.value = false
          }),
      )
    }

    await Promise.all(fetches)

    if (edhrecData.value) {
      const names = Array.from(new Set(edhrecData.value.cardlists.flatMap((list) => list.cards.map((card) => card.name))))
      if (names.length > 0) {
        pricesLoading.value = true
        try {
          await resolveNamesSafely(names)
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
          await resolveNamesSafely(names)
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

function thumbnailFor(name: string) {
  return store.lookup.value.byName(name)
}

/** Prix le plus bas (toutes éditions) pour la carte, avec repli sur l'édition résolue. */
function priceFor(name: string): string | null | undefined {
  const card = thumbnailFor(name)
  return store.cheapestFor(card?.oracleId)?.priceEur ?? card?.priceEur
}

/** Édition la moins chère (set) pour la carte, si connue. */
function cheapestSetFor(name: string): string | null {
  return store.cheapestFor(thumbnailFor(name)?.oracleId)?.setCode ?? null
}

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

const commanderCard = computed(() => (averageCommanderName.value ? thumbnailFor(averageCommanderName.value) : undefined))

/** Score de complétion du deck moyen réel par rapport au pool (collection + decks inclus), tous
 *  éditions confondues. Les terrains de base sont gérés par le moteur (toujours possédés). */
const averageScore = computed(() => {
  if (averageEntries.value.length === 0) return null
  return scoreDecklist(averageEntries.value, store.pool.value, store.lookup.value, { allowOtherEditions: true })
})

const completion = computed(() => averageScore.value?.percent ?? 0)

// Récupère l'édition la moins chère des cartes manquantes pour chiffrer le
// budget au prix le plus bas (cache serveur partagé par oracle_id).
watch(
  () => averageScore.value?.missing,
  async (missing) => {
    if (!missing?.length) return
    const oracleIds = missing
      .filter((card) => card.needed - card.owned > 0)
      .map((card) => thumbnailFor(card.name)?.oracleId)
      .filter((id): id is string => Boolean(id))
    await store.fetchCheapest(oracleIds)
  },
  { immediate: true },
)

/** Quantité de terrains de base du deck moyen (auto-possédés, inclus dans ownedCount). */
const basicsOwnedCount = computed(() =>
  averageEntries.value.reduce((sum, entry) => (isBasicLandName(entry.name) ? sum + entry.quantity : sum), 0),
)

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
    <!-- ===================== Vue détail (fiche deck) ===================== -->
    <template v-if="selectedSlug">
      <div class="flex items-center gap-3">
        <button type="button" class="btn btn--secondary" @click="goBackToList">
          ← Retour à la liste
        </button>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-2xl font-semibold">{{ averageCommanderName ?? selectedSlug }}</h1>
        <ColorPips v-if="commanderCard" :colors="commanderCard.colorIdentity" />
      </div>

      <p v-if="edhrecLoading" class="text-sm text-muted">Chargement des données EDHREC…</p>
      <p v-if="edhrecError" class="text-sm text-red-600 dark:text-red-400">{{ edhrecError }}</p>
      <p v-if="averageLoading" class="text-sm text-muted">Chargement du deck moyen…</p>
      <p v-if="averageError" class="text-sm text-red-600 dark:text-red-400">{{ averageError }}</p>

      <template v-if="averageData">
        <p v-if="averagePricesLoading || pricesLoading" class="text-sm text-muted">Récupération des prix…</p>

        <section class="space-y-4 panel p-6 ">
          <div class="flex flex-wrap items-center gap-6">
            <div
              class="ring relative flex h-28 w-28 items-center justify-center"
              :style="{ '--ring-target': completion }"
            >
              <div class="absolute inset-2 flex items-center justify-center rounded-full surface">
                <span class="stat-value text-xl font-semibold">{{ completion }}%</span>
              </div>
            </div>
            <div>
              <p class="font-medium">Complétion du deck moyen</p>
              <p class="text-sm text-muted">
                {{ averageScore?.ownedCount ?? 0 }} / {{ averageScore?.total ?? 0 }} cartes du vrai deck moyen EDHREC déjà possédées<template v-if="basicsOwnedCount > 0">, dont {{ basicsOwnedCount }} terrains de base considérés possédés</template>.
              </p>
              <p class="mt-1 text-sm text-muted">
                Budget au meilleur prix :
                <span class="font-semibold text-strong">{{ formatEur(budgetToComplete.total.toFixed(2)) }}</span>
                <span v-if="budgetToComplete.commanderCost !== null" class="ml-1 text-xs text-muted">
                  (dont commandant : {{ formatEur(budgetToComplete.commanderCost.toFixed(2)) }})
                </span>
                <span v-if="budgetToComplete.withoutPrice > 0" class="ml-1 text-xs text-muted">
                  ({{ budgetToComplete.withoutPrice }} carte{{ budgetToComplete.withoutPrice > 1 ? 's' : '' }} sans prix)
                </span>
              </p>
              <a
                :href="`https://edhrec.com/average-decks/${selectedSlug}`"
                target="_blank"
                rel="noopener"
                class="mt-1 inline-block text-xs text-muted underline-offset-2 hover:text-gold hover:underline"
              >
                Source : deck moyen sur EDHREC
              </a>
            </div>
          </div>

          <BasicLandsSummary :entries="averageEntries" />

          <div v-if="priorityPurchases.length">
            <h2 class="mb-3 text-lg font-semibold">À acheter en priorité</h2>
            <ul class="space-y-2">
              <li
                v-for="card in priorityPurchases"
                :key="card.name"
                class="flex items-center gap-3 panel px-3 py-2 "
                :class="{ 'cursor-pointer': thumbnailFor(card.name) }"
                :role="thumbnailFor(card.name) ? 'button' : undefined"
                :tabindex="thumbnailFor(card.name) ? 0 : undefined"
                @click="openCardDetail(card.name)"
                @keydown.enter="openCardDetail(card.name)"
              >
                <CardHoverImage :small="thumbnailFor(card.name)?.imageSmall" :normal="thumbnailFor(card.name)?.imageNormal" :alt="card.name" />
                <span class="flex-1 font-medium">{{ card.name }}</span>
                <span v-if="card.isCommander" class="text-xs font-medium text-muted">Commandant</span>
                <span v-else-if="card.inclusion !== null" class="text-xs text-muted">{{ Math.round(card.inclusion * 1000) / 10 }}% des decks</span>
                <span v-else class="text-xs text-muted">—</span>
                <span class="text-right text-xs font-medium text-muted">
                  {{ formatEur(priceFor(card.name)) }}
                  <span v-if="cheapestSetFor(card.name)" class="uppercase text-gold">· {{ cheapestSetFor(card.name) }}</span>
                </span>
              </li>
            </ul>
          </div>
        </section>

        <DeckStats v-if="averageScore" :entries="averageEntries" :lookup="store.lookup.value" :total="averageScore.total" />
      </template>

      <details v-if="edhrecData" class="panel p-4 ">
        <summary class="cursor-pointer text-lg font-semibold">Recommandations par catégorie</summary>
        <p class="mt-2 text-xs text-muted">
          Catalogue EDHREC — sans influence sur la complétion ni le budget ci-dessus.
          <a
            :href="`https://edhrec.com/commanders/${selectedSlug}`"
            target="_blank"
            rel="noopener"
            class="underline-offset-2 hover:text-gold hover:underline"
          >
            Source : page commandant sur EDHREC
          </a>
        </p>

        <section v-for="list in edhrecData.cardlists" :key="list.header" class="mt-4 space-y-3">
          <h3 class="font-medium">{{ list.header }}</h3>
          <ul class="grid gap-2 sm:grid-cols-2">
            <li
              v-for="card in list.cards"
              :key="card.name"
              class="flex items-center gap-3 panel px-3 py-2 "
              :class="{ 'cursor-pointer': thumbnailFor(card.name) }"
              :role="thumbnailFor(card.name) ? 'button' : undefined"
              :tabindex="thumbnailFor(card.name) ? 0 : undefined"
              @click="openCardDetail(card.name)"
              @keydown.enter="openCardDetail(card.name)"
            >
              <span class="flex-1 truncate" :title="card.name">{{ card.name }}</span>
              <span class="text-xs text-muted">{{ Math.round(card.inclusion * 1000) / 10 }}%</span>
              <span v-if="!isOwned(card.name)" class="text-right text-xs font-medium text-muted">
                {{ formatEur(priceFor(card.name)) }}
              </span>
              <span class="badge" :class="isOwned(card.name) ? 'badge--owned' : 'badge--missing'">
                {{ isOwned(card.name) ? 'Possédée' : 'Manquante' }}
              </span>
            </li>
          </ul>
        </section>
      </details>

      <CardDetailModal :card="selectedCard" :open="selectedCard !== null" @close="selectedCard = null" />
    </template>

    <!-- ===================== Vue liste (decks classés) ===================== -->
    <template v-else>
      <div>
        <h1 class="mb-1 text-2xl font-semibold">Decks</h1>
        <p class="text-sm text-muted">
          Decks moyens EDHREC classés par compatibilité avec votre pool. Cliquez sur un deck pour voir la fiche complète.
        </p>
      </div>

      <div class="relative max-w-sm">
        <input
          v-model="searchTerm"
          type="text"
          placeholder="Rechercher un commandant (anglais de préférence)…"
          class="field"
        >

        <p v-if="searchLoading" class="mt-1 text-xs text-muted">Recherche…</p>
        <p v-else-if="searchError" class="mt-1 text-xs text-muted">{{ searchError }}</p>

        <ul
          v-if="searchResults.length"
          class="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-md panel shadow-lg  "
        >
          <li v-for="card in searchResults" :key="card.name">
            <button
              type="button"
              class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:surface-alt"
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
                <span class="block text-xs text-muted">{{ card.type_line }}</span>
              </span>
            </button>
          </li>
        </ul>
      </div>

      <div class="flex flex-wrap items-center gap-4">
        <input
          v-model="filterText"
          type="text"
          placeholder="Filtrer la liste par nom de commandant…"
          class="w-full max-w-xs rounded-md field-select px-3 py-2 text-sm text-strong focus:hairline-strong focus:outline-none   "
        >
        <label class="flex items-center gap-2 text-sm text-muted">
          <input v-model="onlyOwnedCommanders" type="checkbox" class="rounded hairline-strong">
          Seulement mes commandants
        </label>
      </div>

      <div v-if="rankingLoading" class="space-y-2">
        <p class="text-sm text-muted">
          Analyse des decks {{ rankingProgress.done }}/{{ rankingProgress.total }}…
        </p>
        <ProgressBar :percent="rankingProgress.total ? (rankingProgress.done / rankingProgress.total) * 100 : 0" />
      </div>
      <p v-else-if="rankingResolving" class="text-sm text-muted">Résolution des cartes…</p>
      <p v-if="rankingError" class="text-sm text-red-600 dark:text-red-400">{{ rankingError }}</p>

      <div v-if="rankingState" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <DeckListCard v-for="deck in filteredRanking" :key="deck.slug" :deck="deck" @select="openDeck" />
      </div>
      <p v-if="rankingState && filteredRanking.length === 0" class="text-sm text-muted">
        Aucun deck ne correspond à ce filtre.
      </p>
    </template>
  </div>
</template>
