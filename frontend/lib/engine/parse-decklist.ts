/**
 * Parseur de decklists au format texte ligne-par-ligne.
 * Formats supportés :
 *  - `N Nom (SET) numéro` avec éventuel ` *F*` final (foil)
 *  - `N Nom` / `Nx Nom` (sans set)
 *  - lignes vides et commentaires (`//`, `#`) ignorés
 *  - en-têtes de section seules sur une ligne (`Deck`, `Sideboard`, `Commander`) ignorées
 */
import type { DecklistEntry } from './types'

// Le `*F*` doit être détecté avant d'être avalé par le groupe nom quand
// il n'y a pas de (SET) : le groupe nom est non-greedy, le moteur regex
// backtrack jusqu'à trouver le plus petit nom qui satisfait le reste du
// motif (groupe set optionnel, suffixe *F* optionnel, fin de ligne).
const LINE_RE = /^(\d+)x?\s+(.+?)(?:\s+\(([A-Za-z0-9]{2,6})\)\s+([\w★†-]+))?(?:\s+\*F\*)?\s*$/
const FOIL_SUFFIX_RE = /\*F\*\s*$/

const SECTION_HEADERS = new Set(['deck', 'sideboard', 'commander'])

/** Parse une decklist texte en entrées typées, avec un journal d'erreurs non bloquant. */
export function parseDecklist(text: string): { entries: DecklistEntry[]; errors: string[] } {
  const entries: DecklistEntry[] = []
  const errors: string[] = []
  const lines = text.split(/\r\n|\r|\n/)

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i]
    const line = raw.trim()
    const lineNumber = i + 1

    if (line === '') continue
    if (line.startsWith('//') || line.startsWith('#')) continue
    if (SECTION_HEADERS.has(line.toLowerCase())) continue

    const match = LINE_RE.exec(line)
    if (!match) {
      errors.push(`Ligne ${lineNumber} : format non reconnu "${raw}"`)
      continue
    }

    const [, qtyRaw, nameRaw, setCode, collectorNumber] = match
    const quantity = Number.parseInt(qtyRaw, 10)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      errors.push(`Ligne ${lineNumber} : quantité invalide "${qtyRaw}"`)
      continue
    }

    const name = nameRaw.trim()
    if (!name) {
      errors.push(`Ligne ${lineNumber} : nom de carte manquant`)
      continue
    }

    entries.push({
      quantity,
      name,
      setCode: setCode || undefined,
      collectorNumber: collectorNumber || undefined,
      foil: FOIL_SUFFIX_RE.test(line),
    })
  }

  return { entries, errors }
}
