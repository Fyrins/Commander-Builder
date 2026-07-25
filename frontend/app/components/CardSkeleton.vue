<script setup lang="ts">
/**
 * Placeholder de chargement (shimmer thématique) épousant la structure des
 * cartes réelles, pour signaler visuellement l'attente réseau (résolution
 * Scryfall, decks moyens EDHREC, prix). Purement présentationnel et
 * `aria-hidden` : le conteneur appelant porte le `role="status"`.
 *
 * Variantes calées sur les layouts existants :
 * - `grid-card` : grille des commandants (image pleine carte + titre + pips).
 * - `row`       : ligne façon CardHoverImage (miniature + libellé + valeur).
 * - `deck-card` : carte du classement, calquée sur DeckListCard.
 *
 * `count` génère N placeholders en fragment (pas de wrapper), pour ne pas
 * casser les `grid-cols-*`/`gap-*` du parent.
 */
withDefaults(
  defineProps<{
    variant?: 'grid-card' | 'row' | 'deck-card'
    count?: number
  }>(),
  { variant: 'row', count: 1 },
)
</script>

<template>
  <template v-for="i in count" :key="i">
    <!-- grid-card : grille commandants (panel p-2 + image pleine carte + titre + pips) -->
    <div v-if="variant === 'grid-card'" class="panel p-2" aria-hidden="true">
      <div class="skeleton mb-2 aspect-[5/7] w-full rounded-lg" />
      <div class="skeleton h-4 w-3/4 rounded" />
      <div class="mt-1.5 flex gap-1">
        <div class="skeleton h-4 w-4 rounded-full" />
        <div class="skeleton h-4 w-4 rounded-full" />
      </div>
    </div>

    <!-- row : ligne CardHoverImage (miniature h-14 + libellé + valeur) -->
    <div v-else-if="variant === 'row'" class="flex items-center gap-3 panel px-3 py-2" aria-hidden="true">
      <div class="skeleton h-14 w-10 shrink-0 rounded" />
      <div class="skeleton h-4 flex-1 rounded" />
      <div class="skeleton h-4 w-12 shrink-0 rounded" />
    </div>

    <!-- deck-card : calque sur DeckListCard (miniature + titre + barre + lignes) -->
    <div v-else class="flex items-start gap-3 panel p-3" aria-hidden="true">
      <div class="skeleton h-14 w-10 shrink-0 rounded" />
      <div class="min-w-0 flex-1 space-y-1.5">
        <div class="skeleton h-4 w-2/3 rounded" />
        <div class="skeleton h-2 w-full rounded-full" />
        <div class="skeleton h-3 w-1/3 rounded" />
        <div class="skeleton h-3 w-1/2 rounded" />
      </div>
    </div>
  </template>
</template>
