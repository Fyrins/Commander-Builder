/**
 * Parseur CSV RFC-4180 minimal (champs quotés, quotes échappées "",
 * virgules et sauts de ligne dans les champs, CRLF/LF), et mapping
 * spécifique à l'export ManaBox (mapping par NOM de colonne du header).
 */
import type { CollectionRow } from './types'

/**
 * Parse un texte CSV en tableau de lignes de champs (RFC-4180).
 * Gère : champs entre guillemets, guillemets échappés (""), virgules et
 * retours à la ligne dans les champs, séparateurs de ligne CRLF ou LF.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  const len = text.length

  const pushField = () => {
    row.push(field)
    field = ''
  }
  const pushRow = () => {
    pushField()
    rows.push(row)
    row = []
  }

  while (i < len) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += char
      i += 1
      continue
    }

    if (char === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (char === ',') {
      pushField()
      i += 1
      continue
    }
    if (char === '\r') {
      if (text[i + 1] === '\n') {
        i += 1
      }
      pushRow()
      i += 1
      continue
    }
    if (char === '\n') {
      pushRow()
      i += 1
      continue
    }
    field += char
    i += 1
  }

  // Dernier champ/ligne s'il n'y a pas de saut de ligne final.
  if (field.length > 0 || row.length > 0) {
    pushRow()
  }

  // Ignore les lignes vides isolées (ex : ligne vide en fin de fichier).
  return rows.filter((r) => !(r.length === 1 && r[0] === ''))
}

const FOIL_VALUES = new Set(['foil', 'etched'])

const REQUIRED_COLUMNS = [
  'Name',
  'Set code',
  'Set name',
  'Collector number',
  'Foil',
  'Rarity',
  'Quantity',
  'Scryfall ID',
  'Condition',
  'Language',
] as const

/**
 * Parse un export ManaBox (CSV) en lignes de collection typées.
 * Le mapping se fait par nom de colonne (header), pas par index, pour
 * rester robuste à un éventuel réordonnancement des colonnes.
 */
export function parseManaBoxCsv(text: string): { rows: CollectionRow[]; errors: string[] } {
  const table = parseCsv(text)
  const errors: string[] = []

  if (table.length === 0) {
    return { rows: [], errors: ['CSV vide'] }
  }

  const header = table[0]
  const colIndex = (name: string) => header.indexOf(name)

  const indices = {
    name: colIndex('Name'),
    setCode: colIndex('Set code'),
    setName: colIndex('Set name'),
    collectorNumber: colIndex('Collector number'),
    foil: colIndex('Foil'),
    rarity: colIndex('Rarity'),
    quantity: colIndex('Quantity'),
    scryfallId: colIndex('Scryfall ID'),
    condition: colIndex('Condition'),
    language: colIndex('Language'),
  }

  const missingColumns = REQUIRED_COLUMNS.filter((name) => colIndex(name) === -1)
  if (missingColumns.length > 0) {
    return { rows: [], errors: [`En-têtes manquants dans le CSV ManaBox : ${missingColumns.join(', ')}`] }
  }

  const rows: CollectionRow[] = []

  for (let r = 1; r < table.length; r += 1) {
    const line = table[r]
    const lineNumber = r + 1

    if (line.length === 1 && line[0] === '') {
      continue
    }
    if (line.length < header.length) {
      errors.push(`Ligne ${lineNumber} : nombre de colonnes insuffisant (${line.length}/${header.length})`)
      continue
    }

    const quantityRaw = line[indices.quantity]
    const quantity = Number.parseInt(quantityRaw, 10)
    if (!Number.isFinite(quantity)) {
      errors.push(`Ligne ${lineNumber} : quantité invalide "${quantityRaw}"`)
      continue
    }

    const name = line[indices.name]
    if (!name) {
      errors.push(`Ligne ${lineNumber} : nom de carte manquant`)
      continue
    }

    const foilRaw = (line[indices.foil] ?? '').trim().toLowerCase()

    rows.push({
      name,
      setCode: line[indices.setCode],
      setName: line[indices.setName],
      collectorNumber: line[indices.collectorNumber],
      foil: FOIL_VALUES.has(foilRaw),
      rarity: line[indices.rarity],
      quantity,
      scryfallId: line[indices.scryfallId],
      language: line[indices.language],
      condition: line[indices.condition],
    })
  }

  return { rows, errors }
}
