/**
 * Fusion de la collection et des decks inclus en un pool unique, et
 * agrégation de ce pool par oracleId (toutes éditions confondues).
 */
import type { CardLookup, CollectionRow, DecklistEntry, PoolItem, ResolvedCard } from './types'

interface DeckInput {
  name: string
  entries: DecklistEntry[]
  include: boolean
}

interface FusionKeyInput {
  scryfallId?: string
  setCode?: string
  collectorNumber?: string
  name?: string
}

function setNumKey(set: string, num: string): string {
  return `sn:${set.trim().toLowerCase()}|${num.trim().toLowerCase()}`
}

function nameKey(name: string): string {
  return `nm:${name.trim().toLowerCase()}`
}

/** Clé de fusion : scryfallId si présent, sinon set|num, sinon nom normalisé. */
function fusionKey(item: FusionKeyInput): string {
  if (item.scryfallId) return `id:${item.scryfallId}`
  if (item.setCode && item.collectorNumber) return setNumKey(item.setCode, item.collectorNumber)
  if (item.name) return nameKey(item.name)
  throw new Error('Impossible de calculer une clé de fusion : aucun identifiant disponible')
}

/**
 * Fusionne la collection et les decks marqués `include` en un pool unique.
 * `sources` trace la provenance de chaque item ('collection' ou nom du deck).
 */
export function buildPool(collection: CollectionRow[], decks: DeckInput[]): PoolItem[] {
  const pool = new Map<string, PoolItem>()

  const addItem = (partial: FusionKeyInput, quantity: number, source: string) => {
    const key = fusionKey(partial)
    const existing = pool.get(key)
    if (existing) {
      existing.quantity += quantity
      if (!existing.sources.includes(source)) {
        existing.sources.push(source)
      }
      return
    }
    pool.set(key, {
      scryfallId: partial.scryfallId,
      setCode: partial.setCode,
      collectorNumber: partial.collectorNumber,
      name: partial.name,
      quantity,
      sources: [source],
    })
  }

  for (const row of collection) {
    addItem(
      {
        scryfallId: row.scryfallId || undefined,
        setCode: row.setCode || undefined,
        collectorNumber: row.collectorNumber || undefined,
        name: row.name,
      },
      row.quantity,
      'collection',
    )
  }

  for (const deck of decks) {
    if (!deck.include) continue
    for (const entry of deck.entries) {
      addItem(
        {
          setCode: entry.setCode,
          collectorNumber: entry.collectorNumber,
          name: entry.name,
        },
        entry.quantity,
        deck.name,
      )
    }
  }

  return Array.from(pool.values())
}

function resolvePoolItem(item: PoolItem, lookup: CardLookup): ResolvedCard | undefined {
  if (item.scryfallId) {
    const card = lookup.byScryfallId(item.scryfallId)
    if (card) return card
  }
  if (item.setCode && item.collectorNumber) {
    const card = lookup.bySetNum(item.setCode, item.collectorNumber)
    if (card) return card
  }
  if (item.name) {
    const card = lookup.byName(item.name)
    if (card) return card
  }
  return undefined
}

export interface OracleIndexResult {
  index: Map<string, { quantity: number; printings: ResolvedCard[] }>
  unresolved: PoolItem[]
}

/**
 * Agrège le pool par oracleId (toutes impressions confondues).
 * Les items non résolus sont ignorés silencieusement dans l'index mais
 * comptés dans `unresolved`.
 */
export function buildOracleIndex(pool: PoolItem[], lookup: CardLookup): OracleIndexResult {
  const index = new Map<string, { quantity: number; printings: ResolvedCard[] }>()
  const unresolved: PoolItem[] = []

  for (const item of pool) {
    const card = resolvePoolItem(item, lookup)
    if (!card) {
      unresolved.push(item)
      continue
    }

    const existing = index.get(card.oracleId)
    if (existing) {
      existing.quantity += item.quantity
      if (!existing.printings.some((p) => p.scryfallId === card.scryfallId)) {
        existing.printings.push(card)
      }
    } else {
      index.set(card.oracleId, { quantity: item.quantity, printings: [card] })
    }
  }

  return { index, unresolved }
}
