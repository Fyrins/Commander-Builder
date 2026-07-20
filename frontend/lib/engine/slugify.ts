/**
 * Génère le slug EDHREC d'un nom de carte :
 *  - recto-verso (`//`) → ne garde que la face avant
 *  - minuscules, accents strippés (NFD)
 *  - apostrophes/virgules/points supprimés
 *  - espaces → tirets, tirets multiples réduits
 */

const DIACRITICS_RE = /[\u0300-\u036f]/g
const STRIPPED_PUNCTUATION_RE = /['’,.]/g

export function edhrecSlug(name: string): string {
  let value = name

  const slashIndex = value.indexOf('//')
  if (slashIndex !== -1) {
    value = value.slice(0, slashIndex)
  }

  value = value.normalize('NFD').replace(DIACRITICS_RE, '')
  value = value.toLowerCase()
  value = value.replace(STRIPPED_PUNCTUATION_RE, '')
  value = value.trim()
  value = value.replace(/\s+/g, '-')
  value = value.replace(/-+/g, '-')
  value = value.replace(/^-+|-+$/g, '')

  return value
}
