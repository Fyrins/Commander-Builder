/**
 * État global de la collection : collection possédée, decks, cartes
 * résolues (cache local), pool fusionné et index oracle. Toute la
 * mécanique de matching passe par le moteur pur (~~/lib/engine).
 */
import { buildPool, buildOracleIndex, type OracleIndexResult } from '~~/lib/engine/inventory'
import { createCardLookup } from '~~/lib/engine/types'
import { parseManaBoxCsv } from '~~/lib/engine/parse-csv'
import { parseDecklist } from '~~/lib/engine/parse-decklist'
import type { CardLookup, CollectionRow, DecklistEntry, PoolItem, ResolvedCard } from '~~/lib/engine/types'

interface ApiCollectionItem {
  scryfallId: string
  quantity: number
  foil: boolean
  language: string
  condition: string | null
}

interface ApiDeckItem {
  nameRaw: string
  setCode: string | null
  collectorNumber: string | null
  quantity: number
  foil: boolean
}

export interface ApiDeck {
  id: number
  name: string
  isOwnedDeck: boolean
  includeInPool: boolean
  items: ApiDeckItem[]
}

interface ResolveIdentifier {
  scryfallId?: string
  set?: string
  collectorNumber?: string
  name?: string
}

interface ResolveResponse {
  cards: ResolvedCard[]
  not_found: unknown[]
  debug: { from_cache: number; from_scryfall: number }
}

const CHUNK_SIZE = 300

function toCollectionRow(item: ApiCollectionItem, card: ResolvedCard | undefined): CollectionRow {
  return {
    name: card?.name ?? item.scryfallId,
    setCode: card?.setCode ?? '',
    setName: card?.setCode ? card.setCode.toUpperCase() : '',
    collectorNumber: card?.collectorNumber ?? '',
    foil: item.foil,
    rarity: '',
    quantity: item.quantity,
    scryfallId: item.scryfallId,
    language: item.language,
    condition: item.condition ?? '',
  }
}

