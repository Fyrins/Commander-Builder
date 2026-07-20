/**
 * Statistiques de decklist : courbe de mana, répartition des pips de coût,
 * production de mana par couleur, répartition par type, et probabilité de
 * pioche hypergéométrique. Modules purs, zéro dépendance réseau/Nuxt.
 */
import { resolveEntry } from './scoring'
import type { CardLookup, DecklistEntry, ResolvedCard } from './types'

const WUBRG = ['W', 'U', 'B', 'R', 'G'] as const
type Wubrg = (typeof WUBRG)[number]

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function isLandCard(card: ResolvedCard | undefined, fallbackName: string): boolean {
  if (card) return frontFaceTypeLine(card.typeLine).includes('Land')
  return /\bland\b/i.test(fallbackName)
}

function frontFaceTypeLine(typeLine: string): string {
  return typeLine.split('//')[0]?.trim() ?? typeLine
}

/**
 * Extrait les codes de symboles de mana d'une chaîne de coût Scryfall
 * (`{2}{G}{G}` → ['2', 'G', 'G']), sans dépendre du parseur de rendu.
 */
function extractManaSymbols(manaCost: string): string[] {
  const matches = manaCost.match(/\{([^}]+)\}/g)
  if (!matches) return []
  return matches.map((symbol) => symbol.slice(1, -1).toUpperCase())
}

// ---------------------------------------------------------------------------
// manaCurve
// ---------------------------------------------------------------------------

export interface ManaCurveBucket {
  label: string
  count: number
}

export interface ManaCurveResult {
  buckets: ManaCurveBucket[]
  avgManaValue: number
  totalManaValue: number
}

const CURVE_LABELS = ['0', '1', '2', '3', '4', '5', '6', '7', '8+']

/**
 * Courbe de mana pondérée par quantité, cartes non-terrain uniquement.
 * Les entrées non résolues sont ignorées (cmc inconnu).
 */
export function manaCurve(entries: DecklistEntry[], lookup: CardLookup): ManaCurveResult {
  const counts = new Array(CURVE_LABELS.length).fill(0)
  let totalManaValue = 0
  let nonLandCount = 0

  for (const entry of entries) {
    const card = resolveEntry(entry, lookup)
    if (!card) continue
    if (isLandCard(card, entry.name)) continue

    const qty = entry.quantity
    const cmc = card.cmc
    const bucketIndex = Math.min(Math.max(Math.floor(cmc), 0), CURVE_LABELS.length - 1)

    counts[bucketIndex] += qty
    totalManaValue += cmc * qty
    nonLandCount += qty
  }

  return {
    buckets: CURVE_LABELS.map((label, index) => ({ label, count: counts[index] })),
    avgManaValue: nonLandCount === 0 ? 0 : round2(totalManaValue / nonLandCount),
    totalManaValue: round2(totalManaValue),
  }
}

// ---------------------------------------------------------------------------
// colorPipCosts
// ---------------------------------------------------------------------------

export interface ColorPipStat {
  pips: number
  cards: number
  percent: number
}

export interface ColorPipCosts {
  W: ColorPipStat
  U: ColorPipStat
  B: ColorPipStat
  R: ColorPipStat
  G: ColorPipStat
  colorless: ColorPipStat
}

/**
 * Répartition des symboles de coût de mana par couleur (WUBRG) + colorless.
 * Un symbole hybride (`{G/W}`) compte un pip pour chaque couleur présente ;
 * un hybride générique (`{2/U}`) ou phyrexian (`{B/P}`) ne compte que pour
 * le côté couleur. `cards` compte, pondéré par quantité, les cartes contenant
 * au moins une occurrence de la couleur (indépendamment du nombre de pips).
 */
export function colorPipCosts(entries: DecklistEntry[], lookup: CardLookup): ColorPipCosts {
  const pips: Record<Wubrg | 'colorless', number> = { W: 0, U: 0, B: 0, R: 0, G: 0, colorless: 0 }
  const cards: Record<Wubrg | 'colorless', number> = { W: 0, U: 0, B: 0, R: 0, G: 0, colorless: 0 }

  for (const entry of entries) {
    const card = resolveEntry(entry, lookup)
    if (!card || !card.manaCost) continue

    const qty = entry.quantity
    const symbols = extractManaSymbols(card.manaCost)
    const presentColors = new Set<Wubrg | 'colorless'>()

    for (const symbol of symbols) {
      if ((WUBRG as readonly string[]).includes(symbol)) {
        pips[symbol as Wubrg] += qty
        presentColors.add(symbol as Wubrg)
        continue
      }
      if (symbol === 'C') {
        pips.colorless += qty
        presentColors.add('colorless')
        continue
      }
      if (symbol.includes('/')) {
        for (const part of symbol.split('/')) {
          if ((WUBRG as readonly string[]).includes(part)) {
            pips[part as Wubrg] += qty
            presentColors.add(part as Wubrg)
          }
        }
      }
    }

    for (const color of presentColors) {
      cards[color] += qty
    }
  }

  const total = WUBRG.reduce((sum, color) => sum + pips[color], 0) + pips.colorless

  const stat = (color: Wubrg | 'colorless'): ColorPipStat => ({
    pips: pips[color],
    cards: cards[color],
    percent: total === 0 ? 0 : round1((pips[color] / total) * 100),
  })

  return {
    W: stat('W'),
    U: stat('U'),
    B: stat('B'),
    R: stat('R'),
    G: stat('G'),
    colorless: stat('colorless'),
  }
}

