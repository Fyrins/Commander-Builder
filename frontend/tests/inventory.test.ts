import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildOracleIndex, buildPool } from '../lib/engine/inventory'
import { parseManaBoxCsv } from '../lib/engine/parse-csv'
import { parseDecklist } from '../lib/engine/parse-decklist'
import { createCardLookup } from '../lib/engine/types'
import type { CollectionRow, DecklistEntry, ResolvedCard } from '../lib/engine/types'

const FIXTURES_DIR = path.resolve(process.cwd(), '../data/fixtures')

function makeCollectionRow(overrides: Partial<CollectionRow>): CollectionRow {
  return {
    name: 'Card',
    setCode: 'SET',
    setName: 'Set Name',
    collectorNumber: '1',
    foil: false,
    rarity: 'common',
    quantity: 1,
    scryfallId: 'scry-id',
    language: 'en',
    condition: 'near_mint',
    ...overrides,
  }
}

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

describe('buildPool (fusion synthétique)', () => {
  // Le scryfallId de Sol Ring en collection est délibérément vide pour
  // vérifier le repli sur la clé set|num lors de la fusion avec le deck.
  const collection: CollectionRow[] = [
    makeCollectionRow({ name: 'Sol Ring', setCode: 'CMD', collectorNumber: '1', scryfallId: '', quantity: 2 }),
    makeCollectionRow({ name: 'Lightning Bolt', setCode: 'M11', collectorNumber: '146', scryfallId: 'lb-id', quantity: 1 }),
  ]

  const decks = [
    {
      name: 'DeckA',
      include: true,
      entries: [
        { quantity: 1, name: 'Sol Ring', setCode: 'CMD', collectorNumber: '1', foil: false },
        { quantity: 4, name: 'Forest', foil: false },
      ] satisfies DecklistEntry[],
    },
    {
      name: 'DeckB',
      include: false,
      entries: [{ quantity: 1, name: 'Mox Diamond', foil: false }] satisfies DecklistEntry[],
    },
  ]

  const pool = buildPool(collection, decks)

  it('fusionne Sol Ring (collection + DeckA) par clé set|num', () => {
    const solRing = pool.find((item) => item.name === 'Sol Ring')
    expect(solRing).toBeDefined()
    expect(solRing?.quantity).toBe(3)
    expect(solRing?.sources.sort()).toEqual(['DeckA', 'collection'])
  })

  it('garde Lightning Bolt seul (collection uniquement)', () => {
    const bolt = pool.find((item) => item.name === 'Lightning Bolt')
    expect(bolt?.quantity).toBe(1)
    expect(bolt?.sources).toEqual(['collection'])
  })

  it('ajoute Forest comme item deck-only', () => {
    const forest = pool.find((item) => item.name === 'Forest')
    expect(forest?.quantity).toBe(4)
    expect(forest?.sources).toEqual(['DeckA'])
  })

  it('exclut le deck non inclus (Mox Diamond absent)', () => {
    expect(pool.some((item) => item.name === 'Mox Diamond')).toBe(false)
  })

  it("le pool contient exactement 3 items", () => {
    expect(pool).toHaveLength(3)
  })
})

describe('buildOracleIndex (synthétique)', () => {
  const collection: CollectionRow[] = [
    makeCollectionRow({ name: 'Sol Ring', setCode: 'CMD', collectorNumber: '1', scryfallId: '', quantity: 2 }),
    makeCollectionRow({ name: 'Lightning Bolt', setCode: 'M11', collectorNumber: '146', scryfallId: 'lb-id', quantity: 1 }),
  ]
  const decks = [
    {
      name: 'DeckA',
      include: true,
      entries: [
        { quantity: 1, name: 'Sol Ring', setCode: 'CMD', collectorNumber: '1', foil: false },
        { quantity: 4, name: 'Forest', foil: false },
        { quantity: 2, name: 'Unknown Card XYZ', foil: false },
      ] satisfies DecklistEntry[],
    },
  ]

  const pool = buildPool(collection, decks)
  const lookup = createCardLookup([
    makeCard({ scryfallId: 'sr-cmd', oracleId: 'sol-ring-oracle', name: 'Sol Ring', setCode: 'CMD', collectorNumber: '1' }),
    makeCard({ scryfallId: 'lb-id', oracleId: 'bolt-oracle', name: 'Lightning Bolt', setCode: 'M11', collectorNumber: '146' }),
    makeCard({ scryfallId: 'forest-id', oracleId: 'forest-oracle', name: 'Forest', setCode: 'CMD', collectorNumber: '301', isBasicLand: true }),
  ])

  const { index, unresolved } = buildOracleIndex(pool, lookup)

  it('agrège Sol Ring (fusionné) sous son oracleId', () => {
    expect(index.get('sol-ring-oracle')?.quantity).toBe(3)
  })

  it('agrège Lightning Bolt et Forest', () => {
    expect(index.get('bolt-oracle')?.quantity).toBe(1)
    expect(index.get('forest-oracle')?.quantity).toBe(4)
  })

  it('reporte les items non résolus sans planter', () => {
    expect(unresolved).toHaveLength(1)
    expect(unresolved[0].name).toBe('Unknown Card XYZ')
  })
})

describe('buildPool (données réelles : collection + 8 decks)', () => {
  const collectionText = readFileSync(path.join(FIXTURES_DIR, 'collection.csv'), 'utf-8')
  const { rows: collection, errors: csvErrors } = parseManaBoxCsv(collectionText)

  const decksDir = path.join(FIXTURES_DIR, 'decks')
  const deckFiles = readdirSync(decksDir).filter((f) => f.endsWith('.txt'))
  const decks = deckFiles.map((file) => {
    const text = readFileSync(path.join(decksDir, file), 'utf-8')
    const { entries } = parseDecklist(text)
    return { name: file, include: true, entries }
  })

  it('le CSV réel est propre (précondition)', () => {
    expect(csvErrors).toEqual([])
    expect(collection).toHaveLength(705)
  })

  it('8 decklists sont chargées', () => {
    expect(decks).toHaveLength(8)
  })

  it('la somme des quantités du pool fusionné vaut 1392 (916 collection + 476 decks, sans chevauchement de clé)', () => {
    const pool = buildPool(collection, decks)
    const total = pool.reduce((sum, item) => sum + item.quantity, 0)
    expect(total).toBe(1392)
  })

  it('le pool fusionné contient 901 items distincts (703 uniques en collection + 198 uniques en decks)', () => {
    const pool = buildPool(collection, decks)
    expect(pool).toHaveLength(901)
  })
})
