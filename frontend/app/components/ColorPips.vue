<script setup lang="ts">
/**
 * Identité de couleur affichée avec les vraies icônes de mana (SVG Scryfall
 * via ManaSymbol, fallback disque BEM). Ordre canonique WUBRG ; identité
 * vide = incolore ({C}).
 */
const props = defineProps<{ colors: string[] }>()

const CANONICAL_ORDER = ['W', 'U', 'B', 'R', 'G']

const ordered = computed(() => {
  if (props.colors.length === 0) return ['C']
  return [...props.colors].sort((a, b) => CANONICAL_ORDER.indexOf(a) - CANONICAL_ORDER.indexOf(b))
})

const LABELS: Record<string, string> = {
  W: 'Blanc',
  U: 'Bleu',
  B: 'Noir',
  R: 'Rouge',
  G: 'Vert',
  C: 'Incolore',
}
</script>

<template>
  <span class="inline-flex items-center gap-0.5">
    <ManaSymbol
      v-for="color in ordered"
      :key="color"
      :code="color"
      :title="LABELS[color] ?? color"
    />
  </span>
</template>
