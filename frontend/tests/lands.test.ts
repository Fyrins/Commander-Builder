import { describe, expect, it } from 'vitest'
import { isBasicLand, isBasicLandName } from '../lib/engine/lands'
import type { ResolvedCard } from '../lib/engine/types'

function makeCard(overrides: Partial<ResolvedCard>): ResolvedCard {
  return {
    scryfallId: 'id',
    oracleId: 'oracle',
    name: 'Forest',
    typeLine: 'Basic Land — Forest',
    oracleText: '',
    manaCost: '',
    cmc: 0,
    colorIdentity: [],
    setCode: 'M21',
    collectorNumber: '272',
    isBasicLand: true,
    isCommanderLegal: false,
    lang: 'en',
    ...overrides,
  }
}

describe('isBasicLandName', () => {
  it('reconnaît les terrains de base EN, insensible à la casse', () => {
    expect(isBasicLandName('Plains')).toBe(true)
    expect(isBasicLandName('ISLAND')).toBe(true)
    expect(isBasicLandName('swamp')).toBe(true)
    expect(isBasicLandName('Mountain')).toBe(true)
    expect(isBasicLandName('forest')).toBe(true)
    expect(isBasicLandName('Wastes')).toBe(true)
  })

  it('reconnaît les terrains de base FR, avec ou sans accents', () => {
    expect(isBasicLandName('Plaine')).toBe(true)
    expect(isBasicLandName('Île')).toBe(true)
    expect(isBasicLandName('Ile')).toBe(true)
    expect(isBasicLandName('Marais')).toBe(true)
    expect(isBasicLandName('Montagne')).toBe(true)
    expect(isBasicLandName('Forêt')).toBe(true)
    expect(isBasicLandName('Foret')).toBe(true)
    expect(isBasicLandName('FORÊT')).toBe(true)
  })

  it('reconnaît les variantes enneigées EN (Snow-Covered <X>)', () => {
    expect(isBasicLandName('Snow-Covered Forest')).toBe(true)
    expect(isBasicLandName('snow-covered island')).toBe(true)
  })

  it('reconnaît les variantes enneigées FR (<X> enneigé(e))', () => {
    expect(isBasicLandName('Plaine enneigée')).toBe(true)
    expect(isBasicLandName('Île enneigée')).toBe(true)
    expect(isBasicLandName('Ile enneigee')).toBe(true)
    expect(isBasicLandName('Marais enneigé')).toBe(true)
    expect(isBasicLandName('Montagne enneigée')).toBe(true)
    expect(isBasicLandName('Forêt enneigée')).toBe(true)
  })

  it('rejette les cartes non-terrain', () => {
    expect(isBasicLandName('Lightning Bolt')).toBe(false)
    expect(isBasicLandName('Sol Ring')).toBe(false)
    expect(isBasicLandName('Command Tower')).toBe(false)
  })

  it('gère les valeurs vides sans lever', () => {
    expect(isBasicLandName('')).toBe(false)
    expect(isBasicLandName(undefined)).toBe(false)
    expect(isBasicLandName(null)).toBe(false)
  })
})

describe('isBasicLand (ResolvedCard)', () => {
  it('fait confiance au flag isBasicLand quand il est vrai', () => {
    const card = makeCard({ name: 'Some Weird Land Name', isBasicLand: true })
    expect(isBasicLand(card)).toBe(true)
  })

  it('retombe sur le nom quand le flag est faux', () => {
    const card = makeCard({ name: 'Forest', isBasicLand: false })
    expect(isBasicLand(card)).toBe(true)
  })

  it('retourne faux pour une carte non-terrain avec flag faux', () => {
    const card = makeCard({ name: 'Sol Ring', isBasicLand: false })
    expect(isBasicLand(card)).toBe(false)
  })
})
