<script setup lang="ts">
defineProps<{ colors: string[] }>()

const COLOR_VARS: Record<string, string> = {
  W: 'var(--mtg-white)',
  U: 'var(--mtg-blue)',
  B: 'var(--mtg-black)',
  R: 'var(--mtg-red)',
  G: 'var(--mtg-green)',
}
</script>

<template>
  <span class="inline-flex items-center gap-1">
    <span
      v-for="color in colors.length ? colors : ['C']"
      :key="color"
      class="h-3.5 w-3.5 rounded-full border border-black/20 dark:border-white/30"
      :style="{ backgroundColor: COLOR_VARS[color] ?? '#94a3b8' }"
      :title="color === 'C' ? 'Incolore' : color"
    />
  </span>
</template>
