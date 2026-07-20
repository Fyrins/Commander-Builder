/**
 * Types partagés du moteur de matching collection <-> decklists.
 * Modules purs, zéro dépendance externe, zéro dépendance Nuxt.
 */

/** Une ligne de la collection ManaBox (export CSV). */
export interface CollectionRow {
  name: string
  setCode: string
  setName: string
  collectorNumber: string
  foil: boolean
  rarity: string
  quantity: number
  scryfallId: string
  language: string
  condition: string
}

/** Une entrée de decklist parsée (nom EN, éventuellement set + numéro). */
export interface DecklistEntry {
  quantity: number
  name: string
  setCode?: string
  collectorNumber?: string
  foil: boolean
}

/** Une carte résolue via Scryfall (ou toute source équivalente). */
export interface ResolvedCard {
  scryfallId: string
  oracleId: string
  name: string
  printedName?: string | null
  typeLine: string
  oracleText: string
  manaCost: string
  cmc: number
  colorIdentity: string[]
  setCode: string
  collectorNumber: string
  imageSmall?: string
  imageNormal?: string
  isBasicLand: boolean
  isCommanderLegal: boolean
  lang: string
}

/** Index de résolution de cartes, par identifiant Scryfall, impression ou nom EN. */
export interface CardLookup {
  byScryfallId(id: string): ResolvedCard | undefined
  bySetNum(set: string, num: string): ResolvedCard | undefined
  byName(name: string): ResolvedCard | undefined
  byOracleId(id: string): ResolvedCard | undefined
}

/** Un item du pool fusionné (collection + decks inclus). */
export interface PoolItem {
  scryfallId?: string
  setCode?: string
  collectorNumber?: string
  name?: string
  quantity: number
  sources: string[]
}

function normalizeSetNumKey(set: string, num: string): string {
  return `${set.trim().toLowerCase()}|${num.trim().toLowerCase()}`
}

function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase()
}

/** Construit un CardLookup en mémoire à partir d'une liste de cartes résolues. */
export function createCardLookup(cards: ResolvedCard[]): CardLookup {
  const byId = new Map<string, ResolvedCard>()
  const bySetNumMap = new Map<string, ResolvedCard>()
  const byNameMap = new Map<string, ResolvedCard>()
  const byOracleMap = new Map<string, ResolvedCard>()

  for (const card of cards) {
    if (card.scryfallId && !byId.has(card.scryfallId)) {
      byId.set(card.scryfallId, card)
    }
    if (card.setCode && card.collectorNumber) {
      const key = normalizeSetNumKey(card.setCode, card.collectorNumber)
      if (!bySetNumMap.has(key)) {
        bySetNumMap.set(key, card)
      }
    }
    if (card.name) {
      const key = normalizeNameKey(card.name)
      if (!byNameMap.has(key)) {
        byNameMap.set(key, card)
      }
    }
    if (card.oracleId && !byOracleMap.has(card.oracleId)) {
      byOracleMap.set(card.oracleId, card)
    }
  }

  return {
    byScryfallId: (id: string) => byId.get(id),
    bySetNum: (set: string, num: string) => bySetNumMap.get(normalizeSetNumKey(set, num)),
    byName: (name: string) => byNameMap.get(normalizeNameKey(name)),
    byOracleId: (id: string) => byOracleMap.get(id),
  }
}
