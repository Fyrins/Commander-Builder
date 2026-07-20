/**
 * Rendu graphique des symboles de mana Scryfall (`{6}{U}`, `{X}{G}{G}`, `{G/W}`, `{2/U}`, `{B/P}`,
 * `{C}`, `{S}`, `{T}`…) trouvés dans les coûts de mana et les textes oracle.
 */

export type ManaSegment = { type: 'symbol'; code: string } | { type: 'text'; value: string }

/**
 * Découpe une chaîne Scryfall en segments texte / symbole. Les accolades délimitent les symboles ;
 * tout le reste (espaces, ponctuation, retours à la ligne) est conservé tel quel comme texte.
 * Fonction pure, sans dépendance au DOM.
 */
export function parseManaString(text: string): ManaSegment[] {
  const segments: ManaSegment[] = []
  if (!text) return segments

  const regex = /\{([^{}]*)\}|([^{}]+)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (match[1] !== undefined) {
      segments.push({ type: 'symbol', code: match[1] })
    } else if (match[2] !== undefined) {
      segments.push({ type: 'text', value: match[2] })
    }
  }
  return segments
}

/** Couleurs WUBRG, alignées sur les variables CSS `--mtg-*` de main.css. */
const COLOR_VARS: Record<string, string> = {
  W: 'var(--mtg-white)',
  U: 'var(--mtg-blue)',
  B: 'var(--mtg-black)',
  R: 'var(--mtg-red)',
  G: 'var(--mtg-green)',
}

/** Gris neutre utilisé pour le côté « générique » d'un symbole hybride type `{2/U}`. */
const GENERIC_COLOR = '#9aa3af'

export interface ManaSymbolMeta {
  /** Modificateur BEM principal (`.mana--<modifier>`). */
  modifier: string
  /** Texte affiché au centre du disque. */
  label: string
  /** Modificateur BEM secondaire de couleur (utilisé par les symboles phyrexians, ex. `.mana--w`). */
  colorModifier?: string
  /** Paire de couleurs CSS pour le dégradé diagonal des symboles hybrides. */
  colors?: [string, string]
}

/** Résout le rendu (forme, couleur, texte) d'un code de symbole de mana (sans les accolades). */
export function resolveManaSymbol(code: string): ManaSymbolMeta {
  const upper = code.toUpperCase().trim()

  // Générique numérique {0}-{20}, ou variable {X}/{Y}/{Z} : disque gris.
  if (/^\d+$/.test(upper) || upper === 'X' || upper === 'Y' || upper === 'Z') {
    return { modifier: 'generic', label: upper }
  }

  // Couleurs WUBRG.
  if (upper in COLOR_VARS) {
    return { modifier: upper.toLowerCase(), label: upper }
  }

  if (upper === 'C') return { modifier: 'c', label: 'C' }
  if (upper === 'S') return { modifier: 's', label: 'S' }
  if (upper === 'T') return { modifier: 'tap', label: 'T' }

  // Hybrides {G/W}, {2/U} et phyrexians {B/P}.
  if (upper.includes('/')) {
    const [a, b] = upper.split('/')
    if (a && b) {
      if (b === 'P' && a in COLOR_VARS) {
        return { modifier: 'phyrexian', label: 'P', colorModifier: a.toLowerCase() }
      }
      if (a === 'P' && b in COLOR_VARS) {
        return { modifier: 'phyrexian', label: 'P', colorModifier: b.toLowerCase() }
      }
      const colorA = COLOR_VARS[a] ?? GENERIC_COLOR
      const colorB = COLOR_VARS[b] ?? GENERIC_COLOR
      return { modifier: 'hybrid', label: `${a}/${b}`, colors: [colorA, colorB] }
    }
  }

  // Symbole non reconnu : repli disque gris avec le texte brut.
  return { modifier: 'unknown', label: code }
}
