/**
 * Détection des cartes jouables comme commandant :
 *  - typeLine contient "Legendary Creature"
 *  - OU oracleText contient "can be your commander"
 * (insensible à la casse), dédupliqué par oracleId.
 */
import type { ResolvedCard } from './types'

const LEGENDARY_CREATURE_RE = /legendary creature/i
const CAN_BE_COMMANDER_RE = /can be your commander/i

export function detectCommanders(cards: ResolvedCard[]): ResolvedCard[] {
  const seen = new Set<string>()
  const result: ResolvedCard[] = []

  for (const card of cards) {
    const isLegendaryCreature = LEGENDARY_CREATURE_RE.test(card.typeLine ?? '')
    const canBeCommander = CAN_BE_COMMANDER_RE.test(card.oracleText ?? '')
    if (!isLegendaryCreature && !canBeCommander) continue
    if (seen.has(card.oracleId)) continue

    seen.add(card.oracleId)
    result.push(card)
  }

  return result
}
