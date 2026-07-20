/**
 * Calcul du taux de complétion d'une decklist par rapport à un pool
 * (collection + decks inclus), avec deux modes de matching :
 *  - impression exacte (même set + collectorNumber, toutes langues confondues,
 *    ou scryfallId identique)
 *  - toute édition (via l'oracleId, si `allowOtherEditions` est activé)
 * Les terrains de base sont considérés comme toujours possédés (on suppose
 * un pool de terrains de base suffisant) : ils comptent leur quantité
 * demandée à la fois dans le total et dans le nombre possédé, et n'apparaissent
 * jamais dans `missing` ni dans `unresolvedEntries`.
 */
import { buildOracleIndex } from './inventory'
import { isBasicLand, isBasicLandName } from './lands'
import type { CardLookup, DecklistEntry, PoolItem, ResolvedCard } from './types'

export interface MissingCard {
  name: string
  needed: number
  owned: number
  entry: DecklistEntry
}

export interface CompletionResult {
  total: number
  ownedCount: number
  percent: number
  missing: MissingCard[]
  unresolvedEntries: DecklistEntry[]
}

interface ScoringOptions {
  allowOtherEditions: boolean
}

interface WorkingEntry {
  entry: DecklistEntry
  card?: ResolvedCard
}

interface Bucket {
  remaining: number
}

interface ExactPrintingBuckets {
  bySetNum: Map<string, Bucket[]>
  byId: Map<string, Bucket>
}

function snKey(set: string, num: string): string {
  return `${set.trim().toLowerCase()}|${num.trim().toLowerCase()}`
}

function resolveEntry(entry: DecklistEntry, lookup: CardLookup): ResolvedCard | undefined {
  if (entry.setCode && entry.collectorNumber) {
    const card = lookup.bySetNum(entry.setCode, entry.collectorNumber)
    if (card) return card
  }
  return lookup.byName(entry.name)
}

function buildExactPrintingBuckets(pool: PoolItem[]): ExactPrintingBuckets {
  const bySetNum = new Map<string, Bucket[]>()
  const byId = new Map<string, Bucket>()

  for (const item of pool) {
    const bucket: Bucket = { remaining: item.quantity }

    if (item.setCode && item.collectorNumber) {
      const key = snKey(item.setCode, item.collectorNumber)
      const list = bySetNum.get(key)
      if (list) list.push(bucket)
      else bySetNum.set(key, [bucket])
    }

    if (item.scryfallId) {
      byId.set(item.scryfallId, bucket)
    }
  }

  return { bySetNum, byId }
}

/** Consomme au maximum `demand` unités dans les buckets correspondant à la carte demandée. */
function consumeExactPrinting(demand: number, card: ResolvedCard, buckets: ExactPrintingBuckets): number {
  const candidates = new Set<Bucket>()

  const setKey = card.setCode && card.collectorNumber ? snKey(card.setCode, card.collectorNumber) : undefined
  if (setKey) {
    const list = buckets.bySetNum.get(setKey)
    if (list) list.forEach((bucket) => candidates.add(bucket))
  }
  if (card.scryfallId) {
    const bucket = buckets.byId.get(card.scryfallId)
    if (bucket) candidates.add(bucket)
  }

  let remainingDemand = demand
  for (const bucket of candidates) {
    if (remainingDemand <= 0) break
    const take = Math.min(bucket.remaining, remainingDemand)
    bucket.remaining -= take
    remainingDemand -= take
  }

  return demand - remainingDemand
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/**
 * Calcule le taux de complétion d'une decklist par rapport à un pool.
 * Résolution d'une entry : set+num → bySetNum, sinon byName.
 * Terrains de base toujours possédés (sur la carte résolue, ou repli sur le
 * nom brut si l'entry n'a pas pu être résolue) : leur quantité demandée
 * compte dans le total ET dans le nombre possédé, sans jamais apparaître en
 * carte manquante ni en entrée non résolue.
 */
export function scoreDecklist(
  entries: DecklistEntry[],
  pool: PoolItem[],
  lookup: CardLookup,
  opts: ScoringOptions,
): CompletionResult {
  const relevant: WorkingEntry[] = []
  const unresolvedEntries: DecklistEntry[] = []
  let landTotal = 0

  for (const entry of entries) {
    const card = resolveEntry(entry, lookup)
    const isLand = card ? isBasicLand(card) : isBasicLandName(entry.name)
    if (isLand) {
      landTotal += entry.quantity
      continue
    }

    if (!card) {
      unresolvedEntries.push(entry)
    }
    relevant.push({ entry, card })
  }

  const total = landTotal + relevant.reduce((sum, item) => sum + item.entry.quantity, 0)

  let ownedCount = landTotal
  const missing: MissingCard[] = []

  if (opts.allowOtherEditions) {
    const { index: oracleIndex } = buildOracleIndex(pool, lookup)
    const remaining = new Map<string, number>()
    for (const [oracleId, data] of oracleIndex) {
      remaining.set(oracleId, data.quantity)
    }

    for (const item of relevant) {
      const needed = item.entry.quantity
      if (!item.card) {
        missing.push({ name: item.entry.name, needed, owned: 0, entry: item.entry })
        continue
      }
      const available = remaining.get(item.card.oracleId) ?? 0
      const owned = Math.min(available, needed)
      remaining.set(item.card.oracleId, available - owned)
      ownedCount += owned
      if (owned < needed) {
        missing.push({ name: item.card.name, needed, owned, entry: item.entry })
      }
    }
  } else {
    const buckets = buildExactPrintingBuckets(pool)

    for (const item of relevant) {
      const needed = item.entry.quantity
      if (!item.card) {
        missing.push({ name: item.entry.name, needed, owned: 0, entry: item.entry })
        continue
      }
      const owned = consumeExactPrinting(needed, item.card, buckets)
      ownedCount += owned
      if (owned < needed) {
        missing.push({ name: item.card.name, needed, owned, entry: item.entry })
      }
    }
  }

  missing.sort((a, b) => {
    const missingA = a.needed - a.owned
    const missingB = b.needed - b.owned
    if (missingB !== missingA) return missingB - missingA
    return a.name.localeCompare(b.name)
  })

  const percent = total === 0 ? 100 : round1((ownedCount / total) * 100)

  return { total, ownedCount, percent, missing, unresolvedEntries }
}
