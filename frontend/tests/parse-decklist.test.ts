import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseDecklist } from '../lib/engine/parse-decklist'

const DECKS_DIR = path.resolve(process.cwd(), '../data/fixtures/decks')

describe('parseDecklist (fixture réelle : Ancient Arsenal.txt)', () => {
  const text = readFileSync(path.join(DECKS_DIR, 'Ancient Arsenal.txt'), 'utf-8')
  const { entries, errors } = parseDecklist(text)

  it('parse 20 entrées sans erreur', () => {
    expect(errors).toEqual([])
    expect(entries).toHaveLength(20)
  })

  it('détecte Eivor, Battle-Ready en foil, set ACR, numéro 274', () => {
    const eivor = entries.find((e) => e.name === 'Eivor, Battle-Ready')
    expect(eivor).toBeDefined()
    expect(eivor?.foil).toBe(true)
    expect(eivor?.setCode).toBe('ACR')
    expect(eivor?.collectorNumber).toBe('274')
    expect(eivor?.quantity).toBe(1)
  })

  it('la somme des quantités vaut 60', () => {
    const total = entries.reduce((sum, e) => sum + e.quantity, 0)
    expect(total).toBe(60)
  })

  it('les autres entrées sans *F* sont non-foil', () => {
    const mountain = entries.find((e) => e.name === 'Mountain')
    expect(mountain?.foil).toBe(false)
  })
})

describe('parseDecklist (les 8 decklists réelles)', () => {
  const expected: Record<string, { entries: number; quantity: number }> = {
    'Ancient Arsenal.txt': { entries: 20, quantity: 60 },
    'Araignées.txt': { entries: 30, quantity: 56 },
    'Backup Beatdown.txt': { entries: 26, quantity: 60 },
    'Bête.txt': { entries: 37, quantity: 60 },
    'Brotherhood Agents.txt': { entries: 22, quantity: 60 },
    'Day of the Dragon.txt': { entries: 23, quantity: 60 },
    'Hare Raising.txt': { entries: 22, quantity: 60 },
    'Otter Limits.txt': { entries: 21, quantity: 60 },
  }

  for (const [file, spec] of Object.entries(expected)) {
    it(`${file} : ${spec.entries} entrées, ${spec.quantity} cartes, 0 erreur`, () => {
      const text = readFileSync(path.join(DECKS_DIR, file), 'utf-8')
      const { entries, errors } = parseDecklist(text)
      expect(errors).toEqual([])
      expect(entries).toHaveLength(spec.entries)
      expect(entries.reduce((sum, e) => sum + e.quantity, 0)).toBe(spec.quantity)
    })
  }
})

describe('parseDecklist (cas synthétiques)', () => {
  it('format court "N Nom" sans set', () => {
    const { entries, errors } = parseDecklist('3 Sol Ring')
    expect(errors).toEqual([])
    expect(entries).toEqual([{ quantity: 3, name: 'Sol Ring', setCode: undefined, collectorNumber: undefined, foil: false }])
  })

  it('format "Nx Nom"', () => {
    const { entries, errors } = parseDecklist('2x Lightning Bolt')
    expect(errors).toEqual([])
    expect(entries).toEqual([{ quantity: 2, name: 'Lightning Bolt', setCode: undefined, collectorNumber: undefined, foil: false }])
  })

  it('ligne *F* sans set : le foil ne doit pas être avalé par le nom', () => {
    const { entries, errors } = parseDecklist('1 Some Card *F*')
    expect(errors).toEqual([])
    expect(entries).toEqual([{ quantity: 1, name: 'Some Card', setCode: undefined, collectorNumber: undefined, foil: true }])
  })

  it('nom avec virgule + set + foil (format réel exact)', () => {
    const { entries } = parseDecklist('1 Eivor, Battle-Ready (ACR) 274 *F*')
    expect(entries).toEqual([{ quantity: 1, name: 'Eivor, Battle-Ready', setCode: 'ACR', collectorNumber: '274', foil: true }])
  })

  it('ignore les lignes vides, les commentaires et les en-têtes de section', () => {
    const text = [
      '// commentaire',
      '',
      'Deck',
      '1 Sol Ring',
      'Sideboard',
      '# autre commentaire',
      'Commander',
      "1 Atraxa, Praetors' Voice (PCA) 1",
      '',
    ].join('\n')

    const { entries, errors } = parseDecklist(text)
    expect(errors).toEqual([])
    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({ quantity: 1, name: 'Sol Ring', setCode: undefined, collectorNumber: undefined, foil: false })
    expect(entries[1]).toEqual({
      quantity: 1,
      name: "Atraxa, Praetors' Voice",
      setCode: 'PCA',
      collectorNumber: '1',
      foil: false,
    })
  })

  it('journalise une erreur non bloquante sur une ligne mal formée', () => {
    const { entries, errors } = parseDecklist('pas une ligne de deck valide')
    expect(entries).toHaveLength(0)
    expect(errors).toHaveLength(1)
  })
})
