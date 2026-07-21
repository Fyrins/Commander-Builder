<script setup lang="ts">
/**
 * Détail des terrains de base nécessaires dans une decklist : quantité par
 * type, avec le symbole de mana correspondant. Les terrains de base sont
 * considérés comme toujours possédés — cet encart indique combien en sortir
 * de sa réserve, en complément des terrains spéciaux comptés comme des
 * cartes à part entière.
 */
import type { DecklistEntry } from '~~/lib/engine/types'
import { isBasicLandName } from '~~/lib/engine/lands'

const props = defineProps<{ entries: DecklistEntry[] }>()

const BASIC_INFO: Record<string, { fr: string; symbol: string }> = {
  plains: { fr: 'Plaine', symbol: 'W' },
  island: { fr: 'Île', symbol: 'U' },
  swamp: { fr: 'Marais', symbol: 'B' },
  mountain: { fr: 'Montagne', symbol: 'R' },
  forest: { fr: 'Forêt', symbol: 'G' },
  wastes: { fr: 'Wastes', symbol: 'C' },
}

const basics = computed(() => {
  const counts = new Map<string, { label: string; symbol: string; quantity: number }>()
  for (const entry of props.entries) {
    if (!isBasicLandName(entry.name)) continue
    const key = entry.name.toLowerCase()
    const base = Object.keys(BASIC_INFO).find((name) => key.includes(name))
    const info = base ? BASIC_INFO[base]! : { fr: entry.name, symbol: 'C' }
    const snow = key.includes('snow-covered') || key.includes('enneig')
    const label = snow ? `${info.fr} enneigée` : info.fr
    const existing = counts.get(label)
    if (existing) existing.quantity += entry.quantity
    else counts.set(label, { label, symbol: info.symbol, quantity: entry.quantity })
  }
  return [...counts.values()]
})

const total = computed(() => basics.value.reduce((sum, b) => sum + b.quantity, 0))
</script>

<template>
  <div v-if="basics.length > 0" class="panel px-4 py-3 ">
    <p class="mb-2 text-sm font-medium text-muted">
      Terrains de base à prévoir ({{ total }}) — considérés comme déjà possédés
    </p>
    <ul class="flex flex-wrap gap-x-5 gap-y-1.5">
      <li v-for="basic in basics" :key="basic.label" class="flex items-center gap-1.5 text-sm text-muted">
        <ManaSymbol :code="basic.symbol" />
        <span>{{ basic.quantity }} × {{ basic.label }}</span>
      </li>
    </ul>
  </div>
</template>
