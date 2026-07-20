import { describe, expect, it } from 'vitest'
import { scoreDecklist } from '../lib/engine/scoring'
import { createCardLookup } from '../lib/engine/types'
import type { DecklistEntry, PoolItem, ResolvedCard } from '../lib/engine/types'

function makeCard(overrides: Partial<ResolvedCard>): ResolvedCard {
  return {
    scryfallId: 'scry-id',
    oracleId: 'oracle-id',
    name: 'Card',
    typeLine: 'Creature',
    oracleText: '',
    manaCost: '',
    cmc: 0,
    colorIdentity: [],
    setCode: 'SET',
    collectorNumber: '1',
    isBasicLand: false,
    isCommanderLegal: false,
    lang: 'en',
    ...overrides,
  }
}

// 5 cartes synthétiques : Sol Ring (2 impressions, même oracleId), Lightning
// Bolt, Forest (terrain de base, à exclure), Fire // Ice (recto-verso) et
// Atraxa (créature légendaire, jamais possédée).
const cards: ResolvedCard[] = [
  makeCard({ scryfallId: 'sr-cmd', oracleId: 'sol-ring-oracle', name: 'Sol Ring', typeLine: 'Artifact', setCode: 'CMD', collectorNumber: '1' }),
  makeCard({ scryfallId: 'sr-c21', oracleId: 'sol-ring-oracle', name: 'Sol Ring', typeLine: 'Artifact', setCode: 'C21', collectorNumber: '263' }),
  makeCard({ scryfallId: 'lb-m11', oracleId: 'bolt-oracle', name: 'Lightning Bolt', typeLine: 'Instant', setCode: 'M11', collectorNumber: '146' }),
  makeCard({ scryfallId: 'forest-cmd', oracleId: 'forest-oracle', name: 'Forest', typeLine: 'Basic Land — Forest', setCode: 'CMD', collectorNumber: '301', isBasicLand: true }),
  makeCard({ scryfallId: 'fireice-apc', oracleId: 'fireice-oracle', name: 'Fire // Ice', typeLine: 'Instant // Instant', setCode: 'APC', collectorNumber: '123' }),
  makeCard({
    scryfallId: 'atraxa-m19',
    oracleId: 'atraxa-oracle',
    name: "Atraxa, Praetors' Voice",
    typeLine: 'Legendary Creature — Phyrexian Angel',
    oracleText: 'Flying, vigilance, deathtouch, lifelink',
    setCode: 'M19',
    collectorNumber: '1',
    isCommanderLegal: true,
  }),
]

const lookup = createCardLookup(cards)

// Pool possédé : Sol Ring en 2 impressions (2 en CMD/1, 1 en C21/263),
// Lightning Bolt (1), Forest (20, non pertinent car exclu du calcul),
// Atraxa (1). Fire // Ice n'est pas possédée.
const pool: PoolItem[] = [
  { setCode: 'CMD', collectorNumber: '1', name: 'Sol Ring', quantity: 2, sources: ['collection'] },
  { setCode: 'C21', collectorNumber: '263', name: 'Sol Ring', quantity: 1, sources: ['collection'] },
  { setCode: 'M11', collectorNumber: '146', name: 'Lightning Bolt', quantity: 1, sources: ['collection'] },
  { setCode: 'CMD', collectorNumber: '301', name: 'Forest', quantity: 20, sources: ['collection'] },
  { setCode: 'M19', collectorNumber: '1', name: "Atraxa, Praetors' Voice", quantity: 1, sources: ['collection'] },
]

const entries: DecklistEntry[] = [
  { quantity: 3, name: 'Sol Ring', setCode: 'CMD', collectorNumber: '1', foil: false },
  { quantity: 1, name: 'Lightning Bolt', setCode: 'M11', collectorNumber: '146', foil: false },
  { quantity: 5, name: 'Forest', foil: false },
  { quantity: 1, name: 'Fire // Ice', setCode: 'APC', collectorNumber: '123', foil: false },
  { quantity: 1, name: "Atraxa, Praetors' Voice", setCode: 'M19', collectorNumber: '1', foil: false },
  { quantity: 1, name: 'Totally Unknown Card', foil: false },
]

describe('scoreDecklist — impression exacte (allowOtherEditions: false)', () => {
  const result = scoreDecklist(entries, pool, lookup, { allowOtherEditions: false })

  it('exclut le terrain de base du total (7 non-terrain sur 6 entrées, Forest exclu)', () => {
    expect(result.totalNonLand).toBe(7)
  })

  it('ne compte que 2 Sol Ring possédés sur la bonne impression (CMD/1), pas les 3 (C21 ignoré)', () => {
    expect(result.ownedCount).toBe(4)
  })

  it('calcule le pourcentage exact (4/7 = 57.1%)', () => {
    expect(result.percent).toBe(57.1)
  })

  it('remonte Sol Ring en missing (2 possédés / 3 demandés → manque 1)', () => {
    const solRing = result.missing.find((m) => m.name === 'Sol Ring')
    expect(solRing).toEqual({ name: 'Sol Ring', needed: 3, owned: 2, entry: entries[0] })
  })

  it('trie missing par manquant décroissant puis par nom', () => {
    const names = result.missing.map((m) => m.name)
    expect(names).toEqual(['Fire // Ice', 'Sol Ring', 'Totally Unknown Card'])
  })

  it('journalise la carte introuvable dans unresolvedEntries', () => {
    expect(result.unresolvedEntries).toHaveLength(1)
    expect(result.unresolvedEntries[0].name).toBe('Totally Unknown Card')
  })
})

describe('scoreDecklist — toute édition (allowOtherEditions: true)', () => {
  const result = scoreDecklist(entries, pool, lookup, { allowOtherEditions: true })

  it('agrège les 2 impressions de Sol Ring (2 + 1 = 3), donc Sol Ring est complet', () => {
    expect(result.missing.some((m) => m.name === 'Sol Ring')).toBe(false)
  })

  it('possède 5 cartes sur 7 (Sol Ring complet, Bolt, Atraxa ; Fire//Ice et carte inconnue manquants)', () => {
    expect(result.ownedCount).toBe(5)
  })

  it('calcule le pourcentage exact (5/7 = 71.4%)', () => {
    expect(result.percent).toBe(71.4)
  })

  it('ne laisse que 2 cartes manquantes', () => {
    const names = result.missing.map((m) => m.name)
    expect(names).toEqual(['Fire // Ice', 'Totally Unknown Card'])
  })
})

describe('scoreDecklist — cas limite : deck vide', () => {
  it('renvoie 100% quand il n\'y a rien à évaluer', () => {
    const result = scoreDecklist([], [], lookup, { allowOtherEditions: false })
    expect(result.totalNonLand).toBe(0)
    expect(result.percent).toBe(100)
    expect(result.missing).toEqual([])
  })
})