export function useCollectionStore() {
  const collectionRows = useState<CollectionRow[]>('store:collectionRows', () => [])
  const decks = useState<ApiDeck[]>('store:decks', () => [])
  const resolvedCards = useState<Map<string, ResolvedCard>>('store:resolvedCards', () => new Map())
  const lookup = useState<CardLookup>('store:lookup', () => createCardLookup([]))
  const pool = useState<PoolItem[]>('store:pool', () => [])
  const oracleIndex = useState<OracleIndexResult>('store:oracleIndex', () => ({
    index: new Map(),
    unresolved: [],
  }))

  const loading = useState<boolean>('store:loading', () => false)
  const progress = useState<{ done: number; total: number }>('store:progress', () => ({ done: 0, total: 0 }))
  const loaded = useState<boolean>('store:loaded', () => false)

  /** Une carte représentative par oracleId réellement présent dans le pool (quantité > 0). */
  const poolCards = computed<ResolvedCard[]>(() => {
    const cards: ResolvedCard[] = []
    for (const data of oracleIndex.value.index.values()) {
      if (data.quantity > 0 && data.printings.length > 0) {
        cards.push(data.printings[0])
      }
    }
    return cards
  })

  function decksForEngine(sourceDecks: ApiDeck[] = decks.value) {
    return sourceDecks.map((deck) => ({
      name: deck.name,
      include: deck.includeInPool,
      entries: deck.items.map(
        (item): DecklistEntry => ({
          quantity: item.quantity,
          name: item.nameRaw,
          setCode: item.setCode ?? undefined,
          collectorNumber: item.collectorNumber ?? undefined,
          foil: item.foil,
        }),
      ),
    }))
  }

  function rebuildPool() {
    pool.value = buildPool(collectionRows.value, decksForEngine())
    oracleIndex.value = buildOracleIndex(pool.value, lookup.value)
  }

  function rebuildLookup() {
    lookup.value = createCardLookup(Array.from(resolvedCards.value.values()))
  }

  /** Résout par lots (≤300) une liste d'identifiants, en accumulant les cartes obtenues. */
  async function resolveIdentifiers(identifiers: ResolveIdentifier[]) {
    progress.value = { done: 0, total: identifiers.length }
    if (identifiers.length === 0) return

    for (let i = 0; i < identifiers.length; i += CHUNK_SIZE) {
      const chunk = identifiers.slice(i, i + CHUNK_SIZE)
      const response = await $fetch<ResolveResponse>('/api/cards/resolve', {
        method: 'POST',
        credentials: 'include',
        body: { identifiers: chunk },
      })
      for (const card of response.cards) {
        resolvedCards.value.set(card.scryfallId, card)
      }
      progress.value = { done: Math.min(i + chunk.length, identifiers.length), total: identifiers.length }
    }
    rebuildLookup()
  }

  /** Résout par lots (≤300) une liste de noms EN, en accumulant les cartes obtenues (même mécanique que resolveIdentifiers). */
  async function resolveByNames(names: string[]): Promise<void> {
    if (names.length === 0) return

    for (let i = 0; i < names.length; i += CHUNK_SIZE) {
      const chunk = names.slice(i, i + CHUNK_SIZE)
      const response = await $fetch<ResolveResponse>('/api/cards/resolve', {
        method: 'POST',
        credentials: 'include',
        body: { identifiers: chunk.map((name) => ({ name })) },
      })
      for (const card of response.cards) {
        resolvedCards.value.set(card.scryfallId, card)
      }
    }
    rebuildLookup()
  }

  function collectIdentifiers(collectionItems: ApiCollectionItem[], deckList: ApiDeck[]): ResolveIdentifier[] {
    const identifiers: ResolveIdentifier[] = []
    const seen = new Set<string>()

    for (const item of collectionItems) {
      if (!item.scryfallId) continue
      const key = `id:${item.scryfallId}`
      if (seen.has(key)) continue
      seen.add(key)
      identifiers.push({ scryfallId: item.scryfallId })
    }

    for (const deck of deckList) {
      for (const item of deck.items) {
        if (!item.setCode || !item.collectorNumber) continue
        const key = `sn:${item.setCode.toLowerCase()}|${item.collectorNumber.toLowerCase()}`
        if (seen.has(key)) continue
        seen.add(key)
        identifiers.push({ set: item.setCode, collectorNumber: item.collectorNumber })
      }
    }

    return identifiers
  }

  /** Charge collection + decks depuis l'API, résout les cartes, reconstruit pool/index. */
  async function loadAll() {
    loading.value = true
    try {
      const [collectionItems, deckList] = await Promise.all([
        $fetch<ApiCollectionItem[]>('/api/collection', { credentials: 'include' }),
        $fetch<ApiDeck[]>('/api/decks', { credentials: 'include' }),
      ])

      decks.value = deckList

      const identifiers = collectIdentifiers(collectionItems, deckList)
      await resolveIdentifiers(identifiers)

      collectionRows.value = collectionItems.map((item) => toCollectionRow(item, resolvedCards.value.get(item.scryfallId)))

      rebuildPool()
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  /** Remplace intégralement la collection à partir d'un CSV ManaBox. */
  async function importCsv(file: File): Promise<{ errors: string[]; count: number }> {
    const text = await file.text()
    const { rows, errors } = parseManaBoxCsv(text)

    if (rows.length > 0) {
      await $fetch('/api/collection', {
        method: 'PUT',
        credentials: 'include',
        body: {
          items: rows.map((row) => ({
            scryfallId: row.scryfallId,
            quantity: row.quantity,
            foil: row.foil,
            language: row.language,
            condition: row.condition,
          })),
        },
      })
      await loadAll()
    }

    return { errors, count: rows.length }
  }

  /** Importe une decklist texte comme nouveau deck. */
  async function importDeck(name: string, text: string, isOwnedDeck: boolean): Promise<{ errors: string[]; count: number }> {
    const { entries, errors } = parseDecklist(text)

    if (entries.length > 0) {
      await $fetch('/api/decks', {
        method: 'POST',
        credentials: 'include',
        body: {
          name,
          isOwnedDeck,
          items: entries.map((entry) => ({
            nameRaw: entry.name,
            setCode: entry.setCode ?? null,
            collectorNumber: entry.collectorNumber ?? null,
            quantity: entry.quantity,
            foil: entry.foil,
          })),
        },
      })
      await loadAll()
    }

    return { errors, count: entries.length }
  }

  async function toggleDeckInclude(deck: ApiDeck): Promise<void> {
    const nextValue = !deck.includeInPool
    await $fetch(`/api/decks/${deck.id}`, {
      method: 'PATCH',
      credentials: 'include',
      body: { includeInPool: nextValue },
    })
    const target = decks.value.find((d) => d.id === deck.id)
    if (target) target.includeInPool = nextValue
    rebuildPool()
  }

  async function deleteDeck(deck: ApiDeck): Promise<void> {
    await $fetch(`/api/decks/${deck.id}`, { method: 'DELETE', credentials: 'include' })
    decks.value = decks.value.filter((d) => d.id !== deck.id)
    rebuildPool()
  }

  /** Vide tout l'état (obligatoire au changement d'utilisateur, sinon données périmées). */
  function reset() {
    collectionRows.value = []
    decks.value = []
    resolvedCards.value = new Map()
    lookup.value = createCardLookup([])
    pool.value = []
    oracleIndex.value = { index: new Map(), unresolved: [] }
    progress.value = { done: 0, total: 0 }
    loading.value = false
    loaded.value = false
  }

  return {
    reset,
    collectionRows,
    decks,
    resolvedCards,
    lookup,
    pool,
    oracleIndex,
    poolCards,
    loading,
    progress,
    loaded,
    loadAll,
    importCsv,
    importDeck,
    toggleDeckInclude,
    deleteDeck,
    decksForEngine,
    rebuildPool,
    resolveByNames,
  }
}
