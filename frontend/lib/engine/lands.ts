/**
 * Détection des terrains de base (EN + FR, avec variantes enneigées),
 * insensible à la casse et aux accents.
 */
import type { ResolvedCard } from './types'

const BASIC_NAMES = new Set([
  // EN
  'plains',
  'island',
  'swamp',
  'mountain',
  'forest',
  'wastes',
  // FR (accents strippés : île/ile, forêt/foret)
  'plaine',
  'ile',
  'marais',
  'montagne',
  'foret',
])

function stripAccents(input: string): string {
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function normalize(input: string): string {
  return stripAccents(input.trim().toLowerCase())
}

/** `Snow-Covered <X>` (EN) ou `<X> enneigée` (FR) → vrai si <X> est un terrain de base. */
export function isBasicLandName(name: string | undefined | null): boolean {
  if (!name) return false
  const normalized = normalize(name)
  if (BASIC_NAMES.has(normalized)) return true

  const snowPrefixEn = normalized.match(/^snow-covered\s+(.+)$/)
  if (snowPrefixEn && BASIC_NAMES.has(snowPrefixEn[1])) return true

  const snowSuffixFr = normalized.match(/^(.+?)\s+enneigee?$/)
  if (snowSuffixFr && BASIC_NAMES.has(snowSuffixFr[1])) return true

  return false
}

/** Terrain de base à partir d'une carte résolue : flag `isBasicLand`, sinon repli sur le nom. */
export function isBasicLand(card: ResolvedCard): boolean {
  return card.isBasicLand || isBasicLandName(card.name)
}
