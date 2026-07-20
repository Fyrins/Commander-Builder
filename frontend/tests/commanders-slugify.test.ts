import { describe, expect, it } from 'vitest'
import { detectCommanders } from '../lib/engine/commanders'
import { edhrecSlug } from '../lib/engine/slugify'
import type { ResolvedCard } from '../lib/engine/types'

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

describe('detectCommanders', () => {
  it('détecte une créature légendaire', () => {
    const atraxa = makeCard({
      oracleId: 'atraxa-oracle',
      name: "Atraxa, Praetors' Voice",
      typeLine: 'Legendary Creature — Phyrexian Angel',
    })
    expect(detectCommanders([atraxa])).toEqual([atraxa])
  })

  it('détecte une carte via "can be your commander" même sans être une créature légendaire', () => {
    const backupPlan = makeCard({
      oracleId: 'backup-oracle',
      name: 'Backup Plan',
      typeLine: 'Legendary Planeswalker — Test',
      oracleText: 'This permanent can be your commander.',
    })
    expect(detectCommanders([backupPlan])).toEqual([backupPlan])
  })

  it('est insensible à la casse sur typeLine et oracleText', () => {
    const card = makeCard({
      oracleId: 'case-oracle',
      typeLine: 'legendary creature — test',
      oracleText: 'This card CAN BE YOUR COMMANDER.',
    })
    expect(detectCommanders([card])).toEqual([card])
  })

  it('exclut les cartes non-commandants', () => {
    const bolt = makeCard({
      oracleId: 'bolt-oracle',
      name: 'Lightning Bolt',
      typeLine: 'Instant',
      oracleText: 'Lightning Bolt deals 3 damage to any target.',
    })
    expect(detectCommanders([bolt])).toEqual([])
  })

  it('déduplique par oracleId (deux impressions de la même carte)', () => {
    const printing1 = makeCard({
      scryfallId: 'krrik-1',
      oracleId: 'krrik-oracle',
      name: "K'rrik, Son of Yawgmoth",
      typeLine: 'Legendary Creature — Human Cleric',
    })
    const printing2 = makeCard({
      scryfallId: 'krrik-2',
      oracleId: 'krrik-oracle',
      name: "K'rrik, Son of Yawgmoth",
      typeLine: 'Legendary Creature — Human Cleric',
    })
    const result = detectCommanders([printing1, printing2])
    expect(result).toHaveLength(1)
    expect(result[0].scryfallId).toBe('krrik-1')
  })

  it('mixe correctement plusieurs cartes (légendaires, can-be-commander, dédupliquées, exclues)', () => {
    const atraxa = makeCard({ oracleId: 'atraxa-oracle', name: "Atraxa, Praetors' Voice", typeLine: 'Legendary Creature — Phyrexian Angel' })
    const atraxaReprint = makeCard({ scryfallId: 'atraxa-2', oracleId: 'atraxa-oracle', name: "Atraxa, Praetors' Voice", typeLine: 'Legendary Creature — Phyrexian Angel' })
    const krrik = makeCard({ oracleId: 'krrik-oracle', name: "K'rrik, Son of Yawgmoth", typeLine: 'Legendary Creature — Human Cleric' })
    const backupPlan = makeCard({
      oracleId: 'backup-oracle',
      name: 'Backup Plan',
      typeLine: 'Legendary Planeswalker — Test',
      oracleText: 'This permanent can be your commander.',
    })
    const bolt = makeCard({ oracleId: 'bolt-oracle', name: 'Lightning Bolt', typeLine: 'Instant' })

    const result = detectCommanders([atraxa, atraxaReprint, krrik, backupPlan, bolt])
    expect(result.map((c) => c.oracleId)).toEqual(['atraxa-oracle', 'krrik-oracle', 'backup-oracle'])
  })
})

describe('edhrecSlug', () => {
  it("Atraxa, Praetors' Voice → atraxa-praetors-voice", () => {
    expect(edhrecSlug("Atraxa, Praetors' Voice")).toBe('atraxa-praetors-voice')
  })

  it("K'rrik, Son of Yawgmoth → krrik-son-of-yawgmoth", () => {
    expect(edhrecSlug("K'rrik, Son of Yawgmoth")).toBe('krrik-son-of-yawgmoth')
  })

  it('Jötun Grunt → jotun-grunt (accents strippés)', () => {
    expect(edhrecSlug('Jötun Grunt')).toBe('jotun-grunt')
  })

  it('Fire // Ice → fire (ne garde que la face avant)', () => {
    expect(edhrecSlug('Fire // Ice')).toBe('fire')
  })

  it('réduit les tirets multiples et les espaces superflus', () => {
    expect(edhrecSlug('  Some   Weird Name  ')).toBe('some-weird-name')
  })

  it('gère les points', () => {
    expect(edhrecSlug('Dr. Julius Jumblemorph')).toBe('dr-julius-jumblemorph')
  })
})
