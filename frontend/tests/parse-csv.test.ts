import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseCsv, parseManaBoxCsv } from '../lib/engine/parse-csv'

const COLLECTION_PATH = path.resolve(process.cwd(), '../data/fixtures/collection.csv')

describe('parseCsv (RFC-4180)', () => {
  it('gère les champs quotés simples et les champs quotés avec virgules', () => {
    const text = 'a,b,c\n"x,y",2,"quoted"\n'
    const rows = parseCsv(text)
    expect(rows).toEqual([
      ['a', 'b', 'c'],
      ['x,y', '2', 'quoted'],
    ])
  })

  it('gère les quotes échappées ("")', () => {
    const text = 'name,note\n"Bob ""The Builder""",ok\n'
    const rows = parseCsv(text)
    expect(rows[1]).toEqual(['Bob "The Builder"', 'ok'])
  })

  it('gère les sauts de ligne dans un champ quoté', () => {
    const text = 'a,b\n"line1\nline2",2\n'
    const rows = parseCsv(text)
    expect(rows[1]).toEqual(['line1\nline2', '2'])
  })

  it('gère CRLF et LF indifféremment', () => {
    const text = 'a,b\r\n1,2\n3,4\r\n'
    const rows = parseCsv(text)
    expect(rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ])
  })

  it('gère un fichier sans saut de ligne final', () => {
    const text = 'a,b\n1,2'
    const rows = parseCsv(text)
    expect(rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })
})

describe('parseManaBoxCsv (fixture réelle)', () => {
  const text = readFileSync(COLLECTION_PATH, 'utf-8')
  const { rows, errors } = parseManaBoxCsv(text)

  it('parse 705 lignes sans erreur', () => {
    expect(errors).toEqual([])
    expect(rows).toHaveLength(705)
  })

  it('retrouve un total de 916 cartes (somme des Quantity)', () => {
    const total = rows.reduce((sum, row) => sum + row.quantity, 0)
    expect(total).toBe(916)
  })

  it('parse correctement un nom contenant une virgule (champ quoté RFC-4180)', () => {
    const karona = rows.find((row) => row.name === 'Karona, False God')
    expect(karona).toBeDefined()
    expect(karona?.setCode).toBe('SCG')
    expect(karona?.quantity).toBe(1)

    // Autres noms quotés attendus dans la fixture, pour confirmer que les 12
    // lignes quotées sont toutes bien scindées sur le bon champ.
    const otherQuotedNames = [
      'Lyzolda, the Blood Witch',
      'Skarrg, the Rage Pits',
      'Sidisi, Undead Vizier',
      'Faramir, Field Commander',
      'Gimli, Mournful Avenger',
      'Shadowfax, Lord of Horses',
      'Gimli, Counter of Kills',
      'Legolas, Counter of Kills',
      'Legolas, Master Archer',
      'Meneldor, Swift Savior',
      'Quickbeam, Upstart Ent',
    ]
    for (const name of otherQuotedNames) {
      expect(rows.some((row) => row.name === name)).toBe(true)
    }
  })

  it("a un scryfallId non vide sur toutes les lignes", () => {
    expect(rows.every((row) => row.scryfallId.length > 0)).toBe(true)
  })

  it('normalise foil/etched → true, normal → false', () => {
    expect(rows.every((row) => typeof row.foil === 'boolean')).toBe(true)
    const foilRow = rows.find((row) => row.name === 'Shadowfax, Lord of Horses')
    expect(foilRow?.foil).toBe(true)
    const normalRow = rows.find((row) => row.name === 'Thunderbreak Regent')
    expect(normalRow?.foil).toBe(false)
  })
})
