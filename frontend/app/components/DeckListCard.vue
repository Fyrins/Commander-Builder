<script setup lang="ts">
/**
 * Carte de la liste des decks (vue « Decks ») : miniature du commandant,
 * identité couleur, % de compatibilité avec le pool, budget pour compléter
 * et popularité EDHREC. Composant purement présentationnel.
 */
interface DeckCardVm {
  slug: string
  commanderName: string
  imageSmall?: string
  imageNormal?: string
  colors: string[]
  percent: number
  ownedCount: number
  total: number
  missingBudget: number
  numDecks: number | null
  isOwnedCommander: boolean
}

defineProps<{ deck: DeckCardVm }>()
defineEmits<{ select: [slug: string] }>()
</script>

<template>
  <div
    class="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 transition-colors hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600"
    role="button"
    tabindex="0"
    @click="$emit('select', deck.slug)"
    @keydown.enter="$emit('select', deck.slug)"
  >
    <CardHoverImage :small="deck.imageSmall" :normal="deck.imageNormal" :alt="deck.commanderName" />

    <div class="min-w-0 flex-1 space-y-1.5">
      <div class="flex items-start justify-between gap-2">
        <p class="truncate font-medium" :title="deck.commanderName">{{ deck.commanderName }}</p>
        <ColorPips :colors="deck.colors" />
      </div>

      <span v-if="deck.isOwnedCommander" class="badge badge--owned">Commandant possédé</span>

      <ProgressBar :percent="deck.percent" />

      <p class="text-xs text-slate-500 dark:text-slate-400">{{ deck.ownedCount }}/{{ deck.total }} cartes</p>

      <p class="text-xs text-slate-600 dark:text-slate-300">
        Budget pour compléter : <span class="font-medium">{{ formatEur(deck.missingBudget.toFixed(2)) }}</span>
      </p>

      <p v-if="deck.numDecks !== null" class="text-xs text-slate-400 dark:text-slate-500">
        {{ deck.numDecks.toLocaleString('fr-FR') }} decks sur EDHREC
      </p>
    </div>
  </div>
</template>
