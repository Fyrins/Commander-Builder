/**
 * Captures d'écran du produit pour la landing, depuis le compte seedé (alex).
 *
 * Prérequis : API (:8000) + front dev (:3000) + seed lancés, et `cwebp`
 *             disponible (brew install webp) pour produire les .webp servis.
 * Usage :     cd frontend && node ../tools/screenshots.mjs
 *
 * Thème sombre forcé, viewport 1440×900 retina. Sorties directement en
 * frontend/public/screenshots/*.webp (viewport, above-the-fold).
 */
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'

// Playwright est une devDependency de frontend/ : on le résout depuis là.
const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(join(here, '..', 'frontend', 'package.json'))
const { chromium } = require('playwright')

const BASE = process.env.SHOT_BASE ?? 'http://localhost:3000'
const USER = process.env.SEED_USERNAME ?? 'alex'
const PASS = process.env.SEED_PASSWORD ?? 'mtg-builder-2026'
const OUT = join(here, '..', 'frontend', 'public', 'screenshots')
mkdirSync(OUT, { recursive: true })

// La landing sert des .webp : on convertit chaque capture immédiatement, pour
// qu'un simple re-run mette à jour les assets réellement servis (pas de PNG orphelin).
try {
  execFileSync('cwebp', ['-version'], { stdio: 'ignore' })
} catch {
  console.error('cwebp introuvable — installe-le (brew install webp) pour générer les .webp.')
  process.exit(1)
}

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  // Force le thème sombre (clé de stockage @nuxtjs/color-mode)
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('nuxt-color-mode', 'dark')
    } catch {}
  })
  const page = await ctx.newPage()

  async function shot(name) {
    // Masque le badge Nuxt DevTools (présent en dev, parasite les captures)
    await page.addStyleTag({ content: '#nuxt-devtools-anchor, #nuxt-devtools-container { display: none !important }' }).catch(() => {})
    const png = join(OUT, `${name}.png`)
    const webp = join(OUT, `${name}.webp`)
    await page.screenshot({ path: png })
    execFileSync('cwebp', ['-quiet', '-q', '80', png, '-o', webp])
    rmSync(png)
    console.log('✓', name)
  }
  const wait = (ms) => page.waitForTimeout(ms)
  const softText = (t, timeout = 30000) => page.getByText(t).first().waitFor({ timeout }).catch(() => {})

  // --- Connexion (hCaptcha non enforcé en dev) ---
  await page.goto(`${BASE}/login`)
  await page.fill('#username', USER)
  await page.fill('#password', PASS)
  await page.click('button[type=submit]')
  await page.waitForURL('**/inventaire**', { timeout: 30000 }).catch(() => {})
  await wait(2000)

  // --- Inventaire ---
  await page.goto(`${BASE}/inventaire`)
  await softText('Ancient Arsenal', 60000)
  await wait(2500)
  await shot('inventaire')

  // --- Commandants ---
  await page.goto(`${BASE}/commanders`)
  await softText('Mes commandants')
  await wait(5000) // scans
  await shot('commandants')

  // --- Comparateur (deck exclu du pool → manquantes chiffrées) ---
  await page.goto(`${BASE}/compare`)
  await wait(2500)
  await page.locator('select').first().selectOption({ label: 'Araignées' }).catch(() => {})
  await page.getByRole('checkbox', { name: /Exclure ce deck/ }).check().catch(() => {})
  await softText('Coût au meilleur prix')
  await wait(9000) // prix les moins chers (Scryfall)
  await shot('comparateur')

  // --- Fiche deck (rapide, un seul deck) ---
  await page.goto(`${BASE}/decks?commander=dragonlord-atarka`)
  await softText('À acheter en priorité', 60000)
  await wait(5000)
  await shot('deck-detail')

  // --- Classement des decks (lent : ~2-3 min au premier chargement) ---
  await page.goto(`${BASE}/decks`)
  await softText('Commandant possédé', 220000)
  await wait(3000)
  await shot('decks')

  console.log('\nCaptures terminées →', OUT)
} finally {
  await browser.close()
}
