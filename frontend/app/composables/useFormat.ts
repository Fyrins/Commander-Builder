/**
 * Formatage partagé des prix EUR (source Scryfall / Cardmarket).
 */

/** Formate un prix décimal (string API) en "3,42 €", ou "—" si absent. */
export function formatEur(price: string | null | undefined): string {
  if (price === null || price === undefined || price === '') return '—'
  const value = Number(price)
  if (Number.isNaN(value)) return '—'
  return `${value.toFixed(2).replace('.', ',')} €`
}
