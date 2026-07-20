<script setup lang="ts">
import type { ResolvedCard } from '~~/lib/engine/types'

const props = defineProps<{
  card: ResolvedCard | null
  open: boolean
}>()

const emit = defineEmits<{ close: [] }>()

const displayName = computed(() => props.card?.printedName ?? props.card?.name ?? '')

const scryfallUrl = computed(() =>
  props.card ? `https://scryfall.com/card/${props.card.setCode}/${props.card.collectorNumber}` : '#',
)

const cardmarketUrl = computed(() =>
  props.card
    ? `https://www.cardmarket.com/fr/Magic/Products/Search?searchString=${encodeURIComponent(props.card.name.split(' // ')[0] ?? props.card.name)}`
    : '#',
)

function formatPrice(price: string | null | undefined): string {
  if (!price) return '—'
  return `${Number(price).toFixed(2).replace('.', ',')} €`
}

// Fermeture à la touche Échap
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) document.addEventListener('keydown', onKeydown)
    else document.removeEventListener('keydown', onKeydown)
  },
)

onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open && card"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      :aria-label="displayName"
      @click.self="emit('close')"
    >
      <div
        class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 class="text-xl font-semibold">{{ displayName }}</h2>
            <p v-if="card.printedName && card.printedName !== card.name" class="text-sm text-slate-500 dark:text-slate-400">
              {{ card.name }}
            </p>
          </div>
          <button
            type="button"
            class="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Fermer"
            @click="emit('close')"
          >
            <svg class="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M5 5l10 10M15 5L5 15" stroke-linecap="round" />
            </svg>
          </button>
        </div>

        <div class="grid gap-6 sm:grid-cols-[minmax(0,240px)_1fr]">
          <img
            v-if="card.imageNormal"
            :src="card.imageNormal"
            :alt="displayName"
            class="w-full rounded-xl"
            loading="lazy"
          />

          <div class="space-y-4 text-sm">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-medium">{{ card.typeLine }}</span>
              <span v-if="card.manaCost" class="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs dark:bg-slate-800">
                {{ card.manaCost }}
              </span>
              <ColorPips :colors="card.colorIdentity" />
            </div>

            <p v-if="card.oracleText" class="whitespace-pre-line text-slate-700 dark:text-slate-300">
              {{ card.oracleText }}
            </p>

            <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-600 dark:text-slate-400">
              <dt>Édition</dt>
              <dd class="text-right font-medium uppercase text-slate-900 dark:text-slate-100">
                {{ card.setCode }} · {{ card.collectorNumber }}
              </dd>
              <dt>Prix (Cardmarket)</dt>
              <dd class="text-right font-medium text-slate-900 dark:text-slate-100">{{ formatPrice(card.priceEur) }}</dd>
              <template v-if="card.priceEurFoil">
                <dt>Prix foil</dt>
                <dd class="text-right font-medium text-slate-900 dark:text-slate-100">{{ formatPrice(card.priceEurFoil) }}</dd>
              </template>
            </dl>

            <div class="flex flex-wrap gap-3 pt-2">
              <a
                :href="cardmarketUrl"
                target="_blank"
                rel="noopener"
                class="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
              >
                Acheter sur Cardmarket
              </a>
              <a
                :href="scryfallUrl"
                target="_blank"
                rel="noopener"
                class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
              >
                Voir sur Scryfall
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
