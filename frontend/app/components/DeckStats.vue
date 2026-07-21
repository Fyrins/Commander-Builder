<script setup lang="ts">
/**
 * Bloc « Stats du deck » façon Archidekt : courbe de mana, coûts par
 * couleur, production de mana par couleur, répartition par type et
 * probabilité de pioche. Purement dérivé des props (aucun accès store) —
 * graphiques en HTML/CSS pur (barres), pas de lib de charts.
 */
import { colorPipCosts, colorProduction, drawProbability, manaCurve, typeBreakdown } from '~~/lib/engine/stats'
import type { CardTypeKey } from '~~/lib/engine/stats'
import type { CardLookup, DecklistEntry } from '~~/lib/engine/types'

const props = defineProps<{
  entries: DecklistEntry[]
  lookup: CardLookup
  /** Taille totale du deck (terrains inclus), utilisée comme `deckSize` pour la probabilité de pioche. */
  total: number
}>()

const curve = computed(() => manaCurve(props.entries, props.lookup))
const maxCurveCount = computed(() => Math.max(1, ...curve.value.buckets.map((bucket) => bucket.count)))

const pipCosts = computed(() => colorPipCosts(props.entries, props.lookup))
const pipRows = computed(() => [
  { key: 'W', label: 'Blanc', stat: pipCosts.value.W },
  { key: 'U', label: 'Bleu', stat: pipCosts.value.U },
  { key: 'B', label: 'Noir', stat: pipCosts.value.B },
  { key: 'R', label: 'Rouge', stat: pipCosts.value.R },
  { key: 'G', label: 'Vert', stat: pipCosts.value.G },
  { key: 'colorless', label: 'Incolore', stat: pipCosts.value.colorless },
])

const production = computed(() => colorProduction(props.entries, props.lookup))
const productionRows = computed(() => [
  { key: 'W', label: 'Blanc', stat: production.value.W },
  { key: 'U', label: 'Bleu', stat: production.value.U },
  { key: 'B', label: 'Noir', stat: production.value.B },
  { key: 'R', label: 'Rouge', stat: production.value.R },
  { key: 'G', label: 'Vert', stat: production.value.G },
  { key: 'C', label: 'Incolore', stat: production.value.C },
])

const TYPE_LABELS: Record<CardTypeKey, string> = {
  creature: 'Créatures',
  instant: 'Éphémères',
  sorcery: 'Rituels',
  artifact: 'Artefacts',
  enchantment: 'Enchantements',
  planeswalker: 'Planeswalkers',
  battle: 'Batailles',
  land: 'Terrains',
  other: 'Autres',
}
const TYPE_ORDER: CardTypeKey[] = ['creature', 'instant', 'sorcery', 'artifact', 'enchantment', 'planeswalker', 'battle', 'land', 'other']

const types = computed(() => typeBreakdown(props.entries, props.lookup))
const typeRows = computed(() =>
  TYPE_ORDER.map((key) => ({ key, label: TYPE_LABELS[key], count: types.value[key] })).filter((row) => row.count > 0),
)
const maxTypeCount = computed(() => Math.max(1, ...typeRows.value.map((row) => row.count)))

const drawN = ref(1)
const drawK = ref(7)
const drawType = ref<CardTypeKey>('creature')

const drawProbabilityResult = computed(() => {
  const successes = types.value[drawType.value] ?? 0
  return drawProbability(props.total, successes, drawK.value, drawN.value)
})

const drawKOptions = Array.from({ length: 14 }, (_, index) => index + 7)
</script>

<template>
  <section class="space-y-6 rounded-xl border border-slate-200 p-6 dark:border-slate-800">
    <h2 class="text-lg font-semibold">Stats du deck</h2>

    <!-- Courbe de mana -->
    <div>
      <h3 class="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Courbe de mana</h3>
      <div class="flex h-32 items-end gap-1.5">
        <div v-for="bucket in curve.buckets" :key="bucket.label" class="flex flex-1 flex-col items-center gap-1">
          <div class="flex h-24 w-full items-end justify-center">
            <div
              class="w-full max-w-8 rounded-t bg-emerald-500/80 dark:bg-emerald-400/80"
              :style="{ height: `${(bucket.count / maxCurveCount) * 100}%` }"
            />
          </div>
          <span class="text-[10px] font-medium">{{ bucket.count }}</span>
          <span class="text-[10px] text-slate-500 dark:text-slate-400">{{ bucket.label }}</span>
        </div>
      </div>
      <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Valeur moyenne : <span class="font-medium text-slate-700 dark:text-slate-300">{{ curve.avgManaValue }}</span>
        · Valeur totale : <span class="font-medium text-slate-700 dark:text-slate-300">{{ curve.totalManaValue }}</span>
      </p>
    </div>

    <!-- Coûts par couleur -->
    <div>
      <h3 class="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Coûts par couleur</h3>
      <ul class="space-y-1.5">
        <li v-for="row in pipRows" :key="row.key" class="flex items-center gap-3">
          <ManaSymbol v-if="row.key !== 'colorless'" :code="row.key" />
          <span v-else class="badge badge--neutral">{{ row.label }}</span>
          <div class="flex-1"><ProgressBar :percent="row.stat.percent" /></div>
          <span class="w-32 shrink-0 text-right text-xs text-slate-500 dark:text-slate-400">
            {{ row.stat.pips }} pips · {{ row.stat.cards }} cartes
          </span>
        </li>
      </ul>
    </div>

    <!-- Production par couleur -->
    <div>
      <h3 class="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Production de mana</h3>
      <ul class="space-y-1.5">
        <li v-for="row in productionRows" :key="row.key" class="flex items-center gap-3">
          <ManaSymbol v-if="row.key !== 'C'" :code="row.key" />
          <span v-else class="badge badge--neutral">{{ row.label }}</span>
          <div class="flex-1"><ProgressBar :percent="row.stat.percent" /></div>
          <span class="w-24 shrink-0 text-right text-xs text-slate-500 dark:text-slate-400">{{ row.stat.sources }} sources</span>
        </li>
      </ul>
    </div>

    <!-- Répartition par type -->
    <div>
      <h3 class="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Répartition par type</h3>
      <ul class="space-y-1.5">
        <li v-for="row in typeRows" :key="row.key" class="flex items-center gap-3">
          <span class="w-28 shrink-0 text-xs text-slate-600 dark:text-slate-300">{{ row.label }}</span>
          <div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div class="h-full rounded-full bg-sky-500" :style="{ width: `${(row.count / maxTypeCount) * 100}%` }" />
          </div>
          <span class="w-8 shrink-0 text-right text-xs font-medium">{{ row.count }}</span>
        </li>
      </ul>
    </div>

    <!-- Probabilité de pioche -->
    <div>
      <h3 class="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Probabilité de pioche</h3>
      <p class="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        Probabilité de piocher au moins
        <select v-model.number="drawN" class="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800">
          <option v-for="n in [1, 2, 3, 4]" :key="n" :value="n">{{ n }}</option>
        </select>
        <select v-model="drawType" class="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800">
          <option v-for="key in TYPE_ORDER" :key="key" :value="key">{{ TYPE_LABELS[key] }}</option>
        </select>
        en
        <select v-model.number="drawK" class="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800">
          <option v-for="k in drawKOptions" :key="k" :value="k">{{ k }}</option>
        </select>
        cartes piochées
      </p>
      <p class="mt-2 text-2xl font-semibold">{{ (drawProbabilityResult * 100).toFixed(1) }}%</p>
    </div>
  </section>
</template>
