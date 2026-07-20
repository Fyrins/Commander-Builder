<script setup lang="ts">
import { detectCommanders } from '~~/lib/engine/commanders'
import { edhrecSlug } from '~~/lib/engine/slugify'

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

const store = useCollectionStore()
const route = useRoute()

onMounted(() => {
  if (!store.loaded.value) store.loadAll()
})

const prefillSlug = ref<string | null>(typeof route.query.commander === 'string' ? route.query.commander : null)

type InputMode = 'pool' | 'free'
const inputMode = ref<InputMode>('pool')
const selectedOracleId = ref<string | null>(null)
const freeName = ref('')

const poolCommanders = computed(() => detectCommanders(store.poolCards.value))

watch([selectedOracleId, freeName, inputMode], () => {
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
  return freeName.value.trim() ? edhrecSlug(freeName.value.trim()) : ''
})

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

function isOwned(cardName: string): boolean {
  return ownedNameIndex.value.has(cardName.trim().toLowerCase())
}

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

const priorityPurchases = computed(() =>
  allCardsFlat.value
    .filter((card) => !isOwned(card.name))
    .sort((a, b) => b.inclusion - a.inclusion)
    .slice(0, 10),
)

function thumbnailFor(name: string) {
  return store.lookup.value.byName(name)
}

function priceFor(name: string): string | null | undefined {
  return thumbnailFor(name)?.priceEur
}

/** Budget pour compléter le deck moyen : somme des prix des manquantes uniques (1 exemplaire chacune). */
const budgetToComplete = computed(() => {
  let total = 0
  let withoutPrice = 0
  for (const card of allCardsFlat.value) {
    if (isOwned(card.name)) continue
    const price = priceFor(card.name)
    if (price) total += Number(price)
    else withoutPrice += 1
  }
  return { total, withoutPrice }
})
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
          Nom libre
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

      <input
        v-else
        v-model="freeName"
        type="text"
        placeholder="Nom du commandant (anglais de préférence)"
        class="w-full max-w-sm rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
      >
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
            >
              <CardHoverImage :small="thumbnailFor(card.name)?.imageSmall" :normal="thumbnailFor(card.name)?.imageNormal" :alt="card.name" />
              <span class="flex-1 font-medium">{{ card.name }}</span>
              <span class="text-xs text-slate-500 dark:text-slate-400">{{ Math.round(card.inclusion * 1000) / 10 }}% des decks</span>
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
  </div>
</template>
