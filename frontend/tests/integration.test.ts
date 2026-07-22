/**
 * Test d'intégration bout-en-bout (réseau réel).
 *
 * Prérequis : API Symfony démarrée sur http://127.0.0.1:8000
 *   cd api && symfony server:start --port=8000
 * Lancement : INTEGRATION=1 npm run test -- tests/integration.test.ts
 *
 * Vérifie le parcours complet : parsing des vraies fixtures → résolution
 * Scryfall via l'API locale (cache mutualisé) → fusion du pool → complétion
 * d'« Ancient Arsenal » (deck possédé) ≈ 100 %.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseManaBoxCsv } from '../lib/engine/parse-csv'
import { parseDecklist } from '../lib/engine/parse-decklist'
import { buildPool } from '../lib/engine/inventory'
import { scoreDecklist } from '../lib/engine/scoring'
import { createCardLookup, type ResolvedCard } from '../lib/engine/types'

const API = 'http://127.0.0.1:8000'
const FIXTURES = join(__dirname, '..', '..', 'data', 'fixtures')
const CHUNK_SIZE = 300

type Identifier = { scryfallId: string } | { set: string; collectorNumber: string }

async function api(
  path: string,
  options: { method?: string; body?: unknown; cookie?: string } = {},
): Promise<{ status: number; json: any; setCookie: string | null }> {
  const response = await fetch(`${API}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.cookie ? { Cookie: options.cookie } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  const setCookie = response.headers.get('set-cookie')
  const json = await response.json().catch(() => null)
  return { status: response.status, json, setCookie }
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

describe.skipIf(!process.env.INTEGRATION)('intégration bout-en-bout', () => {
  it('« Ancient Arsenal » est complété à ~100 % par le pool fusionné', async () => {
    // 1. Auth : compte jetable
    const username = `integration-${Date.now()}`
    const password = 'integration-test-1'
    const register = await api('/api/register', { method: 'POST', body: { username, password } })
    expect(register.status).toBe(201)

    const login = await api('/api/login', { method: 'POST', body: { username, password } })
    expect(login.status).toBe(200)
    expect(login.setCookie).toContain('auth_token=')
    const cookie = login.setCookie!.split(';')[0]

    // 2. Parsing des vraies fixtures
    const csv = readFileSync(join(FIXTURES, 'collection.csv'), 'utf8')
    const { rows, errors } = parseManaBoxCsv(csv)
    expect(errors).toHaveLength(0)
    expect(rows).toHaveLength(705)

    const deckFiles = readdirSync(join(FIXTURES, 'decks')).filter((f) => f.endsWith('.txt'))
    expect(deckFiles).toHaveLength(8)
    const decks = deckFiles.map((file) => {
      const { entries, errors: deckErrors } = parseDecklist(
        readFileSync(join(FIXTURES, 'decks', file), 'utf8'),
      )
      expect(deckErrors).toHaveLength(0)
      return { name: file.replace(/\.txt$/, ''), entries, include: true }
    })

    // 3. Résolution via l'API locale (chunks ≤ 300)
    const identifierMap = new Map<string, Identifier>()
    for (const row of rows) identifierMap.set(row.scryfallId, { scryfallId: row.scryfallId })
    for (const deck of decks) {
      for (const entry of deck.entries) {
        if (entry.setCode && entry.collectorNumber) {
          identifierMap.set(`${entry.setCode}|${entry.collectorNumber}`, {
            set: entry.setCode,
            collectorNumber: entry.collectorNumber,
          })
        }
      }
    }
    const identifiers = [...identifierMap.values()]

    const cards: ResolvedCard[] = []
    const notFound: unknown[] = []
    for (const batch of chunk(identifiers, CHUNK_SIZE)) {
      const resolve = await api('/api/cards/resolve', {
        method: 'POST',
        body: { identifiers: batch },
        cookie,
      })
      expect(resolve.status).toBe(200)
      cards.push(...resolve.json.cards)
      notFound.push(...resolve.json.not_found)
    }

    console.log(`Résolues : ${cards.length}, introuvables : ${notFound.length}`)
    if (notFound.length > 0) console.log('not_found:', JSON.stringify(notFound))
    // Tolérance : quelques variantes exotiques peuvent manquer, jamais plus de 1 %
    expect(notFound.length).toBeLessThanOrEqual(Math.ceil(identifiers.length * 0.01))

    // 4. Fusion + scoring
    const lookup = createCardLookup(cards)
    const pool = buildPool(rows, decks)
    expect(pool.reduce((sum, item) => sum + item.quantity, 0)).toBe(1392)

    const ancientArsenal = decks.find((d) => d.name === 'Ancient Arsenal')!
    const result = scoreDecklist(ancientArsenal.entries, pool, lookup, {
      allowOtherEditions: false,
    })

    console.log(
      `Ancient Arsenal : ${result.percent} % (${result.ownedCount}/${result.total}), ` +
        `manquantes : ${result.missing.length}, non résolues : ${result.unresolvedEntries.length}`,
    )
    expect(result.unresolvedEntries).toHaveLength(0)
    // Ancient Arsenal : 20 entrées / 60 cartes dont 11 Mountain + 11 Plains
    // (terrains de base, toujours possédés) → total 60, owned 60, percent 100.
    expect(result.total).toBe(60)
    expect(result.ownedCount).toBe(60)
    expect(result.percent).toBe(100)

    // 5. Cache : un second resolve du premier chunk est servi par le cache,
    // à l'exception des cartes sans aucun prix EUR (traitées comme périmées
    // par conception pour retenter la récupération du prix Cardmarket).
    const second = await api('/api/cards/resolve', {
      method: 'POST',
      body: { identifiers: identifiers.slice(0, CHUNK_SIZE) },
      cookie,
    })
    expect(second.status).toBe(200)
    expect(second.json.debug.from_scryfall).toBeLessThanOrEqual(5)
    expect(second.json.debug.from_cache).toBeGreaterThanOrEqual(CHUNK_SIZE - 5)
  }, 240_000)
})
