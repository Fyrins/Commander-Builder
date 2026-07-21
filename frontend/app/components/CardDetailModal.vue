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
        class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl panel p-6 text-strong shadow-2xl   "
      >
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 class="text-xl font-semibold">{{ displayName }}</h2>
            <p v-if="card.printedName && card.printedName !== card.name" class="text-sm text-muted">
              {{ card.name }}
            </p>
          </div>
          <button
            type="button"
            class="btn btn--ghost rounded-lg p-1.5"
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
              <ManaCost :cost="card.manaCost" class="text-base" />
            </div>

            <OracleText :text="card.oracleText" class="text-strong" />

            <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-muted">
              <dt>Édition</dt>
              <dd class="text-right font-medium uppercase text-strong">
                {{ card.setCode }} · {{ card.collectorNumber }}
              </dd>
              <dt>Prix (Cardmarket)</dt>
              <dd class="text-right font-medium text-strong">{{ formatPrice(card.priceEur) }}</dd>
              <template v-if="card.priceEurFoil">
                <dt>Prix foil</dt>
                <dd class="text-right font-medium text-strong">{{ formatPrice(card.priceEurFoil) }}</dd>
              </template>
            </dl>

            <div class="flex flex-wrap gap-3 pt-2">
              <a
                :href="cardmarketUrl"
                target="_blank"
                rel="noopener"
                class="btn btn--primary text-xs"
              >
                Acheter sur Cardmarket
              </a>
              <a
                :href="scryfallUrl"
                target="_blank"
                rel="noopener"
                class="btn btn--secondary text-xs"
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