// ---------------------------------------------------------------------------
// colorProduction
// ---------------------------------------------------------------------------

export interface ColorProductionStat {
  sources: number
  percent: number
}

export interface ColorProduction {
  W: ColorProductionStat
  U: ColorProductionStat
  B: ColorProductionStat
  R: ColorProductionStat
  G: ColorProductionStat
  C: ColorProductionStat
}

const WUBRGC = ['W', 'U', 'B', 'R', 'G', 'C'] as const
type Wubrgc = (typeof WUBRGC)[number]

/**
 * Nombre de sources de mana par couleur (WUBRG + colorless), pondéré par
 * quantité : une carte compte pour une couleur dès que `producedMana` la
 * contient.
 */
export function colorProduction(entries: DecklistEntry[], lookup: CardLookup): ColorProduction {
  const sources: Record<Wubrgc, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }

  for (const entry of entries) {
    const card = resolveEntry(entry, lookup)
    if (!card || !card.producedMana) continue

    const qty = entry.quantity
    for (const color of card.producedMana) {
      const upper = color.toUpperCase()
      if ((WUBRGC as readonly string[]).includes(upper)) {
        sources[upper as Wubrgc] += qty
      }
    }
  }

  const total = WUBRGC.reduce((sum, color) => sum + sources[color], 0)

  const stat = (color: Wubrgc): ColorProductionStat => ({
    sources: sources[color],
    percent: total === 0 ? 0 : round1((sources[color] / total) * 100),
  })

  return {
    W: stat('W'),
    U: stat('U'),
    B: stat('B'),
    R: stat('R'),
    G: stat('G'),
    C: stat('C'),
  }
}

// ---------------------------------------------------------------------------
// typeBreakdown
// ---------------------------------------------------------------------------

export type CardTypeKey =
  | 'creature'
  | 'instant'
  | 'sorcery'
  | 'artifact'
  | 'enchantment'
  | 'planeswalker'
  | 'battle'
  | 'land'
  | 'other'

export type TypeBreakdown = Record<CardTypeKey, number>

const TYPE_KEYWORDS: [CardTypeKey, RegExp][] = [
  ['creature', /creature/i],
  ['planeswalker', /planeswalker/i],
  ['battle', /battle/i],
  ['instant', /instant/i],
  ['sorcery', /sorcery/i],
  ['artifact', /artifact/i],
  ['enchantment', /enchantment/i],
]

/**
 * Comptes pondérés par quantité, par type principal (face avant pour les
 * cartes recto-verso `//`). Terrain prioritaire sur tout autre type
 * (ex. Dryad Arbor, terrain-créature, compte comme terrain).
 */
export function typeBreakdown(entries: DecklistEntry[], lookup: CardLookup): TypeBreakdown {
  const counts: TypeBreakdown = {
    creature: 0,
    instant: 0,
    sorcery: 0,
    artifact: 0,
    enchantment: 0,
    planeswalker: 0,
    battle: 0,
    land: 0,
    other: 0,
  }

  for (const entry of entries) {
    const card = resolveEntry(entry, lookup)
    const qty = entry.quantity

    if (isLandCard(card, entry.name)) {
      counts.land += qty
      continue
    }

    if (!card) {
      counts.other += qty
      continue
    }

    const front = frontFaceTypeLine(card.typeLine)
    const match = TYPE_KEYWORDS.find(([, re]) => re.test(front))
    counts[match ? match[0] : 'other'] += qty
  }

  return counts
}

// ---------------------------------------------------------------------------
// drawProbability
// ---------------------------------------------------------------------------

/** log(C(n, k)) via produit itératif de logs, pour éviter l'overflow des factorielles. */
function logChoose(n: number, k: number): number {
  if (k < 0 || k > n) return -Infinity
  if (k === 0 || k === n) return 0

  const kk = Math.min(k, n - k)
  let result = 0
  for (let i = 1; i <= kk; i++) {
    result += Math.log(n - kk + i) - Math.log(i)
  }
  return result
}

/**
 * Probabilité hypergéométrique P(X >= minSuccesses) de piocher au moins
 * `minSuccesses` cartes "succès" parmi `cardsDrawn` piochées dans un deck
 * de `deckSize` cartes contenant `successesInDeck` succès. Calcul en
 * espace logarithmique (pas de factorielles brutes) pour rester stable
 * jusqu'à deckSize ~200.
 */
export function drawProbability(
  deckSize: number,
  successesInDeck: number,
  cardsDrawn: number,
  minSuccesses: number,
): number {
  if (deckSize <= 0 || cardsDrawn <= 0) return 0
  if (minSuccesses <= 0) return 1

  const totalLog = logChoose(deckSize, cardsDrawn)
  if (totalLog === -Infinity) return 0

  const failuresInDeck = deckSize - successesInDeck
  const upper = Math.min(cardsDrawn, successesInDeck)
  let probability = 0

  for (let successes = minSuccesses; successes <= upper; successes++) {
    const failuresDrawn = cardsDrawn - successes
    if (failuresDrawn < 0 || failuresDrawn > failuresInDeck) continue

    const logTerm = logChoose(successesInDeck, successes) + logChoose(failuresInDeck, failuresDrawn) - totalLog
    probability += Math.exp(logTerm)
  }

  return probability
}
