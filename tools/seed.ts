/**
 * Seed du compte d'Alexandre à partir de data/fixtures/ (via l'API HTTP,
 * en réutilisant les parseurs testés du moteur).
 *
 * Prérequis : API démarrée (cd api && symfony server:start --port=8000).
 * Usage :     cd frontend && npx tsx ../tools/seed.ts
 * Options :   SEED_USERNAME / SEED_PASSWORD / SEED_API (défauts ci-dessous)
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseManaBoxCsv } from '../frontend/lib/engine/parse-csv'
import { parseDecklist } from '../frontend/lib/engine/parse-decklist'

const API = process.env.SEED_API ?? 'http://127.0.0.1:8000'
const USERNAME = process.env.SEED_USERNAME ?? 'alex'
const PASSWORD = process.env.SEED_PASSWORD ?? 'mtg-builder-2026'
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'fixtures')
const CHUNK_SIZE = 300

async function api(path: string, options: { method?: string; body?: unknown; cookie?: string } = {}) {
  const response = await fetch(`${API}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.cookie ? { Cookie: options.cookie } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  return {
    status: response.status,
    json: await response.json().catch(() => null),
    setCookie: response.headers.get('set-cookie'),
  }
}

async function main() {
  // 1. Compte (register idempotent : 409 si déjà créé)
  const register = await api('/api/register', { method: 'POST', body: { username: USERNAME, password: PASSWORD } })
  if (register.status === 201) console.log(`Compte créé : ${USERNAME}`)
  else if (register.status === 409) console.log(`Compte existant : ${USERNAME}`)
  else throw new Error(`register → ${register.status} ${JSON.stringify(register.json)}`)

  const login = await api('/api/login', { method: 'POST', body: { username: USERNAME, password: PASSWORD } })
  if (login.status !== 200 || !login.setCookie) throw new Error(`login → ${login.status}`)
  const cookie = login.setCookie.split(';')[0]

  // 2. Collection
  const { rows, errors } = parseManaBoxCsv(readFileSync(join(FIXTURES, 'collection.csv'), 'utf8'))
  if (errors.length) console.warn(`Lignes CSV ignorées : ${errors.length}`, errors)
  const items = rows.map((row) => ({
    scryfallId: row.scryfallId,
    quantity: row.quantity,
    foil: row.foil,
    language: row.language,
    condition: row.condition,
  }))
  const put = await api('/api/collection', { method: 'PUT', body: { items }, cookie })
  if (put.status !== 200) throw new Error(`PUT collection → ${put.status} ${JSON.stringify(put.json)}`)
  console.log(`Collection importée : ${rows.length} lignes (${rows.reduce((s, r) => s + r.quantity, 0)} cartes)`)

  // 3. Decks (idempotent par nom)
  const existing = await api('/api/decks', { cookie })
  const existingNames = new Set(
    (Array.isArray(existing.json) ? existing.json : existing.json?.decks ?? []).map((d: any) => d.name),
  )
  const deckFiles = readdirSync(join(FIXTURES, 'decks')).filter((f) => f.endsWith('.txt'))
  for (const file of deckFiles) {
    const name = file.replace(/\.txt$/, '')
    if (existingNames.has(name)) {
      console.log(`Deck déjà présent : ${name}`)
      continue
    }
    const { entries, errors: deckErrors } = parseDecklist(readFileSync(join(FIXTURES, 'decks', file), 'utf8'))
    if (deckErrors.length) console.warn(`${name} : lignes ignorées`, deckErrors)
    const post = await api('/api/decks', {
      method: 'POST',
      cookie,
      body: {
        name,
        isOwnedDeck: true,
        items: entries.map((e) => ({
          nameRaw: e.name,
          setCode: e.setCode ?? null,
          collectorNumber: e.collectorNumber ?? null,
          quantity: e.quantity,
          foil: e.foil,
        })),
      },
    })
    if (post.status !== 201) throw new Error(`POST deck ${name} → ${post.status} ${JSON.stringify(post.json)}`)
    console.log(`Deck importé : ${name} (${entries.length} entrées)`)
  }

  // 4. Préchauffage du cache de cartes
  const identifiers = new Map<string, object>()
  for (const row of rows) identifiers.set(row.scryfallId, { scryfallId: row.scryfallId })
  for (const file of deckFiles) {
    const { entries } = parseDecklist(readFileSync(join(FIXTURES, 'decks', file), 'utf8'))
    for (const e of entries) {
      if (e.setCode && e.collectorNumber) {
        identifiers.set(`${e.setCode}|${e.collectorNumber}`, { set: e.setCode, collectorNumber: e.collectorNumber })
      }
    }
  }
  const all = [...identifiers.values()]
  let resolved = 0
  let notFound = 0
  for (let i = 0; i < all.length; i += CHUNK_SIZE) {
    const res = await api('/api/cards/resolve', {
      method: 'POST',
      cookie,
      body: { identifiers: all.slice(i, i + CHUNK_SIZE) },
    })
    if (res.status !== 200) throw new Error(`resolve → ${res.status}`)
    resolved += res.json.cards.length
    notFound += res.json.not_found.length
  }
  console.log(`Cartes résolues : ${resolved}, introuvables : ${notFound}`)
  console.log(`\nSeed terminé. Connexion : ${USERNAME} / ${PASSWORD}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
