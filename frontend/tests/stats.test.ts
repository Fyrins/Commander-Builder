import { describe, expect, it } from 'vitest'
import { colorPipCosts, colorProduction, drawProbability, manaCurve, typeBreakdown } from '../lib/engine/stats'
import { createCardLookup } from '../lib/engine/types'
import type { DecklistEntry, ResolvedCard } from '../lib/engine/types'

function makeCard(overrides: Partial<ResolvedCard>): ResolvedCard {
  return {
    scryfallId: `scry-${Math.random()}`,
    oracleId: `oracle-${Math.random()}`,
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

function entry(quantity: number, name: string): DecklistEntry {
  return { quantity, name, foil: false }
}

describe('manaCurve', () => {
  it('exclut les terrains, pondère par quantité et calcule la moyenne sur les non-terrains', () => {
    const cards: ResolvedCard[] = [
      makeCard({ name: 'Lightning Bolt', typeLine: 'Instant', cmc: 1 }),
      makeCard({ name: 'Sol Ring', typeLine: 'Artifact', cmc: 1 }),
      makeCard({ name: "Atraxa, Praetors' Voice", typeLine: 'Legendary Creature — Phyrexian Angel', cmc: 4 }),
      makeCard({ name: 'Blue Sun\'s Zenith', typeLine: 'Sorcery', cmc: 9 }),
      makeCard({ name: 'Forest', typeLine: 'Basic Land — Forest', cmc: 0, isBasicLand: true }),
    ]
    const lookup = createCardLookup(cards)

    const entries: DecklistEntry[] = [
      entry(4, 'Lightning Bolt'),
      entry(1, 'Sol Ring'),
      entry(1, "Atraxa, Praetors' Voice"),
      entry(1, "Blue Sun's Zenith"),
      entry(10, 'Forest'),
    ]

    const result = manaCurve(entries, lookup)

    const byLabel = Object.fromEntries(result.buckets.map((b) => [b.label, b.count]))
    expect(byLabel).toEqual({ '0': 0, '1': 5, '2': 0, '3': 0, '4': 1, '5': 0, '6': 0, '7': 0, '8+': 1 })
    // total non-terrain = 4 + 1 + 1 + 1 = 7 ; somme des cmc pondérées = 5*1 + 4 + 9 = 18
    expect(result.totalManaValue).toBe(18)
    expect(result.avgManaValue).toBeCloseTo(18 / 7, 2)
    expect(result.avgManaValue).toBe(2.57)
  })

  it('ignore les entrées non résolues (cmc inconnu)', () => {
    const lookup = createCardLookup([])
    const result = manaCurve([entry(3, 'Carte inconnue')], lookup)
    expect(result.buckets.every((b) => b.count === 0)).toBe(true)
    expect(result.avgManaValue).toBe(0)
    expect(result.totalManaValue).toBe(0)
  })
})

describe('colorPipCosts', () => {
  it('compte les pips WUBRG + colorless, les hybrides comptant pour chaque couleur', () => {
    const cards: ResolvedCard[] = [
      makeCard({ name: 'Card A', manaCost: '{1}{W}{W}' }),
      // Hybride couleur/couleur : compte pour les deux couleurs.
      makeCard({ name: 'Card B', manaCost: '{G/W}' }),
      // Générique/colorless.
      makeCard({ name: 'Card C', manaCost: '{2}{C}' }),
      // Phyrexian : ne compte que pour la couleur, pas pour "P".
      makeCard({ name: 'Card D', manaCost: '{B/P}' }),
      // Hybride générique/couleur : ne compte que pour la couleur.
      makeCard({ name: 'Card E', manaCost: '{2/U}' }),
    ]
    const lookup = createCardLookup(cards)

    const entries: DecklistEntry[] = [
      entry(2, 'Card A'),
      entry(3, 'Card B'),
      entry(1, 'Card C'),
      entry(1, 'Card D'),
      entry(1, 'Card E'),
    ]

    const result = colorPipCosts(entries, lookup)

    // pips : W = 2*2 (Card A) + 3 (Card B) = 7 ; G = 3 (Card B) ; colorless = 1 ; B = 1 ; U = 1 ; R = 0
    expect(result.W).toEqual({ pips: 7, cards: 5, percent: 53.8 })
    expect(result.G).toEqual({ pips: 3, cards: 3, percent: 23.1 })
    expect(result.colorless).toEqual({ pips: 1, cards: 1, percent: 7.7 })
    expect(result.B).toEqual({ pips: 1, cards: 1, percent: 7.7 })
    expect(result.U).toEqual({ pips: 1, cards: 1, percent: 7.7 })
    expect(result.R).toEqual({ pips: 0, cards: 0, percent: 0 })
  })

  it('renvoie 0 partout pour une decklist sans coût de mana', () => {
    const lookup = createCardLookup([])
    const result = colorPipCosts([], lookup)
    expect(result.W.percent).toBe(0)
    expect(result.colorless.pips).toBe(0)
  })
})

describe('colorProduction', () => {
  it('compte les sources de mana par couleur, pondérées par quantité', () => {
    const cards: ResolvedCard[] = [
      makeCard({ name: 'Command Tower', typeLine: 'Land', producedMana: ['W', 'U', 'B', 'R', 'G'] }),
      makeCard({ name: 'Sol Ring', typeLine: 'Artifact', producedMana: ['C'] }),
      makeCard({ name: 'Forest', typeLine: 'Basic Land — Forest', producedMana: ['G'], isBasicLand: true }),
    ]
    const lookup = createCardLookup(cards)

    const entries: DecklistEntry[] = [entry(1, 'Command Tower'), entry(2, 'Sol Ring'), entry(1, 'Forest')]

    const result = colorProduction(entries, lookup)

    // total sources = 1(W)+1(U)+1(B)+1(R)+2(G: 1 Command Tower + 1 Forest)+2(C: 2 Sol Ring) = 8
    expect(result.W).toEqual({ sources: 1, percent: 12.5 })
    expect(result.U).toEqual({ sources: 1, percent: 12.5 })
    expect(result.B).toEqual({ sources: 1, percent: 12.5 })
    expect(result.R).toEqual({ sources: 1, percent: 12.5 })
    expect(result.G).toEqual({ sources: 2, percent: 25 })
    expect(result.C).toEqual({ sources: 2, percent: 25 })
  })
})

describe('typeBreakdown', () => {
  it('classe par type principal (face avant pour les cartes recto-verso), terrain prioritaire', () => {
    const cards: ResolvedCard[] = [
      makeCard({ name: 'Lightning Bolt', typeLine: 'Instant' }),
      makeCard({ name: 'Rampant Growth', typeLine: 'Sorcery' }),
      makeCard({ name: 'Solemn Simulacrum', typeLine: 'Artifact Creature — Golem' }),
      makeCard({ name: 'Sol Ring', typeLine: 'Artifact' }),
      makeCard({ name: 'Rhystic Study', typeLine: 'Enchantment' }),
      makeCard({ name: "Elspeth, Sun's Nemesis", typeLine: "Legendary Planeswalker — Elspeth" }),
      makeCard({ name: 'Invasion of Amonkhet', typeLine: 'Battle — Siege' }),
      makeCard({ name: 'Forest', typeLine: 'Basic Land — Forest', isBasicLand: true }),
      // MDFC : face avant Sorcery, ne doit pas compter comme terrain malgré la face arrière Land.
      makeCard({ name: 'Bala Ged Recovery // Bala Ged Sanctuary', typeLine: 'Sorcery // Land' }),
    ]
    const lookup = createCardLookup(cards)

    const entries: DecklistEntry[] = [
      entry(3, 'Lightning Bolt'),
      entry(2, 'Rampant Growth'),
      entry(4, 'Solemn Simulacrum'),
      entry(1, 'Sol Ring'),
      entry(1, 'Rhystic Study'),
      entry(1, "Elspeth, Sun's Nemesis"),
      entry(1, 'Invasion of Amonkhet'),
      entry(10, 'Forest'),
      entry(1, 'Bala Ged Recovery // Bala Ged Sanctuary'),
      entry(1, 'Carte totalement inconnue'),
    ]

    const result = typeBreakdown(entries, lookup)

    expect(result).toEqual({
      creature: 4,
      instant: 3,
      sorcery: 3,
      artifact: 1,
      enchantment: 1,
      planeswalker: 1,
      battle: 1,
      land: 10,
      other: 1,
    })
  })
})

describe('drawProbability', () => {
  it('deck de 100, 25 succès, 7 pioches, au moins 1 succès (~0.876)', () => {
    const p = drawProbability(100, 25, 7, 1)
    expect(p).toBeCloseTo(0.8760067273959691, 9)
  })

  it('cas extrême : il faut piocher tous les succès du deck', () => {
    const p = drawProbability(10, 5, 5, 5)
    expect(p).toBeCloseTo(0.003968253968253968, 9)
  })

  it('minSuccesses impossible (> cardsDrawn) renvoie 0', () => {
    expect(drawProbability(100, 25, 7, 8)).toBe(0)
  })

  it('minSuccesses <= 0 renvoie toujours 1', () => {
    expect(drawProbability(100, 25, 7, 0)).toBe(1)
  })
})
