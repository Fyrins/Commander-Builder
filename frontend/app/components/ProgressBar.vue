<script setup lang="ts">
defineProps<{ percent: number; label?: string }>()
</script>

<template>
  <div>
    <div v-if="label" class="mb-1 flex justify-between text-sm text-slate-600 dark:text-slate-300">
      <span>{{ label }}</span>
      <span>{{ Math.round(percent) }}%</span>
    </div>
    <div class="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
      <div
        class="h-full rounded-full bg-emerald-500 transition-all duration-300"
        :style="{ width: `${Math.min(100, Math.max(0, percent))}%` }"
      />
    </div>
  </div>
</template>
